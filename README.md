# Tiden SDK for JavaScript

> Lightweight, dependency-free error tracking for JavaScript & TypeScript apps.

[![@tiden/telemetry-browser](https://img.shields.io/npm/v/@tiden/telemetry-browser?label=%40tiden%2Ftelemetry-browser)](https://www.npmjs.com/package/@tiden/telemetry-browser)
[![@tiden/telemetry-sourcemaps](https://img.shields.io/npm/v/@tiden/telemetry-sourcemaps?label=%40tiden%2Ftelemetry-sourcemaps)](https://www.npmjs.com/package/@tiden/telemetry-sourcemaps)
[![CI](https://github.com/qase-tms/tiden-telemetry-js/actions/workflows/ci.yml/badge.svg)](https://github.com/qase-tms/tiden-telemetry-js/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@tiden/telemetry-browser)](./LICENSE)

Capture uncaught exceptions, unhandled promise rejections, and manual errors in
the browser — and see fully readable stack traces, even for minified production
bundles. No runtime dependencies, tiny footprint, TypeScript-first.

## Packages

| Package | Version | Description |
|---|---|---|
| [`@tiden/telemetry-browser`](./browser) | [![npm](https://img.shields.io/npm/v/@tiden/telemetry-browser)](https://www.npmjs.com/package/@tiden/telemetry-browser) | Browser error-tracking SDK |
| [`@tiden/telemetry-sourcemaps`](./sourcemaps) | [![npm](https://img.shields.io/npm/v/@tiden/telemetry-sourcemaps)](https://www.npmjs.com/package/@tiden/telemetry-sourcemaps) | Build-time source-map upload plugin (Vite / webpack / Rollup / esbuild) |

## Quick start

```bash
npm install @tiden/telemetry-browser
```

```ts
import { Tiden } from '@tiden/telemetry-browser'

Tiden.init({
  dsn: '<your-dsn>',          // from your Tiden project settings
  release: 'my-app@1.2.3',
  environment: 'production',
})
```

Uncaught errors and unhandled promise rejections are now reported automatically.
Capture manually whenever you need to:

```ts
try {
  checkout()
} catch (err) {
  Tiden.captureException(err)
}

Tiden.captureMessage('payment retried', 'info')
```

## Readable production stack traces

Minified bundles produce unreadable traces. Add the build plugin to upload source
maps so traces resolve back to your original code:

```bash
npm install -D @tiden/telemetry-sourcemaps
```

```ts
// vite.config.ts
import { tidenSourceMaps } from '@tiden/telemetry-sourcemaps'

export default {
  build: { sourcemap: true },
  plugins: [tidenSourceMaps.vite({ /* ...options */ })],
}
```

See [`@tiden/telemetry-sourcemaps`](./sourcemaps) for webpack/Rollup/esbuild and all options.

## Documentation

- [`@tiden/telemetry-browser`](./browser) — configuration, API, and capture options
- [`@tiden/telemetry-sourcemaps`](./sourcemaps) — bundler setup and options
- [tiden.ai](https://tiden.ai)

## Contributing

Bug reports and feature requests are welcome via the
[issue tracker](https://github.com/qase-tms/tiden-telemetry-js/issues). For larger changes,
please open an issue to discuss first.

## Releasing

Each package is versioned **independently** — `@tiden/telemetry-browser` and
`@tiden/telemetry-sourcemaps` have separate version lines.

Publishing is automatic: the [`Publish`](./.github/workflows/publish.yml)
workflow runs on every push to `main` and publishes a package to npm **when its
`package.json` version differs from what is already on npm** (OIDC trusted
publishing + provenance — no `NPM_TOKEN`, no git tags to manage). So a release
is just a version bump that lands on `main`.

To cut a release:

1. Bump the version in that package's `package.json`, e.g. from `browser/`:
   ```bash
   npm version patch --no-git-tag-version   # or minor / major (semver)
   ```
2. **Put the new version in the PR/commit title**, e.g.
   `browser: serialize non-Error throws (0.1.5)` — matching the existing
   `… (0.1.4)` / `… (0.1.5)` history. There is no separate "release" workflow, so
   the version marker is what makes a release identifiable at a glance in the
   [Actions](https://github.com/qase-tms/tiden-telemetry-js/actions) list.
3. Merge to `main`. `Publish` builds, tests, and publishes; confirm with
   `npm view <package> version`.

For `@tiden/telemetry-browser`, keep the SDK version string
(`SDK.version` in `browser/src/client.ts`, reported on every event as
`sdk.version`) in sync with `browser/package.json` — `sdk-version.test.ts`
fails the build if they drift.

## Maintenance

Actively maintained by the Tiden team.

## License

[MIT](./LICENSE)
