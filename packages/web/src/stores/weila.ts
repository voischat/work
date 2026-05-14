import type { WL_ExtEventCallback, WL_IDbUserInfo } from '@weilasdk/core'
import {
  initLogger,
  setConfigData,
  setLoggerEnabled,
  WeilaCore,
  WL_ConfigID,
  WL_ExtEventID,
} from '@weilasdk/core'
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
  let audioInitPromise: Promise<boolean> | null = null
  let audioInitListenerArmed = false

  function disarmAudioInitListener() {
    if (!audioInitListenerArmed || typeof window === 'undefined')
      return

    audioInitListenerArmed = false
    window.removeEventListener('pointerdown', handleDeferredAudioInit)
    window.removeEventListener('keydown', handleDeferredAudioInit)
    window.removeEventListener('touchstart', handleDeferredAudioInit)
  }

  async function ensureAudioInitialized(): Promise<boolean> {
    if (!core.value)
      return false
    if (audioInitialized.value)
      return true
    if (audioInitPromise)
      return audioInitPromise

    audioInitPromise = core.value
      .weila_audioInit()
      .then((result) => {
        audioInitialized.value = Boolean(result)
        if (audioInitialized.value) {
          disarmAudioInitListener()
        }
        return result
      })
      .catch((error) => {
        audioInitialized.value = false
        throw error
      })
      .finally(() => {
        audioInitPromise = null
      })

    return audioInitPromise
  }

  function armAudioInitListener() {
    if (audioInitialized.value || audioInitListenerArmed || typeof window === 'undefined')
      return

    audioInitListenerArmed = true
    window.addEventListener('pointerdown', handleDeferredAudioInit, { once: true })
    window.addEventListener('keydown', handleDeferredAudioInit, { once: true })
    window.addEventListener('touchstart', handleDeferredAudioInit, { once: true })
  }

  function handleDeferredAudioInit() {
    void ensureAudioInitialized().catch((error) => {
      console.warn('[Weila] Deferred audio init failed:', error)
      armAudioInitListener()
    })
  }

  async function init() {
    if (core.value)
      return core.value

    initLogger('MOD:*, CORE:*, AUDIO:*, DB:, NET:*')
    setLoggerEnabled(false)

    // 配置 WASM 资源路径（Vite 开发模式需要）
    setConfigData([
      {
        id: WL_ConfigID.WL_RES_DATA_OPUS_WASM_ID,
        url: '/opuslibs.wasm',
        version: 2,
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
    void ensureAudioInitialized().catch((error) => {
      console.warn(
        '[Weila] Audio init requires a user gesture, retrying on next interaction:',
        error,
      )
      armAudioInitListener()
    })

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

  function clearKickoutState() {
    kickoutReason.value = ''
    kickoutReasonText.value = ''
  }

  async function logout() {
    if (core.value) {
      await core.value.weila_logout()
    }
    disarmAudioInitListener()
    audioInitialized.value = false
    audioInitPromise = null
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
