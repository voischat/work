import type { CAC } from 'cac'
import type { ClientOptions } from '../client.js'

export interface GlobalCliOptions {
  profile?: string
  baseUrl?: string
  appId?: string
  appKey?: string
  json?: boolean
  debug?: boolean
}

export function resolveClientOptions(options: GlobalCliOptions): ClientOptions {
  return {
    profile: options.profile,
    baseURL: options.baseUrl,
    appId: options.appId,
    appKey: options.appKey,
  }
}

export function registerGlobalOptions(cli: CAC): void {
  cli
    .option('--profile <name>', 'Config profile', { default: 'default' })
    .option('--base-url <url>', 'API base URL')
    .option('--app-id <id>', 'App ID')
    .option('--app-key <key>', 'App Key')
    .option('--json', 'Output raw JSON (default)', { default: true })
    .option('--debug', 'Print debug information')
}
