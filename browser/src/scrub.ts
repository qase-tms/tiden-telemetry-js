import type { TidenEvent } from './types.js'

// Client-side scrubbing before send (design §6). Mirrors the server's
// defense-in-depth: redact secret-bearing request headers, and (unless
// sendDefaultPii) run a conservative PII pass over human-readable strings.
const HEADER_DENYLIST = new Set([
  'authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token', 'proxy-authorization',
])

const PII_PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,                              // emails
  /\b(?:\d[ -]?){13,19}\b/g,                                // card-ish digit runs
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, // JWTs
]

export function scrubEvent(ev: TidenEvent, sendDefaultPii: boolean): TidenEvent {
  if (ev.request?.headers) {
    for (const k of Object.keys(ev.request.headers)) {
      if (HEADER_DENYLIST.has(k.toLowerCase())) ev.request.headers[k] = '[Filtered]'
    }
  }
  if (!sendDefaultPii) {
    if (ev.user) {
      delete ev.user.ip_address
    }
    if (ev.message) ev.message = redact(ev.message)
    for (const x of ev.exception?.values ?? []) {
      x.value = redact(x.value)
    }
    for (const b of ev.breadcrumbs?.values ?? []) {
      if (b.message) b.message = redact(b.message)
    }
  }
  return ev
}

function redact(s: string): string {
  let out = s
  for (const re of PII_PATTERNS) out = out.replace(re, '[Filtered]')
  return out
}
