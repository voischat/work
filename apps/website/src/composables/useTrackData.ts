import type { UserTrackModel } from '~/api/track'
import { computed } from 'vue'

export function useUserTrack(selectedUserKeys: Ref<string>, selectedDate: Ref<string>) {
  const enabled = computed(() => Boolean(selectedUserKeys.value && selectedDate.value))

  const {
    data: tracks,
    refetch,
    isPending,
    isFetching,
    isError,
    error,
    status,
  } = useWeilaFetch<UserTrackModel[]>('corp/loc/get-track', {
    body: () => ({
      user_id: Number(selectedUserKeys.value.replace('member-', '')),
      date: selectedDate.value,
    }),
    pick: ['tracks'],
  }, {
    enabled,
  })

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
    refetch,
    isPending,
    isFetching,
    isError,
    error,
    status,
  }
}
