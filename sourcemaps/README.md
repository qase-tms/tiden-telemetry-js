# @tiden/telemetry-sourcemaps

[![npm](https://img.shields.io/npm/v/@tiden/telemetry-sourcemaps)](https://www.npmjs.com/package/@tiden/telemetry-sourcemaps)
[![downloads](https://img.shields.io/npm/dm/@tiden/telemetry-sourcemaps)](https://www.npmjs.com/package/@tiden/telemetry-sourcemaps)
[![license](https://img.shields.io/npm/l/@tiden/telemetry-sourcemaps)](https://github.com/qase-tms/tiden-telemetry-js/blob/main/LICENSE)

Build-time plugin that uploads your source maps to [Tiden](https://tiden.ai) so
minified production stack traces resolve back to your original source. Built on
[unplugin](https://github.com/unjs/unplugin) — one config works across **Vite,
webpack, Rollup, and esbuild**.

## Install

```bash
npm install -D @tiden/telemetry-sourcemaps
```

## Usage (Vite)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tidenSourceMaps } from '@tiden/telemetry-sourcemaps'

export default defineConfig({
  // 'hidden' emits .map files for the plugin but omits the sourceMappingURL
  // comment, so browsers never fetch them.
  build: { sourcemap: 'hidden' },
  plugins: [
    tidenSourceMaps.vite({
      url: 'https://app.tiden.ai',          // your Tiden API URL
      productId: process.env.TIDEN_PRODUCT_ID!,
      authToken: process.env.TIDEN_AUTH_TOKEN!, // build-time only — keep it secret
      release: 'my-app@1.2.3',
      // Delete the maps from the build output once they're uploaded, so they're
      // never shipped to production.
      filesToDeleteAfterUpload: ['dist/**/*.map'],
    }),
  ],
})
```

## Other bundlers

The same factory exports a plugin for each supported bundler:

```ts
import { tidenSourceMaps } from '@tiden/telemetry-sourcemaps'

tidenSourceMaps.vite(options)
tidenSourceMaps.webpack(options)
tidenSourceMaps.rollup(options)
tidenSourceMaps.esbuild(options)
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | — | **Required.** Your Tiden API URL. |
| `productId` | `string` | — | **Required.** Target product. |
| `authToken` | `string` | — | **Required.** API token (build-time only). |
| `release` | `string` | — | App version to associate maps with. |
| `outDir` | `string` | `"dist"` | Build output directory to process. |
| `injectOnly` | `boolean` | `false` | Inject debug IDs but skip upload (debugging). |
| `filesToDeleteAfterUpload` | `string \| string[]` | — | Glob(s) of files to delete after a successful upload, e.g. `['dist/**/*.map']`. Off by default. A map whose upload failed is kept so the build can be retried. |

## How it works

On build, the plugin assigns each emitted bundle a stable **debug ID**, writes it
into both the JS and its source map, and uploads the maps. At view time, Tiden
matches the debug ID to symbolicate minified stack traces back to your source —
no source maps are ever served to end users.

> Keep `authToken` out of client code and version control — it is only used by
> your build (CI), never shipped to the browser.

## Cleaning up source maps

A source map shipped to production lets anyone reconstruct your original source.
Two ways to avoid that:

- **`build.sourcemap: 'hidden'`** (Vite) / `devtool: 'hidden-source-map'` (webpack)
  — generate maps without the `sourceMappingURL` comment, so browsers don't fetch
  them. Pair it with one of the below so the `.map` files don't linger in your
  deploy artifact at all.
- **`filesToDeleteAfterUpload`** — let the plugin delete the maps from the build
  output once they're uploaded. Deletion runs **after** upload, and any map whose
  upload failed is kept so you can retry. This is safe because Tiden resolves
  stack traces by **debug ID**, not by the served `.map` file — the uploaded copy
  is all it needs.
- Or handle it in your deploy: configure the server to deny `*.map`, or remove
  them in a post-build CI step.

## License

[MIT](https://github.com/qase-tms/tiden-telemetry-js/blob/main/LICENSE)
