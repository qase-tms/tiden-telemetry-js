import { readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createUnplugin } from 'unplugin'
import { globSync } from 'tinyglobby'
import { processDir } from './process.js'
import { makeUploader, type UploadOptions } from './upload.js'

export interface Options extends UploadOptions {
  /** Build output directory to process. Defaults to "dist". */
  outDir?: string
  /** Inject debug-ids + rewrite maps but skip upload (debug). */
  injectOnly?: boolean
  /**
   * Glob(s) of files to delete from the build output AFTER they upload
   * successfully, so source maps are never shipped to production (a public map
   * leaks your original source). Off by default — opt in explicitly. Resolved
   * with tinyglobby from the current working directory; a typical value targets
   * every .map under your build output. A map whose upload failed is kept so the
   * build can be retried, and deletion never runs in injectOnly mode.
   */
  filesToDeleteAfterUpload?: string | string[]
}

export { computeDebugId, injectMarker, setMapDebugId } from './core.js'
export { processDir } from './process.js'
export { makeUploader } from './upload.js'

// After the bundle is written, inject debug-ids into the emitted JS, write them
// into the maps, and upload each map (two-phase) to Tiden. Failures warn but
// never fail the build. If filesToDeleteAfterUpload is set, matching files are
// removed once uploads complete (skipping any map whose upload failed).
export const tidenSourceMaps = createUnplugin<Options>((opts) => ({
  name: 'tiden-sourcemaps',
  async writeBundle() {
    const dir = opts.outDir ?? 'dist'
    const processed = processDir(dir)
    if (opts.injectOnly) return
    const upload = makeUploader(opts)
    const failed = new Set<string>()
    for (const p of processed) {
      try {
        await upload({ fileName: p.fileName, debugId: p.debugId, mapBytes: readFileSync(p.mapPath) })
      } catch (e) {
        failed.add(resolve(p.mapPath))

        console.warn(`[tiden] source-map upload failed for ${p.fileName}: ${(e as Error).message}`)
      }
    }
    await deleteAfterUpload(opts.filesToDeleteAfterUpload, failed)
  },
}))

// deleteAfterUpload removes files matching `patterns`, skipping any whose upload
// failed (their resolved paths are in `failedUploads`). It never throws — like
// the rest of the plugin, cleanup problems only warn. Returns the deleted paths
// (exported for testing). A successful upload means the map is safe to remove
// because Tiden resolves stack traces by debug-id, not by the served .map file.
export async function deleteAfterUpload(
  patterns: string | string[] | undefined,
  failedUploads: ReadonlySet<string> = new Set(),
): Promise<string[]> {
  if (!patterns) return []
  const globs = Array.isArray(patterns) ? patterns : [patterns]
  if (globs.length === 0) return []

  let matches: string[]
  try {
    matches = globSync(globs, { absolute: true, dot: true })
  } catch (e) {

    console.warn(`[tiden] filesToDeleteAfterUpload: glob failed: ${(e as Error).message}`)
    return []
  }

  const deleted: string[] = []
  for (const file of matches) {
    if (failedUploads.has(file)) {

      console.warn(`[tiden] keeping ${file}: its source-map upload failed`)
      continue
    }
    try {
      await rm(file, { force: true })
      deleted.push(file)
    } catch (e) {

      console.warn(`[tiden] failed to delete ${file}: ${(e as Error).message}`)
    }
  }
  return deleted
}

export const vite = tidenSourceMaps.vite
export const webpack = tidenSourceMaps.webpack
export const rollup = tidenSourceMaps.rollup
export const esbuild = tidenSourceMaps.esbuild
export default tidenSourceMaps
