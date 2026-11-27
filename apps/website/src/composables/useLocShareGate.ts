import type { Ref } from 'vue'
import { computed, watchEffect } from 'vue'
import { useAuthStore } from '~/stores/auth'

export function useLocShareGate(form: Ref<{ loc_share?: number }>) {
  const authStore = useAuthStore()
  const isLocked = computed(() => authStore.vip?.supports?.location === false)

  watchEffect(() => {
    if (isLocked.value)
      form.value.loc_share = 0
  })

  return { isLocked }
}
