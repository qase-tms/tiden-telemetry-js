import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'

// Capture the transmitted envelope without hitting the network (same approach as
// contract.test.ts).
const sent: string[] = []
vi.mock('./transport.js', async (importActual) => {
  const actual = await importActual<typeof import('./transport.js')>()
  return {
    ...actual,
    send: (_url: string, body: string) => {
      sent.push(body)
    },
  }
})

import { Client } from './client.js'

// Guards the sdk.version drift that shipped "0.1.0" on the wire while the
// package was already 0.1.4 — the SDK constant in client.ts must track
// package.json "version".
describe('sdk version', () => {
  it('reports package.json version as sdk.version on the wire', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string
    }
    sent.length = 0
    new Client({ dsn: 'http://pub@host:1140/proj-1' }).captureException(new Error('x'))
    expect(sent).toHaveLength(1)
    const event = JSON.parse(sent[0]!.trimEnd().split('\n')[2]!)
    expect(event.sdk.version).toBe(pkg.version)
  })
})
