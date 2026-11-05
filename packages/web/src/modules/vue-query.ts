import type { UserModule } from '~/types'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { shouldRetryQuery } from '~/utils/queryRetry'

export const install: UserModule = ({ app }) => {
  app.use(VueQueryPlugin, {
    queryClientConfig: {
      defaultOptions: {
        queries: {
          retry: shouldRetryQuery,
          refetchOnWindowFocus: false,
        },
      },
    },
  })
}
