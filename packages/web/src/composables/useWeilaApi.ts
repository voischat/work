import { getRootUrl } from '@kvoon/utils'
import { WeilaApi } from '@wl/network'
import { shallowRef } from 'vue'
import { appid, appkey } from '~/shared/const'

export const appname = 'weila-work-web'

function getApiBaseUrl() {
  // Electron 打包后使用 file:// 协议，相对路径会解析成本地文件，必须改用绝对后端地址
  if (typeof window !== 'undefined' && window.electronAPI?.apiBaseUrl)
    return window.electronAPI.apiBaseUrl

  return `${getRootUrl(window.location.href)}/v2`
}

const weilaApi = shallowRef(new WeilaApi(
  // demo server
  'weila-work-web',
  appid.value,
  appkey.value,

  // '102065',
  // '3c227f2cbc2084ebdd9617fd283c42c7',
  { baseURL: getApiBaseUrl() },
))

export function useWeilaApi() {
  return weilaApi
}
