import type { UseQueryOptions } from '@tanstack/vue-query'
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import { shouldRetryQuery } from '~/utils/queryRetry'
import { pickFromResponse } from '~/utils/response'
import { useWeilaApi } from './useWeilaApi'

export function useWeilaFetch<T>(
  url: MaybeRefOrGetter<string>,
  options?: {
    body?: MaybeRefOrGetter<RequestInit['body'] | Record<string, any>>
    method?: string
    pick?: string[]
  },
  tanstackOptions?: Omit<UseQueryOptions<T>, 'queryKey'>,
) {
  const { body, method = 'POST', pick } = toValue(options) || {}

  const weilaApi = useWeilaApi()
  const requestUrl = () => toValue(url).replace(/^\/+/, '')

  const res = useQuery<T>({
    queryKey: [requestUrl, body, method],
    queryFn: () => weilaApi.value.v2.fetch(requestUrl(), {
      body: toValue(body),
      method,
    }),
    retry: (failCount, error) => shouldRetryQuery(failCount, error),
    refetchOnWindowFocus: false,
    ...tanstackOptions,
  })

  return {
    ...res,
    data: computed(() => pickFromResponse(res.data.value, pick)) as ComputedRef<T>,
  }
}
