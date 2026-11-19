import type { SelfInfo } from '~/types'
import { defineStore } from 'pinia'

export const useSelfInfoStore = defineStore('selfInfo', () => {
  const authStore = useAuthStore()
  const { data: selfInfo } = useWeilaFetch<SelfInfo>('corp/user/get-selfinfo', {}, {
    // 重新登录后自动获取
    enabled: computed(() => Boolean(authStore.token)),
  })

  // 权限判断
  const isOwner = computed(() => selfInfo.value?.type === 255)
  const isAdmin = computed(() => selfInfo.value?.type === 1 || selfInfo.value?.type === 2)
  const isDeptAdmin = computed(() => selfInfo.value?.is_dept_admin === 1)

  // 方法
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
    isCurrentUser,
  }
})
