import type { WeilaApi } from '@wl/network'
import type { GroupModel, Member } from './types.js'

export interface GroupListFilters {
  page?: number
  size?: number
}

export async function getMyManageGroupList(api: WeilaApi, filters: GroupListFilters = {}): Promise<{ groups: GroupModel[], count: number }> {
  return api.v2.fetch(`corp/group/get-my-manage-group-list?page=${filters.page ?? 0}&size=${filters.size ?? 20}`, {})
}

export async function getGroup(api: WeilaApi, groupId: number): Promise<GroupModel> {
  return api.v2.fetch('corp/group/get-group', { body: { group_id: groupId } })
}

export async function getGroupAllMember(api: WeilaApi, groupId: number): Promise<Member[]> {
  return api.v2.fetch('corp/group/get-group-all-member', { body: { group_id: groupId } })
}

export interface GroupMemberListFilters {
  page?: number
  size?: number
}

export async function getGroupMemberList(api: WeilaApi, groupId: number, filters: GroupMemberListFilters = {}): Promise<{ count: number, members: Member[] }> {
  return api.v2.fetch(`corp/group/get-group-member-list?page=${filters.page ?? 0}&size=${filters.size ?? 20}`, { body: { group_id: groupId } })
}

export interface CreateGroupPayload {
  name: string
  dept_id?: number
  burst_mode?: 0 | 1
  avatar?: string
}

export async function createGroup(api: WeilaApi, payload: CreateGroupPayload): Promise<void> {
  await api.v2.fetch('corp/group/create-group', { body: payload })
}

export interface ChangeGroupPayload {
  group_id: number
  name?: string
  burst_mode?: 0 | 1
  avatar?: string
}

export async function changeGroup(api: WeilaApi, payload: ChangeGroupPayload): Promise<void> {
  await api.v2.fetch('corp/group/change-group', { body: payload })
}

export interface DeleteGroupPayload {
  group_id: number
}

export async function deleteGroup(api: WeilaApi, payload: DeleteGroupPayload): Promise<void> {
  await api.v2.fetch('corp/group/delete-group', { body: payload })
}

export interface AddGroupMembersPayload {
  group_id: number
  user_ids: number[]
}

export async function addGroupMembers(api: WeilaApi, payload: AddGroupMembersPayload): Promise<void> {
  await api.v2.fetch('corp/group/add-group-members', { body: payload })
}

export interface DeleteGroupMemberPayload {
  group_id: number
  user_id: number
}

export async function deleteGroupMember(api: WeilaApi, payload: DeleteGroupMemberPayload): Promise<void> {
  await api.v2.fetch('corp/group/delete-group-member', { body: payload })
}
