import type { DefaultError } from '@tanstack/vue-query'
import { useMutation } from '@tanstack/vue-query'
import { useWeilaApi } from './useWeilaApi'

export function useWeilaMutation<TData = unknown, TVar = any>(
  url: string,
  options: any = {},
) {
  const weilaApi = useWeilaApi()

  return useMutation<TData, DefaultError, TVar>({
    mutationKey: [url],
    mutationFn: (body: any) => weilaApi.value.v2.fetch(url, {
      body,
    }),
    ...options,
  })
}
