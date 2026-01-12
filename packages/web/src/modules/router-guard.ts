import type { UserModule } from '~/types'

export const install: UserModule = ({ router }) => {
  router.beforeEach((to, _, next) => {
    // Check if production environment
    const isProduction = import.meta.env.PROD

    // Check if iOS or Android device
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream
    const isAndroid = /android/i.test(userAgent)
    const isMobileDevice = isIOS || isAndroid

    // Check if already on mobile page to avoid infinite redirect
    const isMobilePage = to.path === '/mobile'

    // In production, redirect mobile devices to /mobile page
    if (isProduction && isMobileDevice && !isMobilePage) {
      next({ path: '/mobile', replace: true })
      return
    }

    const requiresAuth = to.meta.requiresAuth ?? true

    // loop issue
    if (requiresAuth && !localStorage.getItem('token')) {
      next({ name: '/login/', replace: true })
    }
    else {
      // Proceed to the requested route
      next()
    }
  })
}
