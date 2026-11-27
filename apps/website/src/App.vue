<script lang="ts" setup>
import type { AuthModel } from '~/stores/auth'
import en from '@arco-design/web-vue/es/locale/lang/en-us'
import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn'
import Message from '@arco-design/web-vue/es/message'
import { VueQueryDevtools } from '@tanstack/vue-query-devtools'
import { isWeilaRes, v2Query } from '@wl/network'
import { storeToRefs } from 'pinia'
import { stringifyQuery } from 'ufo'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteUpdate, useRouter } from 'vue-router'
import { useBundleInfo } from '~/composables/useBundleInfo'
import { appname, useWeilaApi } from '~/composables/useWeilaApi'
import { useAuthStore } from '~/stores/auth'
import { toastError } from '~/utils/errorToast'
import { getApiBaseUrl } from './composables/useWeilaApi'
import { appid, appkey } from './shared/const'
import { autoLogin } from './shared/states'

const { locale } = useI18n()

const arcoLang = computed(() => ({
  'zh-CN': zhCN,
  en,
}[locale.value]))

const { update } = useBundleInfo()

onBeforeRouteUpdate(() => {
  update()
})

const router = useRouter()

const REFRESH_COOLDOWN_MS = 30_000
const PUBLIC_PATH_KEYWORDS = [
  'login',
  'auth/refresh',
  'common/get-image-verifycode',
  'common/send-sms-verifycode',
  'common/app-download',
  'common/guide',
]

let refreshing: Promise<AuthModel | undefined> | null = null
let lastRefreshFailure = 0
let lastRefreshNotice = 0

const weilaApi = useWeilaApi()

weilaApi.value.hook('request:prepare', async (ctx) => {
  const { needRefresh } = useAuthStore()
  const { refreshToken, token, expiresIn, loginTime } = storeToRefs(useAuthStore())

  const clean = () => {
    token.value = ''
    refreshToken.value = ''
    expiresIn.value = -1
    loginTime.value = -1
    autoLogin.value = false
  }

  const handleRefreshFailure = (error: unknown) => {
    lastRefreshFailure = Date.now()
    console.error('refresh token failed', error)
    clean()

    if (Date.now() - lastRefreshNotice > 1000) {
      lastRefreshNotice = Date.now()
      Message.error('登录已过期，请重新登录')
    }

    router.push('/login')
  }

  try {
    const request = ctx?.request || ctx?.url || ''
    const url = typeof request === 'string'
      ? request
      : request.url || ''
    const isPublic = PUBLIC_PATH_KEYWORDS.some(keyword => url.includes(keyword))

    if (isPublic || !needRefresh())
      return

    if (!refreshToken.value)
      return

    if (refreshing) {
      await refreshing
      return
    }

    if (Date.now() - lastRefreshFailure < REFRESH_COOLDOWN_MS)
      return

    const pending = (async () => {
      const query = await v2Query(appname, appid.value, appkey.value)
      const res = await fetch(`${getApiBaseUrl()}/corp/auth/refresh?${stringifyQuery(query as unknown as Record<string, string | undefined>)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken.value }),
      })

      if (!res.ok)
        throw new Error(`refresh failed with HTTP ${res.status}`)

      const { data: auth, errcode }: { data: AuthModel, errcode: number } = await res.json()
      if (errcode !== 0 || !auth)
        throw new Error(`refresh failed with errcode ${errcode}`)

      token.value = auth.access_token
      refreshToken.value = auth.refresh_token
      expiresIn.value = auth.expires_in
      loginTime.value = Date.now()
      return auth
    })()

    refreshing = pending
    const settle = () => {
      if (refreshing === pending)
        refreshing = null
    }
    void pending.then(settle, settle)

    try {
      await pending
    }
    catch (error) {
      handleRefreshFailure(error)
    }
  }
  catch (error) {
    handleRefreshFailure(error)
  }
})
weilaApi.value.hook('request:error', onError)
weilaApi.value.hook('response:error', onError)

weilaApi.value.hook('auth:error', () => {
  localStorage.setItem('token', '')
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
