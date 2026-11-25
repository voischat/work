import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    layout?: string
    roles?: number[]
    name?: string
    requiresAuth?: boolean
    vip?: string
  }
}
