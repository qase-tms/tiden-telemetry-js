// Wire types: the envelope event our ingest edge already parses.
// We emit `exception.values[]` (canonical), `debug_meta.images[]` (for source-map
// matching), and the Layer-2 sections the UI renders.

export interface Frame {
  function?: string
  filename?: string
  abs_path?: string
  lineno?: number
  colno?: number
  in_app?: boolean
}

export interface DebugImage {
  type: 'sourcemap'
  code_file: string
  debug_id: string
}

export interface Breadcrumb {
  timestamp: number
  type?: string
  category?: string
  message?: string
  level?: string
  data?: Record<string, unknown>
}

export interface ExceptionValue {
  type: string
  value: string
  stacktrace?: { frames: Frame[] }
}

export interface TidenEvent {
  event_id: string
  timestamp: number
  platform: 'javascript'
  level: string
  release?: string
  environment?: string
  message?: string
  exception?: { values: ExceptionValue[] }
  breadcrumbs?: { values: Breadcrumb[] }
  request?: { url?: string; headers?: Record<string, string> }
  user?: Record<string, unknown>
  tags?: Record<string, string>
  contexts?: Record<string, Record<string, unknown>>
  debug_meta?: { images: DebugImage[] }
  sdk?: { name: string; version: string }
}

export interface InitOptions {
  dsn: string
  release?: string
  environment?: string
  /** When false (default), strip likely-PII before send. */
  sendDefaultPii?: boolean
  /** Last-chance hook to mutate/drop an event. Return null to drop. */
  beforeSend?: (event: TidenEvent) => TidenEvent | null
  /** Drop events whose top frame URL matches any of these. */
  denyUrls?: (string | RegExp)[]
  maxBreadcrumbs?: number
  /** Cap events sent per page load (abuse / error-storm guard). */
  maxEventsPerPage?: number
}

export interface ParsedDsn {
  ingestUrl: string
  publicKey: string
  projectId: string
}
