export interface AuthModel {
  access_token: string
  expires_in: number
  refresh_token: string
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

export interface VipInfo {
  vip: number
  vip_name: string
  vip_expired: number
  vip_created: number
  vip_supports: VipSupport[]
}

export interface VipSupport {
  member_limit?: number
  name: string
  support: boolean
  dept_limit?: number
  dept_member_limit?: number
  group_limit?: number
  group_member_limit?: number
  device_limit?: number
  type?: number
  quick_support?: boolean
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

export interface DeptModel {
  id: number
  name: string
  user_count: number
}

export interface Member {
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
  grp_cnt: number
  grp_lmt: number
  online?: 0 | 1
  online_status?: 0 | 1
  product?: string
  imei?: string
}

export interface GroupModel {
  id: number
  name: string
  avatar: string
  creator: number
  type: number
  user_count: number
  member_version: number
  burst_mode: 0 | 1 | 2
  shutup: number
  created: number
}
