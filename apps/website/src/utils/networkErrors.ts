interface ResponseInterceptorManager {
  handlers?: Array<{ rejected?: (error: unknown) => unknown }>
}

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

export function isHttpResponseContext(error: unknown): boolean {
  if (!error || typeof error !== 'object' || error instanceof Error)
    return false

  const { response } = error as { response?: { status?: unknown } }
  return typeof response?.status === 'number'
}
