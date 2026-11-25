import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { defaultArcoSettings } from '~/shared/const'

export const useAppStore = defineStore('app', () => {
  const state = reactive({
    menu: defaultArcoSettings.menu,
    topMenu: defaultArcoSettings.topMenu,
    themeColor: defaultArcoSettings.themeColor,
    device: defaultArcoSettings.device,
  })

  return {
    ...state,
  }
})
