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
  const requestPath = () => requestUrl().split('?')[0]
  const requestParams = () => requestUrl().split('?')[1] ?? ''
  const requestBody = () => toValue(body)

  const res = useQuery<T>({
    queryKey: computed(() => [
      requestPath(),
      requestParams(),
      requestBody(),
      method,
    ]),
    queryFn: () => weilaApi.value.v2.fetch(requestUrl(), {
      body: requestBody(),
      method,
    }),
    retry: (failCount, error) => shouldRetryQuery(failCount, error),
    refetchOnWindowFocus: false,
    ...tanstackOptions,
  })

  return {
    data: computed(() => pickFromResponse(res.data.value, pick)),
    error: res.error,
    isError: res.isError,
    isFetched: res.isFetched,
    isFetching: res.isFetching,
    isLoading: res.isLoading,
    isPending: res.isPending,
    isSuccess: res.isSuccess,
    refetch: res.refetch,
    status: res.status,
  }
}
