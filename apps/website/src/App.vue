<script lang="ts" setup>
import en from '@arco-design/web-vue/es/locale/lang/en-us'
import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn'
import Message from '@arco-design/web-vue/es/message'
import { VueQueryDevtools } from '@tanstack/vue-query-devtools'
import { isWeilaRes, v2Query } from '@wl/network'
import { storeToRefs } from 'pinia'
import { stringifyQuery } from 'ufo'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteUpdate } from 'vue-router'
import { useBundleInfo } from '~/composables/useBundleInfo'
import { appname, useWeilaApi } from '~/composables/useWeilaApi'
import { useAuthStore } from '~/stores/auth'
import { isDefinitiveRefreshFailure, refreshAuth } from '~/utils/authRefresh'
import { toastError } from '~/utils/errorToast'
import { getApiBaseUrl } from './composables/useWeilaApi'
import { appid, appkey } from './shared/const'

const { locale } = useI18n()

const arcoLang = computed(() => ({
  'zh-CN': zhCN,
  en,
}[locale.value]))

const { update } = useBundleInfo()

const authStore = useAuthStore()

onBeforeRouteUpdate(() => {
  update()
})

const REFRESH_COOLDOWN_MS = 30_000
const PUBLIC_PATH_KEYWORDS = [
  'login',
  'auth/regist',
  'auth/reset-password',
  'auth/refresh',
  'common/get-image-verifycode',
  'common/send-sms-verifycode',
  'common/app-download',
  'common/guide',
]

let refreshing: Promise<unknown> | null = null
let lastRefreshFailure = 0
let lastRefreshNotice = 0

const weilaApi = useWeilaApi()

weilaApi.value.hook('request:prepare', async (ctx) => {
  const { refreshToken, token, expiresIn, loginTime } = storeToRefs(authStore)

  const failAuth = async (error: unknown) => {
    lastRefreshFailure = Date.now()
    console.error('refresh token failed', error)
    await authStore.clearAuth()

    if (Date.now() - lastRefreshNotice > 1000) {
      lastRefreshNotice = Date.now()
      Message.error('登录已过期，请重新登录')
    }

    window.location.replace('/#/login')
  }

  try {
    const request = ctx?.request || ctx?.url || ''
    const url = typeof request === 'string'
      ? request
      : request.url || ''
    const isPublic = PUBLIC_PATH_KEYWORDS.some(keyword => url.includes(keyword))

    if (!token.value || isPublic || !authStore.needRefresh())
      return

    if (!refreshToken.value)
      return

    if (refreshing) {
      await refreshing
      return
    }

    if (Date.now() - lastRefreshFailure < REFRESH_COOLDOWN_MS)
      return

    const pending = refreshAuth({
      storage: localStorage,
      fetch: (input, init) => fetch(input, init),
      now: () => Date.now(),
      locks: navigator.locks,
      buildUrl: async () => {
        const query = await v2Query(appname, appid.value, appkey.value)
        return `${getApiBaseUrl()}/corp/auth/refresh?${stringifyQuery(query as unknown as Record<string, string | undefined>)}`
      },
    })

    refreshing = pending
    const settle = () => {
      if (refreshing === pending)
        refreshing = null
    }
    void pending.then(settle, settle)

    const result = await pending

    token.value = result.tokens.access_token
    refreshToken.value = result.tokens.refresh_token
    expiresIn.value = result.tokens.expires_in
    loginTime.value = result.loginTime
  }
  catch (error) {
    if (!isDefinitiveRefreshFailure(error))
      throw error

    await failAuth(error)
  }
})
weilaApi.value.hook('request:error', onError)
weilaApi.value.hook('response:error', onError)

weilaApi.value.hook('auth:error', async () => {
  await authStore.clearAuth()
  window.location.reload()
})

function onError(error: any) {
  console.error('error', error)

  if (isWeilaRes(error)) {
    toastError(`${error.errcode}${error.errmsg}`)
    return
  }

  if (error?.error) {
    toastError(String(error.error))
    return
  }

  if (typeof error?.response?.status === 'number') {
    const statusText = error.response.statusText
      ? `: ${error.response.statusText}`
      : ''
    toastError(`${error.response.status}${statusText}`)
    return
  }

  if (error?.name === 'TimeoutError' || error?.name === 'AbortError')
    toastError('请求超时')
  else
    toastError('网络请求失败')
}
</script>

<template>
  <a-config-provider :locale="arcoLang">
    <router-view />
    <VueQueryDevtools />
  </a-config-provider>
</template>
