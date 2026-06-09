import { describe, it, expect } from 'vitest'
import { parseDsn } from './dsn'
import { framesFromError } from './stacktrace'
import { serializeEnvelope } from './envelope'
import { scrubEvent } from './scrub'
import { debugImages } from './debugids'
import type { SentryEvent } from './types'

describe('parseDsn', () => {
  it('extracts key, project, ingest url (wire-compatible sentry_key)', () => {
    const d = parseDsn('http://abc123@localhost:1143/a623b12f-de24-465c-b0ad-2cf76a958121')
    expect(d.publicKey).toBe('abc123')
    expect(d.projectId).toBe('a623b12f-de24-465c-b0ad-2cf76a958121')
    expect(d.ingestUrl).toBe('http://localhost:1143/api/a623b12f-de24-465c-b0ad-2cf76a958121/envelope/?sentry_key=abc123')
  })
  it('throws on a malformed dsn', () => {
    expect(() => parseDsn('http://localhost/')).toThrow()
  })
})

describe('framesFromError', () => {
  it('parses Error.stack and orders oldest-first (crash frame last)', () => {
    const err = new Error('boom')
    err.stack = [
      'Error: boom',
      '    at handleCheckout (https://app/static/main.4f3a.js:5:12)',
      '    at onClick (https://app/static/main.4f3a.js:9:3)',
    ].join('\n')
    const frames = framesFromError(err)
    expect(frames.length).toBe(2)
    expect(frames[frames.length - 1]!.function).toBe('handleCheckout')
    expect(frames[frames.length - 1]!.lineno).toBe(5)
    expect(frames[frames.length - 1]!.in_app).toBe(true)
  })
})

describe('serializeEnvelope', () => {
  it('emits header / item-with-length / body', () => {
    const ev = { event_id: 'e1', timestamp: 1, platform: 'javascript', level: 'error' } as SentryEvent
    const out = serializeEnvelope(ev, '2026-01-01T00:00:00Z')
    const lines = out.trimEnd().split('\n')
    expect(lines.length).toBe(3)
    const itemHeader = JSON.parse(lines[1]!)
    expect(itemHeader.type).toBe('event')
    expect(itemHeader.length).toBe(new TextEncoder().encode(lines[2]!).length)
  })
})

describe('scrubEvent', () => {
  it('redacts secret headers + PII when sendDefaultPii=false', () => {
    const ev: SentryEvent = {
      event_id: 'e', timestamp: 1, platform: 'javascript', level: 'error',
      message: 'failed for user a@b.com',
      request: { url: 'https://x', headers: { Authorization: 'Bearer s', Accept: 'json' } },
    }
    scrubEvent(ev, false)
    expect(ev.request!.headers!.Authorization).toBe('[Filtered]')
    expect(ev.request!.headers!.Accept).toBe('json')
    expect(ev.message).toContain('[Filtered]')
    expect(ev.message).not.toContain('a@b.com')
  })
  it('keeps PII when sendDefaultPii=true (headers still redacted)', () => {
    const ev: SentryEvent = {
      event_id: 'e', timestamp: 1, platform: 'javascript', level: 'error',
      message: 'user a@b.com',
      request: { url: 'https://x', headers: { Cookie: 'sid=1' } },
    }
    scrubEvent(ev, true)
    expect(ev.message).toContain('a@b.com')
    expect(ev.request!.headers!.Cookie).toBe('[Filtered]')
  })
})

describe('debugImages', () => {
  it('reads the injected marker into debug_meta images', () => {
    globalThis.__tidenDebugIds = { 'https://app/static/main.4f3a.js': 'dddddddd-dddd-dddd-dddd-dddddddddddd' }
    const imgs = debugImages()
    expect(imgs).toHaveLength(1)
    expect(imgs[0]).toMatchObject({ type: 'sourcemap', debug_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' })
    delete globalThis.__tidenDebugIds
  })
})
