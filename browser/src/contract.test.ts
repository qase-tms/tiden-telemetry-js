import { describe, it, expect, beforeEach, vi } from 'vitest'

// Contract test: pins the exact bytes the SDK puts on the wire so they stay in
// sync with the ingest backend. If the backend changes the ingest interface
// (auth param, media type, envelope framing, or event field names), update the
// SDK + these assertions together — a drift makes this test fail loudly.
//
// We mock only the network send so we can capture the real (url, body) the
// Client would transmit; everything else runs for real.

const sent: Array<{ url: string; body: string }> = []
vi.mock('./transport.js', async (importActual) => {
  const actual = await importActual<typeof import('./transport.js')>()
  return {
    ...actual,
    send: (url: string, body: string) => {
      sent.push({ url, body })
    },
  }
})

import { Client } from './client.js'
import { CONTENT_TYPE } from './transport.js'

describe('wire contract (must match the ingest backend)', () => {
  beforeEach(() => {
    sent.length = 0
  })

  it('uses the agreed envelope media type', () => {
    expect(CONTENT_TYPE).toBe('application/x-tiden-envelope')
  })

  it('captureException emits the agreed ingest URL, envelope framing, and event shape', () => {
    const client = new Client({
      dsn: 'http://pub@host:1140/proj-1',
      release: 'app@1.2.3',
      environment: 'production',
    })
    client.captureException(new Error('boom'))

    expect(sent).toHaveLength(1)
    const { url, body } = sent[0]!

    // (1) ingest URL + auth param name
    expect(url).toBe('http://host:1140/api/proj-1/envelope/?tiden_key=pub')

    // (2) envelope framing: {header}\n{item header + byte length}\n{event body}\n
    const lines = body.trimEnd().split('\n')
    expect(lines).toHaveLength(3)
    const header = JSON.parse(lines[0]!)
    const item = JSON.parse(lines[1]!)
    const event = JSON.parse(lines[2]!)
    expect(item).toMatchObject({ type: 'event', content_type: 'application/json' })
    expect(item.length).toBe(new TextEncoder().encode(lines[2]!).length)
    expect(header.event_id).toBe(event.event_id)

    // (3) event schema the backend normalizer reads
    expect(event.platform).toBe('javascript')
    expect(event.level).toBe('error')
    expect(event.release).toBe('app@1.2.3')
    expect(event.environment).toBe('production')
    const ex = event.exception.values[0]
    expect(ex.type).toBe('Error')
    expect(ex.value).toBe('boom')
    expect(Array.isArray(ex.stacktrace.frames)).toBe(true)
    const frame = ex.stacktrace.frames.at(-1)
    expect(frame).toHaveProperty('function')
    expect(frame).toHaveProperty('in_app')
  })

  it('source-map debug images use the agreed shape (matches symbolication)', () => {
    globalThis.__tidenDebugIds = { 'https://app/main.js': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }
    const client = new Client({ dsn: 'http://pub@host/proj' })
    client.captureException(new Error('x'))
    const event = JSON.parse(sent[0]!.body.trimEnd().split('\n')[2]!)
    expect(event.debug_meta.images[0]).toMatchObject({
      type: 'sourcemap',
      debug_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    delete globalThis.__tidenDebugIds
  })
})
