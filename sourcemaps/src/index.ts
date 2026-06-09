import { readFileSync } from 'node:fs'
import { createUnplugin } from 'unplugin'
import { processDir } from './process.js'
import { makeUploader, type UploadOptions } from './upload.js'

export interface Options extends UploadOptions {
  /** Build output directory to process. Defaults to "dist". */
  outDir?: string
  /** Inject debug-ids + rewrite maps but skip upload (debug). */
  injectOnly?: boolean
}

export { computeDebugId, injectMarker, setMapDebugId } from './core.js'
export { processDir } from './process.js'
export { makeUploader } from './upload.js'

// After the bundle is written, inject debug-ids into the emitted JS, write them
// into the maps, and upload each map (two-phase) to Tiden. Failures warn but
// never fail the build.
export const tidenSourceMaps = createUnplugin<Options>((opts) => ({
  name: 'tiden-sourcemaps',
  async writeBundle() {
    const dir = opts.outDir ?? 'dist'
    const processed = processDir(dir)
    if (opts.injectOnly) return
    const upload = makeUploader(opts)
    for (const p of processed) {
      try {
        await upload({ fileName: p.fileName, debugId: p.debugId, mapBytes: readFileSync(p.mapPath) })
      } catch (e) {
         
        console.warn(`[tiden] source-map upload failed for ${p.fileName}: ${(e as Error).message}`)
      }
    }
  },
}))

export const vite = tidenSourceMaps.vite
export const webpack = tidenSourceMaps.webpack
export const rollup = tidenSourceMaps.rollup
export const esbuild = tidenSourceMaps.esbuild
export default tidenSourceMaps
