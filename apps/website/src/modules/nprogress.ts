import type { UserModule } from '~/types'
import NProgress from 'nprogress'

import 'nprogress/nprogress.css'

export const install: UserModule = ({ isClient, router }) => {
  if (isClient) {
    NProgress.configure({ showSpinner: false })
    router.beforeEach((to, from) => {
      if (to.path !== from.path)
        NProgress.start()
    })
    router.afterEach(() => {
      NProgress.done()
    })
  }
}
