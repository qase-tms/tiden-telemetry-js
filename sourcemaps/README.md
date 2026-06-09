# @tiden/sourcemaps

[![npm](https://img.shields.io/npm/v/@tiden/sourcemaps)](https://www.npmjs.com/package/@tiden/sourcemaps)
[![downloads](https://img.shields.io/npm/dm/@tiden/sourcemaps)](https://www.npmjs.com/package/@tiden/sourcemaps)
[![license](https://img.shields.io/npm/l/@tiden/sourcemaps)](https://github.com/qase-tms/tiden-js/blob/main/LICENSE)

Build-time plugin that uploads your source maps to [Tiden](https://tiden.ai) so
minified production stack traces resolve back to your original source. Built on
[unplugin](https://github.com/unjs/unplugin) — one config works across **Vite,
webpack, Rollup, and esbuild**.

## Install

```bash
npm install -D @tiden/sourcemaps
```

## Usage (Vite)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tidenSourceMaps } from '@tiden/sourcemaps'

export default defineConfig({
  build: { sourcemap: true }, // emit .map files for the plugin to process
  plugins: [
    tidenSourceMaps.vite({
      url: 'https://app.tiden.ai',          // your Tiden API URL
      productId: process.env.TIDEN_PRODUCT_ID!,
      authToken: process.env.TIDEN_AUTH_TOKEN!, // build-time only — keep it secret
      release: 'my-app@1.2.3',
    }),
  ],
})
```

## Other bundlers

The same factory exports a plugin for each supported bundler:

```ts
import { tidenSourceMaps } from '@tiden/sourcemaps'

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

## How it works

On build, the plugin assigns each emitted bundle a stable **debug ID**, writes it
into both the JS and its source map, and uploads the maps. At view time, Tiden
matches the debug ID to symbolicate minified stack traces back to your source —
no source maps are ever served to end users.

> Keep `authToken` out of client code and version control — it is only used by
> your build (CI), never shipped to the browser.

## License

[MIT](https://github.com/qase-tms/tiden-js/blob/main/LICENSE)
