import type { WeilaApi } from '@wl/network'
import { getRootUrl } from '@kvoon/utils'
import { WeilaApi as WeilaApiClass } from '@wl/network'
import { shallowRef } from 'vue'
import { appid, appkey } from '~/shared/const'
import { isHttpResponseContext, rethrowAxiosErrors } from '~/utils/networkErrors'

export const appname = 'weila-work-web'

export function getApiBaseUrl() {
  // Electron 打包后使用 file:// 协议，相对路径会解析成本地文件，必须改用绝对后端地址

  return `${getRootUrl(window.location.href)}/v2`
}

/**
 * `@vois/weila-network@0.0.7` throws the ofetch context for HTTP 4xx/5xx before
 * its own response hook runs. Forward that context so the app reports the
 * status instead of retrying silently.
 */
function withHttpErrorHook(api: WeilaApi, fetchFn: typeof api.v2.fetch) {
  const wrapped = async (request: any, options?: any) => {
    try {
      return await fetchFn(request, options)
    }
    catch (error) {
      if (isHttpResponseContext(error))
        await api.callHook('response:error', error as any)
      throw error
    }
  }

  return Object.assign(wrapped, fetchFn) as typeof fetchFn
}

const api = new WeilaApiClass(
  // demo server
  'weila-work-web',
  appid.value,
  appkey.value,

  // '102065',
  // '3c227f2cbc2084ebdd9617fd283c42c7',
  {
    baseURL: getApiBaseUrl(),
  },
)

api.fetch = withHttpErrorHook(api, api.fetch)
api.v1.fetch = withHttpErrorHook(api, api.v1.fetch)
api.v2.fetch = withHttpErrorHook(api, api.v2.fetch)
rethrowAxiosErrors(api.request)
rethrowAxiosErrors(api.v1.request)
rethrowAxiosErrors(api.v2.request)

const weilaApi = shallowRef(api)

export function useWeilaApi() {
  return weilaApi
}
