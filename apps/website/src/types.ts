import type { App } from 'vue'
import type { Router, RouteRecordRaw } from 'vue-router'

export type UserModule = (ctx: {
  isClient: boolean
  route: RouteRecordRaw[]
  router: Router
  app: App<Element>
}) => void

export interface AvatarUploaderExpose {
  upload: () => Promise<boolean>
}

export interface Corp {
  address_ver: number
  avatar: string
  created: number
  creator: number
  dept_cnt: number
  device_cnt: number
  device_ver: number
  group_cnt: number
  group_ver: number
  intro: string
  member_cnt: number
  name: string
  num: number
  vip: number
  vip_expired: number
}

export interface SelfInfo {
  user_id: number
  user_num: string
  job_num: string
  sex: number
  name: string
  avatar: string
  is_dept_admin: number
  dept_id: number
  phone: string
  country_code: string
  state: number
  type: number
  tts: number
  loc_share: number
  track: number
  group_count: number
  created: number
  bind_phone: number
}
