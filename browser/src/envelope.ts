import type { SentryEvent } from './types'

// serializeEnvelope builds the Sentry envelope our ingest edge parses:
//   {envelope header}\n{item header (with length)}\n{event payload}\n
// The item `length` is the byte length the edge uses for framing.
export function serializeEnvelope(ev: SentryEvent, sentAt: string): string {
  const body = JSON.stringify(ev)
  const length = new TextEncoder().encode(body).length
  const envelopeHeader = JSON.stringify({ event_id: ev.event_id, sent_at: sentAt })
  const itemHeader = JSON.stringify({ type: 'event', length, content_type: 'application/json' })
  return `${envelopeHeader}\n${itemHeader}\n${body}\n`
}
