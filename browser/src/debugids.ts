import type { DebugImage } from './types'

// The @tiden/sourcemaps bundler plugin injects a global record mapping each
// emitted bundle's URL to its debug_id. We read it to populate debug_meta so the
// server can match source maps. (Our own marker name — not Sentry's.)
declare global {
  // eslint-disable-next-line no-var
  var __tidenDebugIds: Record<string, string> | undefined
}

export function debugImages(): DebugImage[] {
  const reg = globalThis.__tidenDebugIds
  if (!reg) return []
  return Object.entries(reg).map(([code_file, debug_id]) => ({
    type: 'sourcemap',
    code_file,
    debug_id,
  }))
}
