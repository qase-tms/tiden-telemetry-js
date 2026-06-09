import type { Breadcrumb } from './types.js'

// A ring buffer of breadcrumbs plus best-effort instrumentation of console,
// fetch, clicks and navigation. A re-entrancy guard prevents the SDK's own
// console/fetch from generating breadcrumbs (which would recurse).

let buffer: Breadcrumb[] = []
let max = 100
let installed = false
let inSdk = false

export function setMaxBreadcrumbs(n: number): void {
  max = n > 0 ? n : 100
}

export function add(b: Breadcrumb): void {
  if (inSdk) return
  buffer.push(b)
  if (buffer.length > max) buffer.shift()
}

export function snapshot(): Breadcrumb[] {
  return buffer.slice()
}

// withSdkGuard suppresses breadcrumb capture for the duration of fn (used around
// the SDK's own network send / logging).
export function withSdkGuard<T>(fn: () => T): T {
  inSdk = true
  try {
    return fn()
  } finally {
    inSdk = false
  }
}

function nowSec(): number {
  return Date.now() / 1000
}

export function install(): void {
  if (installed) return
  installed = true

  if (typeof console !== 'undefined') {
    for (const level of ['log', 'info', 'warn', 'error'] as const) {
      const orig = console[level] as ((...a: unknown[]) => void) | undefined
      if (typeof orig !== 'function') continue
      ;(console as unknown as Record<string, (...a: unknown[]) => void>)[level] = (...args: unknown[]) => {
        add({ timestamp: nowSec(), type: 'console', category: 'console', level, message: args.map(String).join(' ') })
        orig.apply(console, args)
      }
    }
  }

  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const orig = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const url = typeof input === 'string' ? input : input.toString()
      return orig(input, init).then(
        (res) => {
          add({ timestamp: nowSec(), type: 'http', category: 'fetch', message: `${method} ${url} ${res.status}`, data: { status_code: res.status } })
          return res
        },
        (err) => {
          add({ timestamp: nowSec(), type: 'http', category: 'fetch', level: 'error', message: `${method} ${url} failed` })
          throw err
        },
      )
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener(
      'click',
      (e) => add({ timestamp: nowSec(), type: 'ui', category: 'ui.click', message: describeTarget(e.target) }),
      { capture: true, passive: true },
    )
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () =>
      add({ timestamp: nowSec(), type: 'navigation', category: 'navigation', message: location.href }),
    )
  }
}

function describeTarget(target: EventTarget | null): string {
  const el = target as Element | null
  if (!el || !el.tagName) return 'click'
  const id = el.id ? `#${el.id}` : ''
  return `${el.tagName.toLowerCase()}${id}`
}

// Test-only reset.
export function _reset(): void {
  buffer = []
  installed = false
  inSdk = false
}
