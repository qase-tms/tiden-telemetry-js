import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Same pattern as contract.test.ts: mock only the network send so we can
// inspect the exact event the Client builds, while the rest of the pipeline
// (buildEvent, scrub, dedup) runs for real.

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
import { _reset as resetBreadcrumbs } from './breadcrumbs.js'
import type { TidenEvent } from './types.js'

const DSN = 'http://pub@host/proj'

function lastEvent(): TidenEvent {
  const body = sent[sent.length - 1]!.body
  return JSON.parse(body.trimEnd().split('\n')[2]!) as TidenEvent
}

describe('Client.captureException — non-Error serialization', () => {
  beforeEach(() => {
    sent.length = 0
    resetBreadcrumbs()
  })

  it('leaves a real Error instance unchanged (regression guard)', () => {
    const client = new Client({ dsn: DSN })
    client.captureException(new Error('boom'))
    const ex = lastEvent().exception!.values[0]!
    expect(ex.type).toBe('Error')
    expect(ex.value).toBe('boom')
    expect(lastEvent().extra).toBeUndefined()
  })

  it('a plain object throw becomes an actionable title with the object attached', () => {
    const client = new Client({ dsn: DSN })
    client.captureException({ code: 'E_X', detail: 'nope' })
    const ev = lastEvent()
    const ex = ev.exception!.values[0]!
    expect(ex.value).toBe('Non-Error exception captured with keys: code, detail')
    expect(ex.value).not.toContain('[object Object]')
    expect(ev.extra!.__serialized__).toEqual({ code: 'E_X', detail: 'nope' })
  })

  it('prefers a usable .message but still attaches the serialized object', () => {
    const client = new Client({ dsn: DSN })
    client.captureException({ message: 'custom msg', extra: 1 })
    const ev = lastEvent()
    expect(ev.exception!.values[0]!.value).toBe('custom msg')
    expect(ev.extra!.__serialized__).toEqual({ message: 'custom msg', extra: 1 })
  })

  it('renders a plain string throw as-is', () => {
    const client = new Client({ dsn: DSN })
    client.captureException('a string error')
    expect(lastEvent().exception!.values[0]!.value).toBe('a string error')
  })

  it('renders a number throw as its string form', () => {
    const client = new Client({ dsn: DSN })
    client.captureException(42)
    expect(lastEvent().exception!.values[0]!.value).toBe('42')
  })

  it('a null throw does not crash and never produces [object Object]', () => {
    const client = new Client({ dsn: DSN })
    expect(() => client.captureException(null)).not.toThrow()
    const value = lastEvent().exception!.values[0]!.value
    expect(value).not.toContain('[object Object]')
    expect(value).toContain('null')
  })

  it('a circular object does not throw and is serialized as [Circular]', () => {
    const client = new Client({ dsn: DSN })
    const o: Record<string, unknown> = {}
    o.self = o
    expect(() => client.captureException(o)).not.toThrow()
    const extra = lastEvent().extra!.__serialized__ as Record<string, unknown>
    expect(extra.self).toBe('[Circular]')
  })

  it('bounds a deep/large object end to end (depth, keys, string length capped)', () => {
    const client = new Client({ dsn: DSN })
    const big: Record<string, unknown> = { longString: 'x'.repeat(5000) }
    for (let i = 0; i < 200; i++) big[`k${i}`] = i
    let deep: Record<string, unknown> = { leaf: 'bottom' }
    for (let i = 0; i < 10; i++) deep = { nested: deep }
    big.deep = deep

    client.captureException(big)
    const extra = lastEvent().extra!.__serialized__ as Record<string, unknown>
    expect(Object.keys(extra).length).toBeLessThanOrEqual(50)
    expect((extra.longString as string).length).toBeLessThanOrEqual(1024)
    expect(JSON.stringify(extra)).not.toContain('bottom')
  })

  it('scrubs PII-shaped content inside the serialized extra', () => {
    const client = new Client({ dsn: DSN })
    client.captureException({
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    })
    const extra = lastEvent().extra!.__serialized__ as Record<string, unknown>
    expect(extra.token).toBe('[Filtered]')
  })
})

describe('unhandledrejection — non-Error serialization', () => {
  type Listener = (e: { reason?: unknown }) => void
  let listeners: Record<string, Listener>
  let origWindow: unknown

  beforeEach(() => {
    sent.length = 0
    resetBreadcrumbs()
    listeners = {}
    origWindow = (globalThis as Record<string, unknown>).window
    ;(globalThis as Record<string, unknown>).window = {
      addEventListener: (type: string, fn: Listener) => {
        listeners[type] = fn
      },
    }
  })

  afterEach(() => {
    ;(globalThis as Record<string, unknown>).window = origWindow
    resetBreadcrumbs()
  })

  it('Promise.reject with a plain object is serialized, not [object Object]', () => {
    new Client({ dsn: DSN })
    listeners['unhandledrejection']!({ reason: { foo: 'bar' } })
    const ev = lastEvent()
    expect(ev.exception!.values[0]!.value).toBe('Non-Error promise rejection captured with keys: foo')
    expect(ev.exception!.values[0]!.value).not.toContain('[object Object]')
    expect(ev.extra!.__serialized__).toEqual({ foo: 'bar' })
  })

  it('still reports a genuine Error rejection unchanged (regression guard)', () => {
    new Client({ dsn: DSN })
    listeners['unhandledrejection']!({ reason: new Error('boom in checkout') })
    const ex = lastEvent().exception!.values[0]!
    expect(ex.type).toBe('Error')
    expect(ex.value).toBe('boom in checkout')
    expect(lastEvent().extra).toBeUndefined()
  })
})
