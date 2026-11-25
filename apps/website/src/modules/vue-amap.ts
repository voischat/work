import type { UserModule } from '~/types'
import { initAMapApiLoader } from '@vuemap/vue-amap'
import { AMapKeys } from '~/shared/const'
import '@vuemap/vue-amap/dist/style.css'

export const install: UserModule = () => {
  initAMapApiLoader({
    key: AMapKeys.js,
    Loca: {
      version: '2.0.0',
    },
  })
}
