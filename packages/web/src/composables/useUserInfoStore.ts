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

  // 根据用户ID查找用户信息
  function getUserInfo(uid: number): Member | null {
    // 直接从成员映射中查找
    return membersMap.value.get(uid) || null
  }

  // 预加载成员信息（当选择部门或群组时调用）
  async function preloadMembers(type: 'dept' | 'group', id: number) {
    if (type === 'dept') {
      return await fetchDeptMembers(id)
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
    getUserInfo,
    preloadMembers,
    clearCache,
  }
}
