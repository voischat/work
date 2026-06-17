import type { Member } from '~/types/api'

export function useUserInfoStore() {
  // 使用本地存储保存成员信息，key为成员ID，value为成员对象
  const membersMap = useSessionStorage<Map<number, Member>>('realtime-location-members', new Map())

  // 获取部门成员
  async function fetchDeptMembers(deptId: number): Promise<Member[]> {
    const weilaApi = useWeilaApi()

    try {
      const members = await weilaApi.value.v2.fetch<Member[]>('corp/address/get-dept-all-member', {
        body: { dept_id: deptId },
      })

      // 更新缓存
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

  // 获取群组成员
  async function fetchGroupMembers(groupId: number): Promise<Member[]> {
    const weilaApi = useWeilaApi()
    try {
      const members = await weilaApi.value.v2.fetch<Member[]>('corp/group/get-group-all-member', {
        body: { group_id: groupId },
      })

      // 更新缓存
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

  // 获取单个成员信息
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

  // 根据用户ID查找用户信息
  function getUserInfo(uid: number): Member | null {
    // 直接从成员映射中查找
    return membersMap.value.get(uid) || null
  }

  // 预加载成员信息（当选择部门、群组或个人时调用）
  async function preloadMembers(type: 'dept' | 'group' | 'individual', id: number) {
    if (type === 'dept') {
      return await fetchDeptMembers(id)
    }
    else if (type === 'individual') {
      const member = await fetchMember(id)
      return member ? [member] : []
    }
    else {
      return await fetchGroupMembers(id)
    }
  }

  // 清除缓存
  function clearCache() {
    membersMap.value.clear()
  }

  return {
    // 数据
    membersMap,

    // 方法
    fetchDeptMembers,
    fetchGroupMembers,
    fetchMember,
    getUserInfo,
    preloadMembers,
    clearCache,
  }
}
