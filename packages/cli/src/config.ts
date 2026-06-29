import { createStorage } from 'unstorage'
import fsLiteDriver from 'unstorage/drivers/fs-lite'
import type { Storage } from 'unstorage'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export const DEFAULT_BASE_URL = 'https://voiswork.cn/v2'
export const DEFAULT_APP_ID = '102065'
export const DEFAULT_APP_KEY = '3c227f2cbc2084ebdd9617fd283c42c7'
export const APP_NAME = 'weila-work-cli'

export interface ProfileConfig {
  baseURL?: string
  appId?: string
  appKey?: string
}

function getConfigHome(): string {
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
}

export function getConfigDir(): string {
  return join(getConfigHome(), APP_NAME)
}

export function getProfileStorageDir(profile: string = 'default'): string {
  return join(getConfigDir(), 'profiles', profile)
}

export function getConfigPath(profile: string = 'default'): string {
  return join(getProfileStorageDir(profile), 'config.json')
}

export function ensureConfigDir(): void {
  mkdirSync(getConfigDir(), { recursive: true })
}

export function loadProfileConfig(profile: string = 'default'): ProfileConfig {
  const path = getConfigPath(profile)
  if (!existsSync(path))
    return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ProfileConfig
  }
  catch {
    return {}
  }
}

export function saveProfileConfig(profile: string = 'default', cfg: ProfileConfig): void {
  const path = getConfigPath(profile)
  ensureConfigDir()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(cfg, null, 2))
}

export function createProfileStorage(profile: string = 'default'): Storage {
  const base = getProfileStorageDir(profile)
  ensureConfigDir()
  mkdirSync(base, { recursive: true })
  return createStorage({
    driver: fsLiteDriver({ base }),
  })
}
