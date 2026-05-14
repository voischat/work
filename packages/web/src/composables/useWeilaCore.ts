import type { WL_IDbUserInfo } from '@weilasdk/core'
import { initLogger, setConfigData, setLoggerEnabled, WeilaCore, WL_ConfigID } from '@weilasdk/core'

import { shallowRef } from 'vue'
import { useLocalCrypto } from '~/composables/useLocalCrypto'
import { appid, appkey } from '~/shared/const'

let _instance: WeilaCore | undefined

export function useWeilaCore() {
  const core = shallowRef<WeilaCore | undefined>(_instance)
  const userInfo = shallowRef<WL_IDbUserInfo | undefined>()
  const loading = shallowRef(false)
  const error = shallowRef<Error | undefined>()
  const inited = shallowRef(false)

  async function init() {
    if (_instance)
      return _instance

    const tempAccount = useLocalCrypto('temp-account')
    const account = tempAccount.value.get('account')
    const password = tempAccount.value.get('password')
    const countryCode = tempAccount.value.get('country_code') ?? '0'

    if (!account || !password) {
      error.value = new Error('未找到登录凭证，请重新登录')
      return
    }

    loading.value = true
    error.value = undefined

    try {
      initLogger('MOD:*, CORE:*, AUDIO:*, DB:, NET:*')
      setLoggerEnabled(false)

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
      const loginUserInfo = await instance.weila_login(account, password, countryCode, { md5: false })

      _instance = instance
      core.value = instance
      userInfo.value = loginUserInfo ?? undefined
      inited.value = true
      return instance
    }
    catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    }
    finally {
      loading.value = false
    }
  }

  return { core, userInfo, loading, error, inited, init }
}
