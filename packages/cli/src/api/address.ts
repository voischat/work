import type { WeilaApi } from '@wl/network'
import type { DeptModel, Member } from './types.js'

export async function getMyManageDeptList(api: WeilaApi, deptId?: number): Promise<{ depts: DeptModel[], count: number }> {
  return api.v2.fetch('corp/address/get-my-manage-dept-list', { body: deptId === undefined ? {} : { dept_id: deptId } })
}

export async function getMyManageAllDept(api: WeilaApi): Promise<Array<DeptModel & { parent_id?: number }>> {
  return api.v2.fetch('corp/address/get-my-manage-all-dept', {})
}

export async function getAllDept(api: WeilaApi): Promise<DeptModel[]> {
  return api.v2.fetch('corp/address/get-all-dept', {})
}

export interface MemberListFilters {
  key?: string
  member_types?: number[]
  dept_ids?: number[]
  page?: number
  size?: number
}

export async function getMemberList(api: WeilaApi, filters: MemberListFilters = {}): Promise<{ count: number, members: Member[] }> {
  return api.v2.fetch(`corp/address/get-member-list?page=${filters.page ?? 0}&size=${filters.size ?? 20}`, { body: filters })
}

export async function getDeptMemberList(api: WeilaApi, deptId: number, filters: Omit<MemberListFilters, 'dept_ids'> = {}): Promise<{ count: number, members: Member[] }> {
  return api.v2.fetch(`corp/address/get-dept-member-list?page=${filters.page ?? 0}&size=${filters.size ?? 20}`, { body: { ...filters, dept_id: deptId } })
}

export async function getDeptAllMember(api: WeilaApi, deptId: number): Promise<Member[]> {
  return api.v2.fetch('corp/address/get-dept-all-member', { body: { dept_id: deptId } })
}

export async function getMember(api: WeilaApi, memberId: number): Promise<Member> {
  return api.v2.fetch('corp/address/get-member', { body: { member_id: memberId } })
}

export interface CreateMemberPayload {
  name: string
  phone?: string
  password: string
  job_num?: string
  dept_id?: number
  sex?: number
  avatar?: string
  is_dept_admin?: number
  loc_share?: number
  track?: number
}

export async function createMember(api: WeilaApi, payload: CreateMemberPayload): Promise<void> {
  await api.v2.fetch('corp/address/create-member', { body: payload })
}

export interface ChangeMemberPayload {
  user_id: number
  name?: string
  job_num?: string
  dept_id?: number
  sex?: number
  avatar?: string
  phone?: string
  is_dept_admin?: number
  loc_share?: number
  track?: number
}

export async function changeMember(api: WeilaApi, payload: ChangeMemberPayload): Promise<void> {
  await api.v2.fetch('corp/address/change-member', { body: payload })
}

export interface ChangeMemberStatePayload {
  user_id: number
  state: 0 | 1
}

export async function changeMemberState(api: WeilaApi, payload: ChangeMemberStatePayload): Promise<{ state: 0 | 1 }> {
  return api.v2.fetch('corp/address/change-member-state', { body: payload })
}

export interface DeleteMemberPayload {
  user_id: number
}

export async function deleteMember(api: WeilaApi, payload: DeleteMemberPayload): Promise<void> {
  await api.v2.fetch('corp/address/delete-member', { body: payload })
}

export interface AddDeptMembersPayload {
  dept_id: number
  user_ids: number[]
}

export async function addDeptMembers(api: WeilaApi, payload: AddDeptMembersPayload): Promise<void> {
  await api.v2.fetch('corp/address/add-dept-members', { body: payload })
}

export interface CreateDeptPayload {
  name: string
}

export async function createDept(api: WeilaApi, payload: CreateDeptPayload): Promise<void> {
  await api.v2.fetch('corp/address/create-dept', { body: payload })
}

export interface ChangeDeptPayload {
  dept_id: number
  name: string
}

export async function changeDept(api: WeilaApi, payload: ChangeDeptPayload): Promise<void> {
  await api.v2.fetch('corp/address/change-dept', { body: payload })
}

export interface DeleteDeptPayload {
  dept_id: number
}

export async function deleteDept(api: WeilaApi, payload: DeleteDeptPayload): Promise<void> {
  await api.v2.fetch('corp/address/delete-dept', { body: payload })
}

export interface AddDevicePayload {
  name: string
  verifycode: string
  job_num?: string
  dept_id?: number
  sex?: number
  avatar?: string
  phone?: string
  loc_share?: number
  track?: number
}

export async function addDevice(api: WeilaApi, payload: AddDevicePayload): Promise<void> {
  await api.v2.fetch('corp/address/add-device', { body: payload })
}

export interface ResetMemberPasswordPayload {
  user_id: number
  password: string
}

export async function resetMemberPassword(api: WeilaApi, payload: ResetMemberPasswordPayload): Promise<void> {
  await api.v2.fetch('corp/address/reset-member-password', { body: payload })
}
