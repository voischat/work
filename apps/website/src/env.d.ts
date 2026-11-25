/// <reference types="vite/client" />
/// <reference types="unplugin-vue-router/client" />

declare const __BUILD_TIME__: number

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, any>
  export default component
}
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_WEB_SOCK: string
}

interface EventTarget extends __EventTarget {
  value: any
}
