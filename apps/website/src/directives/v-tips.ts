import type { Directive } from 'vue'
import { isFunction, isObject } from '@antfu/utils'

interface VTipsOptions {
  text: string
  placement?: 'top' | 'bottom' | 'left' | 'right' // For future extensibility
}

export const vTips: Directive = {
  mounted(el: HTMLElement, binding) {
    // Store original title and set up hover listeners
    const originalTitle = el.title
    el.dataset.originalTitle = originalTitle

    const showTooltip = () => {
      const value = binding.value
      let tooltipText = ''

      if (isFunction(value)) {
        tooltipText = value()
      }
      else if (isObject(value) && 'text' in value) {
        tooltipText = (value as VTipsOptions).text
      }
      else {
        tooltipText = String(value)
      }

      el.title = tooltipText
    }

    const hideTooltip = () => {
      el.title = originalTitle
    }

    el.addEventListener('mouseenter', showTooltip)
    el.addEventListener('mouseleave', hideTooltip)

    // Store references for cleanup
    el.dataset.vTipsShowHandler = 'true'
  },

  updated(el: HTMLElement, binding) {
    // Update tooltip text if currently hovered
    if (el.matches(':hover')) {
      const value = binding.value
      let tooltipText = ''

      if (isFunction(value)) {
        tooltipText = value()
      }
      else if (isObject(value) && 'text' in value) {
        tooltipText = (value as VTipsOptions).text
      }
      else {
        tooltipText = String(value)
      }

      el.title = tooltipText
    }
  },

  unmounted(el: HTMLElement) {
    // Restore original title
    el.title = el.dataset.originalTitle || ''
  },
}
