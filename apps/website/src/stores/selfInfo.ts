import type { SelfInfo } from '~/types'
import { defineStore } from 'pinia'

export const useSelfInfoStore = defineStore('selfInfo', () => {
  const authStore = useAuthStore()
  const { data: selfInfo } = useWeilaFetch<SelfInfo>('corp/user/get-selfinfo', {}, {
    enabled: computed(() => Boolean(authStore.token)),
  })

  const isOwner = computed(() => selfInfo.value?.type === 255)
  const isAdmin = computed(() => selfInfo.value?.type === 1 || selfInfo.value?.type === 2)
  const isDeptAdmin = computed(() => selfInfo.value?.is_dept_admin === 1)

  function isCurrentUser(userId: number) {
    return Number(userId) === Number(selfInfo.value?.user_id)
  }

  return {
    selfInfo,

    isOwner,
    isAdmin,
    isDeptAdmin,

    isCurrentUser,
  }
})
