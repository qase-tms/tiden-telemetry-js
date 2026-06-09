import { parseDsn } from './dsn.js'
import { framesFromError } from './stacktrace.js'
import { debugImages } from './debugids.js'
import { scrubEvent } from './scrub.js'
import { serializeEnvelope } from './envelope.js'
import { send } from './transport.js'
import * as breadcrumbs from './breadcrumbs.js'
import type { ExceptionValue, InitOptions, ParsedDsn, TidenEvent } from './types.js'

const SDK = { name: 'tiden.javascript.browser', version: '0.1.0' }

export class Client {
  private readonly dsn: ParsedDsn
  private readonly opts: InitOptions
  private user?: Record<string, unknown>
  private tags: Record<string, string> = {}
  private sent = 0
  private readonly recent = new Set<string>()

  constructor(opts: InitOptions) {
    this.opts = opts
    this.dsn = parseDsn(opts.dsn)
    breadcrumbs.setMaxBreadcrumbs(opts.maxBreadcrumbs ?? 100)
    breadcrumbs.install()
    this.installGlobalHandlers()
  }

  setUser(u: Record<string, unknown> | null): void {
    this.user = u ?? undefined
  }

  setTag(k: string, v: string): void {
    this.tags[k] = v
  }

  captureException(err: unknown, unload = false): void {
    const frames = framesFromError(err)
    const e = err as { name?: string; message?: string }
    const ex: ExceptionValue = {
      type: (e && e.name) || 'Error',
      value: (e && e.message) || String(err),
      stacktrace: frames.length ? { frames } : undefined,
    }
    this.capture({ exception: { values: [ex] } }, unload)
  }

  captureMessage(message: string, level = 'info'): void {
    this.capture({ message, level })
  }

  // capture is wrapped so a failure in our own code can never bubble into the host.
  private capture(partial: Partial<TidenEvent>, unload = false): void {
    try {
      const cap = this.opts.maxEventsPerPage ?? 100
      if (this.sent >= cap) return

      const event = this.buildEvent(partial)
      const key = dedupKey(event)
      if (this.recent.has(key)) return
      this.recent.add(key)

      const scrubbed = scrubEvent(event, this.opts.sendDefaultPii ?? false)
      const final = this.opts.beforeSend ? this.opts.beforeSend(scrubbed) : scrubbed
      if (!final || this.denied(final)) return

      this.sent++
      breadcrumbs.withSdkGuard(() => {
        send(this.dsn.ingestUrl, serializeEnvelope(final, new Date().toISOString()), unload)
      })
    } catch {
      /* never throw into the host app */
    }
  }

  private buildEvent(partial: Partial<TidenEvent>): TidenEvent {
    const ev: TidenEvent = {
      event_id: eventId(),
      timestamp: Date.now() / 1000,
      platform: 'javascript',
      level: partial.level ?? 'error',
      release: this.opts.release,
      environment: this.opts.environment,
      sdk: SDK,
      breadcrumbs: { values: breadcrumbs.snapshot() },
      ...partial,
    }
    if (this.user) ev.user = this.user
    if (Object.keys(this.tags).length) ev.tags = this.tags
    const images = debugImages()
    if (images.length) ev.debug_meta = { images }
    if (typeof location !== 'undefined') ev.request = { url: location.href }
    return ev
  }

  private denied(ev: TidenEvent): boolean {
    const urls = this.opts.denyUrls
    if (!urls || !urls.length) return false
    const frames = ev.exception?.values[0]?.stacktrace?.frames
    const top = frames && frames.length ? frames[frames.length - 1]?.abs_path ?? '' : ''
    return urls.some((u) => (typeof u === 'string' ? top.includes(u) : u.test(top)))
  }

  private installGlobalHandlers(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('error', (e: ErrorEvent) => {
      if (e.error) this.captureException(e.error)
    })
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      const r: unknown = e.reason
      this.captureException(r instanceof Error ? r : new Error(String(r)))
    })
  }
}

function eventId(): string {
  const b = new Uint8Array(16)
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(b)
  } else {
    for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

function dedupKey(ev: TidenEvent): string {
  const x = ev.exception?.values[0]
  if (x) {
    const frames = x.stacktrace?.frames
    const top = frames && frames.length ? frames[frames.length - 1] : undefined
    return `${x.type}|${x.value}|${top?.abs_path}:${top?.lineno}`
  }
  return `msg:${ev.message ?? ''}`
}
