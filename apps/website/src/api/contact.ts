export interface DeptModel {
  id: number
  name: string
  user_count: number
}

type BurstMode = 0 | 1 | 2

export interface GroupModel {
  id: number
  dept_id: number
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

export enum TrackType {
  Close,
  Low,
  Medium,
  High,
  Fast,
}
