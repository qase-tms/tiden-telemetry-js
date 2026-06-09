import type { ParsedDsn } from './types.js'

// parseDsn turns `http://<publicKey>@host[:port]/<projectId>` into the envelope
// ingest URL the existing edge parses: `/api/<projectId>/envelope/?tiden_key=...`
// (the edge reads the `tiden_key` query param — we stay wire-compatible).
export function parseDsn(dsn: string): ParsedDsn {
  const u = new URL(dsn)
  const publicKey = u.username
  const projectId = u.pathname.replace(/^\//, '').split('/')[0] ?? ''
  if (!publicKey || !projectId) {
    throw new Error('@tiden/browser: invalid DSN (expected http://<key>@host/<projectId>)')
  }
  const ingestUrl = `${u.protocol}//${u.host}/api/${projectId}/envelope/?tiden_key=${publicKey}`
  return { ingestUrl, publicKey, projectId }
}
