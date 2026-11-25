import type { Member } from '~/types/api'
import { useSessionStorage } from '@vueuse/core'
import { useWeilaApi } from '~/composables/useWeilaApi'

export function useUserInfoStore() {
  const membersMap = useSessionStorage<Map<number, Member>>('realtime-location-members', new Map())

  async function fetchDeptMembers(deptId: number): Promise<Member[]> {
    const weilaApi = useWeilaApi()

    try {
      const members = await weilaApi.value.v2.fetch<Member[]>('corp/address/get-dept-all-member', {
        body: { dept_id: deptId },
      })

      members.forEach((member) => {
        membersMap.value.set(member.user_id, member)
      })

      return members
    }
    catch (error) {
      console.error(`获取部门 ${deptId} 成员失败:`, error)
      return []
    }
  }

  async function fetchGroupMembers(groupId: number): Promise<Member[]> {
    const weilaApi = useWeilaApi()
    try {
      const members = await weilaApi.value.v2.fetch<Member[]>('corp/group/get-group-all-member', {
        body: { group_id: groupId },
      })

      members.forEach((member) => {
        membersMap.value.set(member.user_id, member)
      })
      return members
    }
    catch (error) {
      console.error(`获取群组 ${groupId} 成员失败:`, error)
      return []
    }
  }

  async function fetchMember(memberId: number): Promise<Member | null> {
    const weilaApi = useWeilaApi()
    try {
      const member = await weilaApi.value.v2.fetch<Member>('corp/address/get-member', {
        body: { member_id: memberId },
      })

      if (member) {
        membersMap.value.set(member.user_id, member)
      }

      return member
    }
    catch (error) {
      console.error(`获取成员 ${memberId} 失败:`, error)
      return null
    }
  }

  function getUserInfo(uid: number): Member | null {
    return membersMap.value.get(uid) || null
  }

  async function preloadMembers(type: 'dept' | 'group' | 'individual', id: number) {
    if (type === 'dept') {
      return await fetchDeptMembers(id)
    }
    else if (type === 'individual') {
      const member = await fetchMember(id)
      return member
        ? [member]
        : []
    }
    else {
      return await fetchGroupMembers(id)
    }
  }

  function clearCache() {
    membersMap.value.clear()
  }

  return {
    membersMap,

    fetchDeptMembers,
    fetchGroupMembers,
    fetchMember,
    getUserInfo,
    preloadMembers,
    clearCache,
  }
}
