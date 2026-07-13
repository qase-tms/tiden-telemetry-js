// Turns any thrown/rejected value into an actionable exception title, matching
// Sentry's "Non-Error exception/promise rejection captured" convention. A raw
// String(err) on a plain object yields "[object Object]" and discards the
// object's real keys/values (Defect B in the design doc) — this module fixes
// that without touching the real-Error path.

const MAX_DEPTH = 3
const MAX_ITEMS = 50
const MAX_STRING_LEN = 1024

export interface SerializedException {
  type: string
  value: string
  /** Bounded, PII-scrubbable copy of the original value; only set for object throws. */
  extra?: Record<string, unknown>
}

export type ExceptionKind = 'exception' | 'promise rejection'

export function exceptionFromUnknown(err: unknown, kind: ExceptionKind = 'exception'): SerializedException {
  if (err instanceof Error) {
    return { type: err.name || 'Error', value: err.message || String(err) }
  }

  if (err !== null && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    const type = typeof obj.name === 'string' && obj.name.length > 0 ? obj.name : 'Error'
    const message = typeof obj.message === 'string' && obj.message.length > 0 ? obj.message : undefined
    const value = message ?? `Non-Error ${kind} captured with keys: ${keys.join(', ')}`
    return { type, value, extra: { __serialized__: safeSerialize(obj) } }
  }

  if (err === null || err === undefined) {
    return { type: 'Error', value: `Non-Error ${kind} captured with value: ${String(err)}` }
  }

  return { type: 'Error', value: String(err) }
}

// safeSerialize produces a plain-JSON-safe, bounded copy of an arbitrary value.
// It must never throw: it caps depth/keys/array-length/string-length and
// replaces circular references, functions, and other non-JSON values with
// readable placeholders instead of failing.
export function safeSerialize(value: unknown): unknown {
  return serialize(value, [], 0)
}

function serialize(value: unknown, seen: unknown[], depth: number): unknown {
  if (value === null) return null

  const t = typeof value
  if (t === 'string') {
    const s = value as string
    return s.length > MAX_STRING_LEN ? s.slice(0, MAX_STRING_LEN) : s
  }
  if (t === 'number' || t === 'boolean') return value
  if (t === 'undefined') return undefined
  if (t === 'bigint' || t === 'symbol') return String(value)
  if (t === 'function') return '[Function]'

  // t === 'object' (plain objects, arrays, class instances, etc.)
  if (seen.includes(value)) return '[Circular]'
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? '[Array]' : '[Object]'

  const nextSeen = [...seen, value]

  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (let i = 0; i < value.length && out.length < MAX_ITEMS; i++) {
      out.push(serialize(value[i], nextSeen, depth + 1))
    }
    return out
  }

  const out: Record<string, unknown> = {}
  let count = 0
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (count >= MAX_ITEMS) break
    const serialized = serialize((value as Record<string, unknown>)[key], nextSeen, depth + 1)
    if (serialized === undefined) continue
    out[key] = serialized
    count++
  }
  return out
}
