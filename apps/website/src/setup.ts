import type { Component } from 'vue'
import type { RouterOptions } from 'vue-router'
import type { UserModule } from './types'
import { isClient } from '@vueuse/core'
import { createApp } from 'vue'
import { createRouter } from 'vue-router'
import { handleHotUpdate } from 'vue-router/auto-routes'

export function setup(
  App: Component,
  routerOptions: RouterOptions,
  fn: UserModule,
  setupOptions?: { el: string },
) {
  const {
    el = '#app',
  } = setupOptions || {}

  const app = createApp(App)
  const router = createRouter(routerOptions)

  app.use(router)

  fn({
    app,
    router,
    // @ts-expect-error type error
    route: (routerOptions.routes || []),
    isClient,
  })

  app.mount(el)
  if (import.meta.hot)
    handleHotUpdate(router)
}
