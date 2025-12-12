import type { Directive } from 'vue'
import type { DisableElement } from './disableEl'
import { isObject } from '@antfu/utils'
import { useDisableEl } from './disableEl'

interface VDisabledOptions {
  value: boolean
  // title parameter removed - use v-tips directive for tooltips
}

export const vDisabled: Directive = {
  mounted(el: DisableElement, binding) {
    const { disable, enable } = useDisableEl(el)

    const options: VDisabledOptions = (isObject(binding.value)
      ? binding.value as any
      : { value: binding.value })
    ?? { value: false }

    const {
      value: isDisabled = false,
    } = options

    if (isDisabled) {
      disable() // No title parameter
    }
    else {
      enable()
    }
  },
}
