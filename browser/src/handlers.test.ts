import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Client } from './client'
import { _reset as resetBreadcrumbs } from './breadcrumbs'

// installGlobalHandlers needs a window. Tests run in node (no DOM), so we hand-roll
// a minimal window that records the listeners the SDK registers, plus a fake fetch
// that counts deliveries. Everything else runs the real code path.

const DSN = 'http://abc123@localhost:1143/a623b12f-de24-465c-b0ad-2cf76a958121'

type Listener = (e: { reason?: unknown; error?: unknown }) => void

describe('global handlers self-loop guard', () => {
  let listeners: Record<string, Listener>
  let fetchCalls: string[]
  let origWindow: unknown
  let origFetch: unknown

  beforeEach(() => {
    resetBreadcrumbs()
    listeners = {}
    fetchCalls = []
    origWindow = (globalThis as Record<string, unknown>).window
    origFetch = (globalThis as Record<string, unknown>).fetch

    const fakeFetch = (url: unknown): Promise<unknown> => {
      fetchCalls.push(String(url))
      return Promise.resolve({ status: 200, headers: { get: () => null } })
    }
    ;(globalThis as Record<string, unknown>).fetch = fakeFetch
    ;(globalThis as Record<string, unknown>).window = {
      addEventListener: (type: string, fn: Listener) => {
        listeners[type] = fn
      },
    }
  })

  afterEach(() => {
    ;(globalThis as Record<string, unknown>).window = origWindow
    ;(globalThis as Record<string, unknown>).fetch = origFetch
    resetBreadcrumbs()
  })

  it('does not re-send its own network delivery failure (Chrome "Failed to fetch")', () => {
    new Client({ dsn: DSN })
    listeners['unhandledrejection']!({ reason: new TypeError('Failed to fetch') })
    expect(fetchCalls).toHaveLength(0)
  })

  it('does not re-send Firefox/Safari network failures', () => {
    new Client({ dsn: DSN })
    listeners['unhandledrejection']!({ reason: new TypeError('NetworkError when attempting to fetch resource.') })
    listeners['unhandledrejection']!({ reason: new TypeError('Load failed') })
    expect(fetchCalls).toHaveLength(0)
  })

  it('still reports a genuine application error (proves the handler path delivers)', () => {
    new Client({ dsn: DSN })
    listeners['unhandledrejection']!({ reason: new Error('boom in checkout') })
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]).toContain('/envelope/')
  })
})
