import type { UserTrackModel } from '~/api/track'
import Message from '@arco-design/web-vue/es/message'
import { computed } from 'vue'

export function useUserTrack(selectedUserKeys: Ref<string>, selectedDate: Ref<string>) {
  const { t } = useI18n()

  const enabled = computed(() => Boolean(selectedUserKeys.value && selectedDate.value))

  const { data: tracks } = useWeilaFetch<UserTrackModel[]>('corp/loc/get-track', {
    body: () => ({
      user_id: Number(selectedUserKeys.value.replace('member-', '')),
      date: selectedDate.value,
    }),
    pick: ['tracks'],
  }, {
    enabled,
  })

  // 监听轨迹数据变化，无数据时提示
  watchDebounced(() => tracks.value, (val) => {
    if (!val?.length)
      Message.info(t('no-data'))
  }, {
    debounce: 500,
  })

  // 生成GeoJSON格式的轨迹数据
  const trackFeatureCollection = computed<GeoJSON.FeatureCollection<GeoJSON.LineString>>(() => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: tracks.value?.map(track => [track.lng, track.lat]) || [],
        },
      },
    ],
  }))

  return {
    tracks,
    trackFeatureCollection,
  }
}
