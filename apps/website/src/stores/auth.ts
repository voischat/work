import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { autoLogin } from '~/shared/states'
import { clearAuthStorage } from '~/utils/authStorage'

export interface AuthModel {
  access_token: string
  expires_in: number
  refresh_token: string
}

export interface VipInfo {
  level: number
  name: string
  expired: number
  created: number
  member_limit?: number
  dept_limit?: number
  dept_member_limit?: number
  group_limit?: number
  group_member_limit?: number
  device_limit?: number
  device_group_limit?: number
  supports: VipSupports
}

export interface VipSupports {
  api: boolean
  dept: boolean
  device: boolean
  group: boolean
  location: boolean
  member: boolean
  member_batch_create: boolean
  message: boolean
  simcard: boolean
  track: boolean
  track_quick: boolean
}

export type VipFlag = keyof VipSupports

export const useAuthStore = defineStore('auth', () => {
  const refreshToken = useLocalStorage('refresh_token', '')
  const token = useLocalStorage('token', '')
  const expiresIn = useLocalStorage('expires_in', 7200)
  const loginTime = useLocalStorage('login_time', 0, {})

  const { data: vip } = useWeilaFetch<VipInfo>('corp/org/get-vip-membership', {}, {
    enabled: computed(() => Boolean(token.value)),
  })

  function clearAuth() {
    token.value = ''
    refreshToken.value = ''
    expiresIn.value = -1
    loginTime.value = -1
    autoLogin.value = false
    clearAuthStorage()
  }

  function logout() {
    clearAuth()
    window.location.reload()
  }

  function needRefresh() {
    const expireTime = loginTime.value + (expiresIn.value / 2) * 1000
    const now = Date.now()
    return expireTime < now
  }

  return {
    token,
    refreshToken,
    expiresIn,
    loginTime,
    clearAuth,
    logout,
    vip,
    needRefresh,
  }
})
