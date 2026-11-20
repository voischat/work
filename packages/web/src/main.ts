import type { RouteRecordRaw } from 'vue-router'
import type { UserModule } from './types'
import { Notification } from '@arco-design/web-vue'
import { installWeilaAudioRuntimePatch } from '@vois/weila-sdk-core'
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
// Styles are imported via the Arco plugin.
// 样式通过 Arco 插件导入。
// https://arco.design/docs/designlab/use-theme-package
import '~/assets/style/global.less'
import 'cropperjs/dist/cropper.min.css'

import '~/styles/main.css'
import 'viewerjs/dist/viewer.css'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'

import '@vois/weila-sdk-ui/index.css'

installWeilaAudioRuntimePatch()

// workbench has no index page, but unplugin-vue-router still emits a shell route
// for the folder. Redirect it so the bare /workbench URL renders nothing.
const appRoutes: RouteRecordRaw[] = setupLayouts(routes).map(route =>
  route.path === '/workbench'
    ? { ...route, redirect: '/contact/org' } as RouteRecordRaw
    : route,
)

setup(
  // the root component
  App,
  // vue-router options
  {
    history: createWebHashHistory(),
    routes: appRoutes,
    scrollBehavior() {
      return { top: 0 }
    },
  },
  // function to have custom setups
  (ctx) => {
    const { app } = ctx
    createWeilaUi({ locale: 'zh-CN' }).install(app as any)

    // install all modules under `modules/`
    Object.values(import.meta.glob<{ install: UserModule }>('./modules/*.ts', { eager: true }))
      .forEach(i => i.install?.(ctx))

    // See: https://arco.design/vue/component/notification#API
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
