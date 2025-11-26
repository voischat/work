import { getRootUrl } from '@kvoon/utils'
import { v2Query, WeilaApi } from '@wl/network'
import { shallowRef } from 'vue'
import { appid, appkey } from '~/shared/const'

export const appname = 'weila-work-web'

const weilaApi = shallowRef(new WeilaApi(
  // demo server
  appname,
  appid.value,
  appkey.value,

  // '102065',
  // '3c227f2cbc2084ebdd9617fd283c42c7',
  {
    baseURL: `${getRootUrl(window.location.href)}/v2`,
    query: () => {
      return {
        ...v2Query(appname, appid.value, appkey.value),
        lang: usePreferredLanguages().value[0],
      }
    },
  },
))

export function useWeilaApi() {
  return weilaApi
}
