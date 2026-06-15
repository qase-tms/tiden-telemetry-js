import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { deleteAfterUpload } from './index'

// realpathSync so macOS's /var -> /private/var tmpdir symlink doesn't make the
// glob's absolute paths diverge from resolve()'d ones (mirrors a real build dir,
// which is already a real path under the project root).
function fixture() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'tsm-del-')))
  mkdirSync(join(dir, 'assets'))
  const a = join(dir, 'assets', 'a.js.map')
  const b = join(dir, 'assets', 'b.js.map')
  const js = join(dir, 'assets', 'a.js')
  writeFileSync(a, '{}')
  writeFileSync(b, '{}')
  writeFileSync(js, 'x')
  return { dir, a, b, js }
}

describe('deleteAfterUpload', () => {
  it('deletes matching .map files (single glob string) and leaves non-maps', async () => {
    const { dir, a, b, js } = fixture()
    const deleted = await deleteAfterUpload(join(dir, '**/*.map'))
    expect(deleted.sort()).toEqual([a, b].sort())
    expect(existsSync(a)).toBe(false)
    expect(existsSync(b)).toBe(false)
    expect(existsSync(js)).toBe(true)
  })

  it('keeps a map whose upload failed, deletes the rest', async () => {
    const { dir, a, b } = fixture()
    const deleted = await deleteAfterUpload([join(dir, '**/*.map')], new Set([resolve(a)]))
    expect(existsSync(a)).toBe(true)
    expect(existsSync(b)).toBe(false)
    expect(deleted).toEqual([b])
  })

  it('is a no-op for undefined / empty patterns', async () => {
    const { a } = fixture()
    expect(await deleteAfterUpload(undefined)).toEqual([])
    expect(await deleteAfterUpload([])).toEqual([])
    expect(existsSync(a)).toBe(true)
  })

  it('accepts an explicit single-file glob', async () => {
    const { dir, a, b } = fixture()
    const deleted = await deleteAfterUpload(join(dir, 'assets/a.js.map'))
    expect(existsSync(a)).toBe(false)
    expect(existsSync(b)).toBe(true)
    expect(deleted).toEqual([a])
  })
})
