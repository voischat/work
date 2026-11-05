interface ResponseInterceptorManager {
  handlers?: Array<{ rejected?: (error: unknown) => unknown }>
}

/**
 * `@vois/weila-network@0.0.7` reports axios errors through its rejection
 * interceptor and then returns, so callers receive `undefined`. Re-throw after
 * the interceptor has reported the error.
 */
export function rethrowAxiosErrors(request: { interceptors: { response: unknown } }) {
  const manager = request.interceptors.response as ResponseInterceptorManager

  for (const handler of manager.handlers ?? []) {
    if (!handler.rejected)
      continue

    const report = handler.rejected
    handler.rejected = async (error: unknown) => {
      await report(error)
      throw error
    }
  }
}

/**
 * The same package throws the ofetch context for HTTP 4xx/5xx before its
 * response hook runs. A context is a plain object with a numeric response
 * status, unlike a business error or a transport error.
 */
export function isHttpResponseContext(error: unknown): boolean {
  if (!error || typeof error !== 'object' || error instanceof Error)
    return false

  const { response } = error as { response?: { status?: unknown } }
  return typeof response?.status === 'number'
}
