import type { SelfInfo } from '~/types'
import { defineStore } from 'pinia'

export const useSelfInfoStore = defineStore('selfInfo', () => {
  const { data: selfInfo } = useWeilaFetch<SelfInfo>('corp/user/get-selfinfo')

  // 权限判断
  const isOwner = computed(() => selfInfo.value?.type === 255)
  const isAdmin = computed(() => selfInfo.value?.type === 1)
  const isDeptAdmin = computed(() => selfInfo.value?.is_dept_admin === 1)

  // 方法
  function hasPermission(requiredType: number) {
    return selfInfo.value?.type === requiredType
  }

  function isCurrentUser(userId: number) {
    return Number(userId) === Number(selfInfo.value?.user_id)
  }

  return {
    // 原始数据
    selfInfo,

    // 权限判断
    isOwner,
    isAdmin,
    isDeptAdmin,

    // 方法
    hasPermission,
    isCurrentUser,
  }
})
