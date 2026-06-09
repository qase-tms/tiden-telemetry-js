# @tiden/browser

[![npm](https://img.shields.io/npm/v/@tiden/browser)](https://www.npmjs.com/package/@tiden/browser)
[![downloads](https://img.shields.io/npm/dm/@tiden/browser)](https://www.npmjs.com/package/@tiden/browser)
[![license](https://img.shields.io/npm/l/@tiden/browser)](https://github.com/qase-tms/tiden-js/blob/main/LICENSE)

Error-tracking SDK for browser apps. Automatically captures uncaught exceptions
and unhandled promise rejections, lets you capture errors and messages manually,
and reports them to your [Tiden](https://tiden.ai) project. **Zero runtime
dependencies**, TypeScript-first, tiny.

## Install

```bash
npm install @tiden/browser
```

## Quick start

```ts
import { Tiden } from '@tiden/browser'

Tiden.init({
  dsn: '<your-dsn>',          // from your Tiden project settings
  release: 'my-app@1.2.3',
  environment: 'production',
})
```

That's it — uncaught errors and unhandled rejections are now reported.

## Capturing

```ts
// exceptions
try {
  risky()
} catch (err) {
  Tiden.captureException(err)
}

// messages
Tiden.captureMessage('checkout completed', 'info')

// context attached to subsequent events
Tiden.setUser({ id: 'u_123', email: 'a@b.com' })
Tiden.setTag('plan', 'pro')
```

## Configuration

`Tiden.init(options)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `dsn` | `string` | — | **Required.** Your project DSN. |
| `release` | `string` | — | App version, e.g. `my-app@1.2.3`. |
| `environment` | `string` | — | e.g. `production`, `staging`. |
| `sendDefaultPii` | `boolean` | `false` | Send likely-PII. Off by default — common PII is scrubbed before sending. |
| `beforeSend` | `(event) => event \| null` | — | Inspect, mutate, or drop an event. Return `null` to drop it. |
| `denyUrls` | `(string \| RegExp)[]` | — | Drop errors whose top stack frame URL matches. |
| `maxBreadcrumbs` | `number` | `100` | Size of the breadcrumb ring buffer. |
| `maxEventsPerPage` | `number` | — | Cap events sent per page load (error-storm guard). |

## API

| Method | Description |
|---|---|
| `Tiden.init(options)` | Initialize once at app startup. |
| `Tiden.captureException(error)` | Report an exception. |
| `Tiden.captureMessage(message, level?)` | Report a message (`info`, `warning`, `error`, …). |
| `Tiden.setUser(user \| null)` | Attach or clear user context. |
| `Tiden.setTag(key, value)` | Attach a searchable tag. |

## Readable production stack traces

Minified bundles produce unreadable traces. Pair this with
[`@tiden/sourcemaps`](https://github.com/qase-tms/tiden-js/tree/main/sourcemaps)
to upload source maps at build time so traces resolve back to your original code.

## License

[MIT](https://github.com/qase-tms/tiden-js/blob/main/LICENSE)
