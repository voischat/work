import { describe, expect, it } from 'vitest'
import { AUTH_STORAGE_KEYS, clearAuthStorage } from './authStorage'

describe('clearAuthStorage', () => {
  it('removes every auth key', () => {
    const store = new Map<string, string>(AUTH_STORAGE_KEYS.map(key => [key, 'value']))

    clearAuthStorage({
      removeItem: (key) => {
        store.delete(key)
      },
    })

    expect(store.size).toBe(0)
  })
})
