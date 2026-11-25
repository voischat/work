import { useWeilaApi } from '~/composables/useWeilaApi'

export function weilaFetch<T = unknown>(url: string, options?: Record<string, any>): Promise<T> {
  return useWeilaApi().value.v1.fetch<T>(url, options)
}
