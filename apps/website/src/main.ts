import type { UserModule } from './types'
import { Notification } from '@arco-design/web-vue'
import { createWeilaUi } from '@vois/weila-sdk-ui'
import * as v from 'valibot'
import { setupLayouts } from 'virtual:generated-layouts'
import { createWebHashHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from './App.vue'
import { vDisabled } from './directives/v-disabled'
import { vTips } from './directives/v-tips'

import { setup } from './setup'
import '@valibot/i18n/zh-CN'
// https://arco.design/docs/designlab/use-theme-package
import '~/assets/style/global.less'
import 'cropperjs/dist/cropper.min.css'

import '~/styles/main.css'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'

import '@vois/weila-sdk-ui/index.css'

setup(
  App,
  {
    history: createWebHashHistory(),
    routes: setupLayouts(routes),
    scrollBehavior() {
      return { top: 0 }
    },
  },
  (ctx) => {
    const { app } = ctx
    createWeilaUi({ locale: 'zh-CN' }).install(app as any)

    Object.values(import.meta.glob<{ install: UserModule }>('./modules/*.ts', { eager: true }))
      .forEach(i => i.install?.(ctx))

    Notification._context = app._context

    app.config.errorHandler = (error: any, instance, info) => {
      Notification.error({
        title: (error.message || error.stack)
          ? String(error?.message) + String(error?.stack)
          : String(error),
        content: info,
      })

      console.error('app error', [error, instance, info])
    }

    app.directive('disabled', vDisabled)
    app.directive('tips', vTips)
  },
)

v.setGlobalConfig({
  lang: 'zh-CN',
})
