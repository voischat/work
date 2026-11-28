import type { RefreshDeps } from './authRefresh'
import { describe, expect, it, vi } from 'vitest'
import {
  isDefinitiveRefreshFailure,
  needsRefresh,
  refreshAuth,
  requestAuthRefresh,
} from './authRefresh'

const NOW = 1_700_000_000_000
const REFRESH_URL = 'https://api.example.com/v2/corp/auth/refresh'
const STORED_REFRESH = 'stored-refresh-token'
const OTHER_ACCESS = 'other-access-token'
const OTHER_REFRESH = 'other-refresh-token'

function makeStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))

  return {
    getItem: (key: string) => values.get(key) ?? null,
    set: (key: string, value: string) => values.set(key, value),
  }
}

function makeDeps(
  storage: ReturnType<typeof makeStorage>,
  fetchImpl: typeof fetch,
  overrides: Partial<RefreshDeps> = {},
): RefreshDeps {
  return {
    storage,
    fetch: fetchImpl,
    now: () => NOW,
    buildUrl: async () => REFRESH_URL,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const TOKENS = {
  access_token: 'new-access-token',
  refresh_token: 'new-refresh-token',
  expires_in: 7200,
}

describe('needsRefresh', () => {
  it('refreshes after half of the lifetime', () => {
    expect(needsRefresh(1_000_000, 100, 1_049_999)).toBe(false)
    expect(needsRefresh(1_000_000, 100, 1_050_001)).toBe(true)
  })
})

describe('requestAuthRefresh', () => {
  it('returns the new tokens', async () => {
    const storage = makeStorage({ refresh_token: STORED_REFRESH })
    const fetchMock = vi.fn(async () => jsonResponse({ errcode: 0, data: TOKENS }))

    await expect(requestAuthRefresh(makeDeps(storage, fetchMock))).resolves.toEqual(TOKENS)
    expect(fetchMock).toHaveBeenCalledWith(
      REFRESH_URL,
      expect.objectContaining({
        body: JSON.stringify({ refresh_token: STORED_REFRESH }),
      }),
    )
  })

  it('treats a rejected grant as definitive', async () => {
    const storage = makeStorage({ refresh_token: STORED_REFRESH })
    const fetchMock = vi.fn(async () => jsonResponse({ errcode: 40101, data: null }))

    await expect(requestAuthRefresh(makeDeps(storage, fetchMock))).rejects.toMatchObject({
      definitive: true,
    })
  })

  it('treats HTTP 401 as definitive and a server error as transient', async () => {
    const storage = makeStorage({ refresh_token: STORED_REFRESH })
    const unauthorized = vi.fn(async () => new Response('', { status: 401 }))
    const unavailable = vi.fn(async () => new Response('', { status: 503 }))

    await expect(
      requestAuthRefresh(makeDeps(storage, unauthorized)),
    ).rejects.toMatchObject({ definitive: true })
    await expect(
      requestAuthRefresh(makeDeps(storage, unavailable)),
    ).rejects.toMatchObject({ definitive: false })
  })

  it('treats a network failure as transient', async () => {
    const storage = makeStorage({ refresh_token: STORED_REFRESH })
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })

    const error = await requestAuthRefresh(makeDeps(storage, fetchMock)).catch(value => value)

    expect(error).toBeInstanceOf(Error)
    expect(isDefinitiveRefreshFailure(error)).toBe(false)
  })

  it('fails definitively when the refresh token is gone', async () => {
    const storage = makeStorage()
    const fetchMock = vi.fn(async () => jsonResponse({ errcode: 0, data: TOKENS }))

    await expect(
      requestAuthRefresh(makeDeps(storage, fetchMock)),
    ).rejects.toMatchObject({ definitive: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('refreshAuth', () => {
  it('reuses the stored token when it is still fresh', async () => {
    const storage = makeStorage({
      token: 'stored-access-token',
      refresh_token: STORED_REFRESH,
      expires_in: '7200',
      login_time: String(NOW),
    })
    const fetchMock = vi.fn(async () => jsonResponse({ errcode: 0, data: TOKENS }))

    await expect(refreshAuth(makeDeps(storage, fetchMock))).resolves.toEqual({
      tokens: {
        access_token: 'stored-access-token',
        refresh_token: STORED_REFRESH,
        expires_in: 7200,
      },
      loginTime: NOW,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('adopts a token another tab refreshed while waiting for the lock', async () => {
    const storage = makeStorage({
      token: 'old-access-token',
      refresh_token: 'old-refresh-token',
      expires_in: '7200',
      login_time: String(NOW - 10_000_000),
    })
    const fetchMock = vi.fn(async () => jsonResponse({ errcode: 0, data: TOKENS }))
    const locks = {
      request: async <T>(_name: string, callback: () => Promise<T>): Promise<T> => {
        storage.set('token', OTHER_ACCESS)
        storage.set('refresh_token', OTHER_REFRESH)
        storage.set('expires_in', '7200')
        storage.set('login_time', String(NOW))

        return callback()
      },
    }

    await expect(refreshAuth(makeDeps(storage, fetchMock, { locks }))).resolves.toEqual({
      tokens: {
        access_token: OTHER_ACCESS,
        refresh_token: OTHER_REFRESH,
        expires_in: 7200,
      },
      loginTime: NOW,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
