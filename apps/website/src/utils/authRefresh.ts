export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

interface RefreshLock {
  request: <T>(name: string, callback: () => Promise<T>) => Promise<T>
}

export interface RefreshDeps {
  storage: Pick<Storage, 'getItem'>
  fetch: typeof fetch
  now: () => number
  buildUrl: () => Promise<string>
  locks?: RefreshLock
}

export interface RefreshResult {
  tokens: AuthTokens
  loginTime: number
}

const AUTH_REFRESH_LOCK = 'weila-auth-refresh'

class RefreshFailure extends Error {
  readonly definitive: boolean

  constructor(message: string, definitive: boolean) {
    super(message)
    this.name = 'RefreshFailure'
    this.definitive = definitive
  }
}

export function isDefinitiveRefreshFailure(error: unknown): boolean {
  return error instanceof RefreshFailure && error.definitive
}

export function needsRefresh(loginTime: number, expiresIn: number, now: number): boolean {
  return loginTime + (expiresIn / 2) * 1000 < now
}

function readNumber(storage: Pick<Storage, 'getItem'>, key: string, fallback: number): number {
  const raw = storage.getItem(key)

  if (raw === null || raw === '')
    return fallback

  const value = Number(raw)

  return Number.isFinite(value)
    ? value
    : fallback
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error)
}

export async function requestAuthRefresh(deps: RefreshDeps): Promise<AuthTokens> {
  const refreshToken = deps.storage.getItem('refresh_token') ?? ''

  if (!refreshToken)
    throw new RefreshFailure('missing refresh token', true)

  let url: string

  try {
    url = await deps.buildUrl()
  }
  catch (error) {
    throw new RefreshFailure(errorMessage(error), false)
  }

  let response: Response

  try {
    response = await deps.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  }
  catch (error) {
    throw new RefreshFailure(errorMessage(error), false)
  }

  if (!response.ok) {
    const definitive
      = response.status === 400 || response.status === 401 || response.status === 403
    throw new RefreshFailure(`refresh failed with HTTP ${response.status}`, definitive)
  }

  let payload: { data?: AuthTokens, errcode?: number }

  try {
    payload = await response.json()
  }
  catch (error) {
    throw new RefreshFailure(errorMessage(error), false)
  }

  if (payload.errcode !== 0 || !payload.data) {
    throw new RefreshFailure(`refresh failed with errcode ${payload.errcode}`, true)
  }

  return payload.data
}

export async function refreshAuth(deps: RefreshDeps): Promise<RefreshResult> {
  const perform = async (): Promise<RefreshResult> => {
    const token = deps.storage.getItem('token') ?? ''
    const loginTime = readNumber(deps.storage, 'login_time', 0)
    const expiresIn = readNumber(deps.storage, 'expires_in', 0)

    if (token && !needsRefresh(loginTime, expiresIn, deps.now())) {
      return {
        tokens: {
          access_token: token,
          refresh_token: deps.storage.getItem('refresh_token') ?? '',
          expires_in: expiresIn,
        },
        loginTime,
      }
    }

    return {
      tokens: await requestAuthRefresh(deps),
      loginTime: deps.now(),
    }
  }

  if (deps.locks)
    return deps.locks.request(AUTH_REFRESH_LOCK, perform)

  return perform()
}
