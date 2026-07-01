import type { WL_ExtEventCallback, WL_IDbUserInfo } from '@vois/weila-sdk-core'
import {
  createWeilaAudioInitController,
  initLogger,
  setConfigData,
  setLoggerEnabled,
  WeilaCore,
  WL_ConfigID,
  WL_ExtEventID,
} from '@vois/weila-sdk-core'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { useLocalCrypto } from '~/composables/useLocalCrypto'
import { appid, appkey } from '~/shared/const'

const tempAccount = useLocalCrypto('temp-account')

export const useWeilaStore = defineStore('weila', () => {
  const core = shallowRef<WeilaCore | null>(null)
  const userInfo = shallowRef<WL_IDbUserInfo | null>(null)
  const kickoutReason = shallowRef('')
  const kickoutReasonText = shallowRef('')
  const audioInitialized = shallowRef(false)
  const audioInitController = createWeilaAudioInitController({
    getCore: () => core.value,
    setInitialized: (initialized) => {
      audioInitialized.value = initialized
    },
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

    // 配置 WASM 资源路径（Vite 开发模式需要）
    setConfigData([
      {
        id: WL_ConfigID.WL_RES_DATA_OPUS_WASM_ID,
        url: `${import.meta.env.BASE_URL}opuslibs.wasm`,
        version: 3,
      },
    ])

    const instance = new WeilaCore()

    await instance.weila_init({
      webSock: 'wss://wss.weila.hk:8999',
      appId: appid.value,
      appKey: appkey.value,
    })

    // Register kickout event listener
    const kickoutHandler: WL_ExtEventCallback = (eventId, eventData) => {
      if (eventId === WL_ExtEventID.WL_EXT_KICKOUT_IND) {
        kickoutReason.value = String(eventData.reason)
        kickoutReasonText.value = eventData.reasonText
      }
    }
    instance.weila_onEvent(kickoutHandler)

    core.value = instance
    audioInitController.initializeWithUserGestureRetry()

    return instance
  }

  async function login(account: string, password: string, countryCode: string = '0') {
    const instance = core.value || (await init())
    userInfo.value = await instance.weila_login(account, password, countryCode, { md5: false })
    // Save credentials for auto-login after refresh
    tempAccount.value.set('account', account)
    tempAccount.value.set('password', password)
    tempAccount.value.set('country_code', countryCode)
    return userInfo.value
  }

  function ensureAudioInitialized(): Promise<boolean> {
    return audioInitController.ensureInitialized()
  }

  function clearKickoutState() {
    kickoutReason.value = ''
    kickoutReasonText.value = ''
  }

  async function logout() {
    if (core.value) {
      await core.value.weila_logout()
    }
    audioInitController.reset()
    core.value = null
    userInfo.value = null
    tempAccount.value.clear()
    clearKickoutState()
  }

  // Auto-login with stored credentials
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
    kickoutReason,
    kickoutReasonText,
    audioInitialized,
    init,
    login,
    logout,
    autoLogin,
    clearKickoutState,
    ensureAudioInitialized,
    tempAccount,
  }
})

// Pinia HMR -- 替代手动 import.meta.hot.dispose/data 模式
// if (import.meta.hot) {
//   import.meta.hot.accept(acceptHMRUpdate(useWeilaStore, import.meta.hot))
// }
