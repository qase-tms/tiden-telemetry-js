const CONTENT_TYPE = 'application/x-sentry-envelope'

// Module-level rate-limit gate set when the server returns 429.
let rateLimitedUntil = 0

export function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil
}

// send delivers an envelope. On unload it uses sendBeacon (survives navigation —
// the error fired right before leaving is the one we must not lose); otherwise a
// keepalive fetch. Honors 429 + Retry-After. Never throws into the host app.
export function send(url: string, body: string, unload: boolean): void {
  if (isRateLimited()) return

  if (unload && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      navigator.sendBeacon(url, new Blob([body], { type: CONTENT_TYPE }))
    } catch {
      /* ignore */
    }
    return
  }

  if (typeof fetch !== 'function') return
  void fetch(url, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'Content-Type': CONTENT_TYPE },
  })
    .then((res) => {
      if (res.status === 429) {
        const ra = Number(res.headers.get('Retry-After'))
        rateLimitedUntil = Date.now() + (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60_000)
      }
    })
    .catch(() => {
      /* monitoring must never crash the app it monitors */
    })
}
