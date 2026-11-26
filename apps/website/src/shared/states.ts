import { useLocalStorage, useTimestamp } from '@vueuse/core'
import { EMOJI_TOKENS } from '@weila/shared'
import { watchEffect } from 'vue'
import { useLocalCrypto } from '~/composables/useLocalCrypto'

export const timestamp = useTimestamp({ offset: 0 })

// https://arco.design/vue/docs/dark
watchEffect(() => {
  document.body.removeAttribute('arco-theme')
})

const emojiIdMap = Object.fromEntries(
  Object.entries(import.meta.glob('~/assets/emoji/**/*.png', { eager: true }))
    .map(([path, loadEmoji]) => [path.match(/([\w-]*)\.png$/)?.[1], loadEmoji]),
) as Record<string, { default: string }>

export const emojiMap = Object.fromEntries(
  EMOJI_TOKENS.map((token, idx) => [token, emojiIdMap[`face${idx + 1}`]]),
)

export const fileIconsMap = Object.fromEntries(
  Object.entries(import.meta.glob('~/assets/file/**/*.png', { eager: true }))
    .map(([path, fileIcon]) => {
      return [
        path.match(/([\w-]*)\.png$/)?.[1].toLowerCase(),
        fileIcon,
      ]
    }),
) as Record<string, { default: string }>

export const autoLogin = useLocalStorage('auto_login', false)

export const tempAccount = useLocalCrypto('temp-account')
