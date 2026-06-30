import { WeilaApi } from '@wl/network'
import type { Storage } from 'unstorage'
import { createProfileStorage, DEFAULT_APP_ID, DEFAULT_APP_KEY, DEFAULT_BASE_URL, loadProfileConfig } from './config.js'

const APP_NAME = 'weila-work-cli'

export interface ClientBundle {
  api: WeilaApi
  storage: Storage
}

export interface ClientOptions {
  profile?: string
  baseURL?: string
  appId?: string
  appKey?: string
}

export async function createClient(options: ClientOptions = {}): Promise<ClientBundle> {
  const profile = options.profile ?? 'default'
  const profileConfig = loadProfileConfig(profile)

  const baseURL = options.baseURL ?? profileConfig.baseURL ?? DEFAULT_BASE_URL
  const appId = options.appId ?? profileConfig.appId ?? DEFAULT_APP_ID
  const appKey = options.appKey ?? profileConfig.appKey ?? DEFAULT_APP_KEY

  const storage = createProfileStorage(profile)

  const api = new WeilaApi(APP_NAME, appId, appKey, {
    baseURL,
    storage,
  })

  return { api, storage }
}

let cachedClient: ClientBundle | undefined
let cachedKey: string | undefined

export async function getClient(options: ClientOptions = {}): Promise<ClientBundle> {
  const key = `${options.profile ?? 'default'}:${options.baseURL ?? ''}:${options.appId ?? ''}`
  if (cachedClient && cachedKey === key)
    return cachedClient

  cachedClient = await createClient(options)
  cachedKey = key
  return cachedClient
}

export function clearClientCache(): void {
  cachedClient = undefined
  cachedKey = undefined
}
