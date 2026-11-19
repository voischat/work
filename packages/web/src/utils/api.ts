import { useWeilaApi } from '~/composables/useWeilaApi'

/**
 * Compatibility surface for the legacy v1 pages. The original module was
 * removed in 134ad58 while these call sites remained.
 */
export function weilaFetch<T = unknown>(url: string, options?: Record<string, any>): Promise<T> {
  return useWeilaApi().value.v1.fetch<T>(url, options)
}
