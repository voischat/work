import { useWeilaApi } from '~/composables/useWeilaApi'

/**
 * Compatibility surface for the legacy v1 pages. The original module was
 * removed in 134ad58 while these call sites remained.
 */
export function weilaFetch<T = unknown>(url: string, options?: Record<string, any>): Promise<T> {
  return useWeilaApi().value.v1.fetch<T>(url, options)
}

export const weilaRequest = {
  post: <T = unknown>(url: string, data?: unknown, config?: Record<string, any>) =>
    useWeilaApi().value.v1.request.post<T>(url, data, config),
}
