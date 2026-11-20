import { shallowRef } from 'vue'

export const defaultArcoSettings = reactive({
  menu: true,
  topMenu: false,
  themeColor: '#165DFF',
  device: 'desktop',
})

export const AMapKeys = {
  js: '590d2eef2313b156f80a2936df9babad',
  secert: 'cdc03a7b9de2a9ca188da9ab76c4b450',
  regeo: '',
}

// Baidu speech-to-text (app: weila-work-web-audio-to-text).
// NOTE: these are client credentials — they are compiled into the web bundle.
export const appid = computed(() => {
  const demo = '102036'
  const normal = '102065'

  return (import.meta.env.DEV || import.meta.env.MODE === 'staging') ? demo : normal
})

export const appkey = computed(() => {
  const demo = 'b3c658bd2e637c65efb134fb381d4a18'
  const normal = '3c227f2cbc2084ebdd9617fd283c42c7'

  return (import.meta.env.DEV || import.meta.env.MODE === 'staging') ? demo : normal
})

export const isDev = shallowRef(import.meta.env.DEV)
