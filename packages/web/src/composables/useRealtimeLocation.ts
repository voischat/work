import type { RealtimeLocationModel } from '~/api/realtime-location'

export function useRealtimeLocation(
  selectedType: Ref<'dept' | 'group'>,
  selectedId: Ref<number | undefined>,
) {
  const enabled = computed(() => selectedId.value !== undefined)

  watch(selectedType, () => selectedId.value = undefined)

  const { data: locations, refetch } = useWeilaFetch<RealtimeLocationModel[]>('corp/loc/get-realtime-location', {
    body: () => {
      const sessionType = selectedType.value === 'dept' ? 20 : 18
      return {
        session_id: selectedId.value,
        session_type: sessionType,
      }
    },
  }, {
    enabled,
    immediate: false,
  })

  // 定时刷新位置数据
  const { pause, resume } = useIntervalFn(() => {
    if (enabled.value) {
      refetch()
    }
  }, 5000)

  // 初始化时获取数据
  watch([enabled, selectedId], () => {
    if (enabled.value) {
      refetch()
    }
  }, { immediate: true })

  return {
    locations,
    refetch,
    pause,
    resume,
  }
}
