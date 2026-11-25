const MAX_RETRIES = 3

export function shouldRetryQuery(failCount: number, error: unknown): boolean {
  if (failCount >= MAX_RETRIES)
    return false

  if (hasHttpResponse(error))
    return false

  return parseErrcode(error) === undefined
}

function hasHttpResponse(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('response' in error))
    return false

  const { response } = error as { response?: { status?: unknown } }
  return typeof response?.status === 'number'
}

function parseErrcode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('message' in error))
    return undefined

  const { message } = error as { message?: unknown }
  if (typeof message !== 'string')
    return undefined

  try {
    const parsed = JSON.parse(message)
    return typeof parsed?.errcode === 'number'
      ? parsed.errcode
      : undefined
  }
  catch {
    return undefined
  }
}
