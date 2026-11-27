import { shallowRef, ref } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import {
  WeilaCore,
  createWeilaAudioInitController,
  setConfigData,
  setLogLevel,
  WL_ConfigID,
  WL_ExtEventID,
} from '@vois/weila-sdk-core'
import type { WL_IDbUserInfo } from '@vois/weila-sdk-core'
import type { WL_ExtEventCallback } from '@vois/weila-sdk-core'

const storedCredentials = useLocalStorage<{
  account: string
  password: string
  countryCode: string
} | null>('weila_credentials', null, {
  serializer: {
    read: (v) => {
      if (!v) return null
      try {
        return JSON.parse(atob(v))
      } catch {
        return null
      }
    },
    write: (v) => (v ? btoa(JSON.stringify(v)) : ''),
  },
})

function isKickoutData(value: unknown): value is { reason: unknown; reasonText: string } {
  return typeof value === 'object' && value !== null && 'reason' in value && 'reasonText' in value
}

export const useWeilaStore = defineStore('weila', () => {
  const core = shallowRef<WeilaCore | null>(null)
  const userInfo = shallowRef<WL_IDbUserInfo | null>(null)
  const kickoutReason = ref('')
  const kickoutReasonText = ref('')
  const audioInitialized = ref(false)
  const audioInitController = createWeilaAudioInitController({
    getCore: () => core.value,
    setInitialized: (initialized) => {
      audioInitialized.value = initialized
    },
    onDeferredInitError: (error) => console.warn('[Weila] Deferred audio init failed:', error),
    onInitialInitError: (error) =>
      console.warn(
        '[Weila] Audio init requires a user gesture, retrying on next interaction:',
        error,
      ),
  })

  const kickoutHandler: WL_ExtEventCallback = (eventId, eventData) => {
    if (eventId === WL_ExtEventID.WL_EXT_KICKOUT_IND && isKickoutData(eventData)) {
      kickoutReason.value = String(eventData.reason)
      kickoutReasonText.value = eventData.reasonText
    }
  }

  async function init() {
    if (core.value) return core.value

    setLogLevel(import.meta.env.DEV ? 'debug' : 'silent')

    setConfigData([
      {
        id: WL_ConfigID.WL_RES_DATA_OPUS_WASM_ID,
        url: `${import.meta.env.BASE_URL}opuslibs.wasm`,
        version: 3,
      },
    ])

    const instance = new WeilaCore()

    await instance.weila_init({
      webSock: import.meta.env.VITE_WEILA_WSS,
      appId: import.meta.env.VITE_WEILA_APP_ID,
      appKey: import.meta.env.VITE_WEILA_APP_KEY,
    })

    instance.weila_onEvent(kickoutHandler)

    core.value = instance
    audioInitController.initializeWithUserGestureRetry()

    return instance
  }

  async function login(account: string, password: string, countryCode: string = '0') {
    const instance = core.value || (await init())
    userInfo.value = await instance.weila_login(account, password, countryCode)
    storedCredentials.value = { account, password, countryCode }
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
    storedCredentials.value = null
    clearKickoutState()
  }

  async function autoLogin(): Promise<boolean> {
    const creds = storedCredentials.value
    if (!creds?.account || !creds?.password) return false

    try {
      await login(creds.account, creds.password, creds.countryCode)
      return true
    } catch {
      storedCredentials.value = null
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
    storedCredentials,
  }
})
