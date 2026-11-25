import type { WL_IDbUserInfo } from '@vois/weila-sdk-core'
import {
  createWeilaAudioInitController,
  initLogger,
  setConfigData,
  setLoggerEnabled,
  WeilaCore,
  WL_ConfigID,
} from '@vois/weila-sdk-core'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { useWeilaApi } from '~/composables/useWeilaApi'
import { appid, appkey } from '~/shared/const'
import { tempAccount } from '~/shared/states'
import { toChatSafeUploadUrl } from '~/utils/uploadUrl'

export const useWeilaStore = defineStore('weila', () => {
  const core = shallowRef<WeilaCore | null>(null)
  const userInfo = shallowRef<WL_IDbUserInfo | null>(null)
  const audioInitController = createWeilaAudioInitController({
    getCore: () => core.value,
    onDeferredInitError: error => console.warn('[Weila] Deferred audio init failed:', error),
    onInitialInitError: error =>
      console.warn(
        '[Weila] Audio init requires a user gesture, retrying on next interaction:',
        error,
      ),
  })

  async function init() {
    if (core.value)
      return core.value

    initLogger('MOD:*, CORE:*, AUDIO:*, DB:, NET:*')
    setLoggerEnabled(false)

    setConfigData([
      {
        id: WL_ConfigID.WL_RES_DATA_OPUS_WASM_ID,
        url: `${import.meta.env.BASE_URL}opuslibs.wasm`,
        version: 3,
      },
    ])

    const instance = new WeilaCore()

    await instance.weila_init({
      webSock: import.meta.env.DEV
        ? (import.meta.env.VITE_WEB_SOCK || 'wss://wss.weila.hk:8899')
        : 'wss://api.voischat.cn/voischat/bridge',
      appId: appid.value,
      appKey: appkey.value,
    })

    const weilaApi = useWeilaApi()
    instance.weila_setFileUploader(async (file, fileName) => {
      const formData = new FormData()
      formData.append('file', file, fileName)
      const raw = await weilaApi.value.v2.request.post<unknown>('common/upload-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: Math.min(600_000, Math.max(120_000, Math.ceil(file.size / 50_000) * 1000)),
      })
      return toChatSafeUploadUrl(raw, weilaApi.value.v2.request.defaults.baseURL || window.location.href)
    })

    core.value = instance
    audioInitController.initializeWithUserGestureRetry()

    return instance
  }

  async function login(account: string, password: string, countryCode: string = '0') {
    const instance = core.value || (await init())
    userInfo.value = await instance.weila_login(account, password, countryCode, { md5: false })
    tempAccount.value.set('account', account)
    tempAccount.value.set('password', password)
    tempAccount.value.set('country_code', countryCode)
    return userInfo.value
  }

  async function logout() {
    if (core.value) {
      await core.value.weila_logout()
    }
    audioInitController.reset()
    core.value = null
    userInfo.value = null
    tempAccount.value.clear()
  }

  async function autoLogin(): Promise<boolean> {
    const account = tempAccount.value.get('account')
    const password = tempAccount.value.get('password')
    const countryCode = tempAccount.value.get('country_code') ?? '0'
    if (!account || !password)
      return false

    try {
      await login(account, password, countryCode)
      return true
    }
    catch {
      tempAccount.value.clear()
      return false
    }
  }

  return {
    core,
    userInfo,
    init,
    login,
    logout,
    autoLogin,
    tempAccount,
  }
})
