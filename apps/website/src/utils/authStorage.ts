export const AUTH_STORAGE_KEYS = [
  'token',
  'refresh_token',
  'expires_in',
  'login_time',
  'auto_login',
] as const

export function clearAuthStorage(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  for (const key of AUTH_STORAGE_KEYS)
    storage.removeItem(key)
}
