import { parse as parseStack } from 'stacktrace-parser'
import type { Frame } from './types.js'

// framesFromError parses Error.stack across browsers via stacktrace-parser (the
// hard cross-browser part we deliberately do NOT hand-roll) and converts to
// stack frames. stacktrace-parser yields newest-call-first; we order
// oldest-first (the crashing call last), so we reverse.
export function framesFromError(err: unknown): Frame[] {
  const stack = err instanceof Error ? err.stack : undefined
  if (!stack) return []
  const parsed = parseStack(stack)
  return parsed.reverse().map((f) => ({
    function: f.methodName || '?',
    filename: f.file ?? undefined,
    abs_path: f.file ?? undefined,
    lineno: f.lineNumber ?? undefined,
    colno: f.column ?? undefined,
    in_app: isInApp(f.file),
  }))
}

function isInApp(file: string | null): boolean {
  if (!file) return false
  if (file.includes('node_modules')) return false
  // vendor/runtime chunks are not the app's own code
  if (/\/(vendor|chunk-vendors|runtime)[.-]/.test(file)) return false
  return true
}
