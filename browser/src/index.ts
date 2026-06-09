import { Client } from './client.js'
import type { InitOptions } from './types.js'

export type { InitOptions, TidenEvent, Frame, Breadcrumb } from './types.js'
export { Client } from './client.js'

let client: Client | undefined

// Tiden is the public singleton API. No third-party error SDK anywhere in the consumer's
// code: `import { Tiden } from '@tiden/browser'; Tiden.init({ dsn })`.
export const Tiden = {
  init(opts: InitOptions): Client {
    client = new Client(opts)
    return client
  },
  captureException(err: unknown): void {
    client?.captureException(err)
  },
  captureMessage(message: string, level?: string): void {
    client?.captureMessage(message, level)
  },
  setUser(user: Record<string, unknown> | null): void {
    client?.setUser(user)
  },
  setTag(key: string, value: string): void {
    client?.setTag(key, value)
  },
}

export default Tiden
