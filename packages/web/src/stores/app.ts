import { defineStore } from 'pinia'
import { computed } from 'vue'
import { defaultArcoSettings } from '~/shared/const'

interface AppState {
  colorWeak: boolean
  navbar: boolean
  menu: boolean
  topMenu: boolean
  hideMenu: boolean
  menuCollapse: boolean
  footer: boolean
  themeColor: string
  menuWidth: number
  globalSettings: boolean
  device: string
  tabBar: boolean
  [key: string]: unknown
}

export const useAppStore = defineStore('app', () => {
  let state = reactive({ ...defaultArcoSettings })

  const appCurrentSetting = computed(() => ({ ...state }))
  const appDevice = computed(() => state.device)

  function updateSettings(partial: Partial<AppState>) {
    state = { ...state, ...partial }
  }

  function toggleDevice(device: string) {
    state.device = device
  }

  function toggleMenu(value: boolean) {
    state.hideMenu = value
  }

  return {
    ...state,
    appCurrentSetting,
    appDevice,
    updateSettings,
    toggleDevice,
    toggleMenu,
  }
})
