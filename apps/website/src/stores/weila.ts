import type { WeilaCore, WL_AudioInitController, WL_IDbUserInfo } from '@vois/weila-sdk-core'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { useWeilaApi } from '~/composables/useWeilaApi'
import { appid, appkey } from '~/shared/const'
import { tempAccount } from '~/shared/states'
import { toChatSafeUploadUrl } from '~/utils/uploadUrl'

export const useWeilaStore = defineStore('weila', () => {
  const core = shallowRef<WeilaCore | null>(null)
  const userInfo = shallowRef<WL_IDbUserInfo | null>(null)
  const autoLoginError = shallowRef('')
  const hasSavedCredentials = computed(() => {
    const account = tempAccount.value.get('account')
    const password = tempAccount.value.get('password')
    return Boolean(account && password)
  })
  let audioInitController: WL_AudioInitController | null = null

  async function init() {
    if (core.value)
      return core.value

    const {
      createWeilaAudioInitController,
      setConfigData,
      setLogLevel,
      WeilaCore,
      WL_ConfigID,
    } = await import('@vois/weila-sdk-core')

    setLogLevel(
      import.meta.env.DEV
        ? 'info'
        : 'silent',
    )

    setConfigData([
      {
        id: WL_ConfigID.WL_RES_DATA_OPUS_WASM_ID,
        url: `${import.meta.env.BASE_URL}opuslibs.wasm`,
        version: 4,
      },
      {
        id: WL_ConfigID.WL_RES_RING_START_PLAY_ID,
        url: `${import.meta.env.BASE_URL}assets/start_player.wav`,
        version: 4,
      },
      {
        id: WL_ConfigID.WL_RES_RING_STOP_PLAY_ID,
        url: `${import.meta.env.BASE_URL}assets/stop_player.wav`,
        version: 4,
      },
      {
        id: WL_ConfigID.WL_RES_RING_START_RECORD_ID,
        url: `${import.meta.env.BASE_URL}assets/start_record.wav`,
        version: 4,
      },
      {
        id: WL_ConfigID.WL_RES_RING_STOP_RECORD_ID,
        url: `${import.meta.env.BASE_URL}assets/stop_record.wav`,
        version: 4,
      },
    ])

    const controller = createWeilaAudioInitController({
      getCore: () => core.value,
      onDeferredInitError: error => console.warn('[Weila] Deferred audio init failed:', error),
      onInitialInitError: error =>
        console.warn(
          '[Weila] Audio init requires a user gesture, retrying on next interaction:',
          error,
        ),
    })
    audioInitController = controller

    const instance = new WeilaCore()
    const bridgeProtocol = location.protocol === 'https:'
      ? 'wss'
      : 'ws'

    await instance.weila_init({
      webSock:
        import.meta.env.VITE_WEB_SOCK
          || (import.meta.env.DEV
            ? `${bridgeProtocol}://${location.host}/voischat/bridge`
            : 'wss://api.voischat.cn/voischat/bridge'),
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
    controller.initializeWithUserGestureRetry()

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
    audioInitController?.reset()
    core.value = null
    userInfo.value = null
    tempAccount.value.clear()
  }

  async function autoLogin(): Promise<boolean> {
    autoLoginError.value = ''
    const account = tempAccount.value.get('account')
    const password = tempAccount.value.get('password')
    const countryCode = tempAccount.value.get('country_code') ?? '0'
    if (!account || !password)
      return false

    try {
      await login(account, password, countryCode)
      return true
    }
    catch (error) {
      autoLoginError.value = error instanceof Error
        ? error.message
        : String(error)
      return false
    }
  }

  return {
    core,
    userInfo,
    autoLoginError,
    hasSavedCredentials,
    init,
    login,
    logout,
    autoLogin,
    tempAccount,
  }
})
