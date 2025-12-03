import type { APIOptions } from '@googlemaps/js-api-loader'
import type { MaybeRefOrGetter } from 'vue'
import { setOptions } from '@googlemaps/js-api-loader'
import { toValue, watch, watchEffect } from 'vue'

export function useMapOptions(options: MaybeRefOrGetter<APIOptions>) {
  watchEffect(() => {
    setOptions(toValue(options))
  })

  watch(options, () => {
    // reload page
    window.location.reload()
  })
}
