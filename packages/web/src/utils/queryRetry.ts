const MAX_RETRIES = 3

export function shouldRetryQuery(failCount: number, error: unknown): boolean {
  if (failCount > MAX_RETRIES)
    return false

  // A business error is deterministic: retrying it cannot succeed and only
  // repeats the global error toast once per attempt.
  return parseErrcode(error) === undefined
}

/**
 * The request layer throws `new Error(JSON.stringify({ errcode, errmsg }))`
 * for business errors, so the code lives in the message string rather than
 * on the error object.
 */
function parseErrcode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('message' in error))
    return undefined

  const { message } = error as { message?: unknown }
  if (typeof message !== 'string')
    return undefined

  try {
    const parsed = JSON.parse(message)
    return typeof parsed?.errcode === 'number' ? parsed.errcode : undefined
  }
  catch {
    return undefined
  }
}
