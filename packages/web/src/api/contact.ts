export interface DeptModel {
  id: number
  name: string
  user_count: number
}

export type BurstMode = 0 | 1 | 2

export interface GroupModel {
  id: number
  name: string
  avatar: string
  creator: number
  type: number
  user_count: number
  member_version: number
  burst_mode: BurstMode
  shutup: number
  created: number

}

export enum MemberType {
  User,
  Device,
  Owner = 255,
}

export enum TrackType {
  Close,
  Low,
  Medium,
  High,
  Fast,
}

export interface MemberModel {
  user_id: number
  dept_id: number
  country_code: string
  phone: string
  job_num: number
  type: MemberType
  tts: 0 | 1
  loc_share: 0 | 1
  track: TrackType
  state: 0 | 1
  created: number
  user_num: string
  sex: 0 | 1
  name: string
  avatar: string
  online: 0 | 1
  dept_name: string
}

export interface DepartmentModel {
  id: number
  name: string
  members: MemberModel[]
}
