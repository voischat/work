import type { UserModule } from '~/types'
import { Message } from '@arco-design/web-vue'
import { until } from '@vueuse/core'
import { i18n } from '~/modules/i18n'
import { useAuthStore } from '~/stores/auth'
import { isPathVipGated } from '~/utils/vipGate'

const VIP_QUERY_TIMEOUT = 8000

export const install: UserModule = ({ app, router }) => {
  router.beforeEach(async (to, _, next) => {
    const isProduction = import.meta.env.PROD

    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream
    const isAndroid = /android/i.test(userAgent)
    const isMobileDevice = isIOS || isAndroid

    const isMobilePage = to.path === '/mobile'

    if (isProduction && isMobileDevice && !isMobilePage) {
      next({ path: '/mobile', replace: true })
      return
    }

    const requiresAuth = to.meta.requiresAuth ?? true

    if (requiresAuth && !localStorage.getItem('token')) {
      next({ name: '/login/', replace: true })
    }
    else if (!requiresAuth || to.path === '/contact/org') {
      next()
    }
    else {
      const authStore = app.runWithContext(() => useAuthStore())
      await until(() => authStore.vip !== undefined).toBeTruthy({ timeout: VIP_QUERY_TIMEOUT })
      if (isPathVipGated(to.path, authStore.vip, to.meta.vip)) {
        Message.warning(i18n.global.t('tooltips.vip-unsupported'))
        next({ path: '/contact/org', replace: true })
        return
      }
      next()
    }
  })
}
