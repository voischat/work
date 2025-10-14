import type { RegeoModel, UserTrackModel } from '~/api/track'
import { nanoid } from 'nanoid'
import { nextTick, shallowRef, watch } from 'vue'

interface GoogleMarker {
  id: string
  position: { lat: number, lng: number }
  created: number
  longitude: number
  latitude: number
  userId?: string
}

export function useMapInteraction(tracks: Ref<UserTrackModel[] | undefined>) {
  const { t } = useI18n()

  // 地图相关状态
  const trackVisible = shallowRef(true)
  const drawerVisible = shallowRef(false)
  const zoom = shallowRef(12)
  const center = shallowRef({ lat: 31.197646, lng: 121.59996 })
  const map = shallowRef<any | null>(null)
  const markers = shallowRef<GoogleMarker[]>([])
  const selectedMarker = shallowRef<GoogleMarker | null>(null)

  // 逆地理编码相关
  const weilaApi = useWeilaApi()
  const regeoInfo = shallowRef<RegeoModel | undefined>(undefined)

  // 轨迹路径
  const polylinePath = shallowRef<Array<{ lat: number, lng: number }>>([])

  // InfoWindow 相关
  const isInfoWindowOpen = shallowRef(false)
  const infoWindowPosition = shallowRef<{ lat: number, lng: number } | null>(null)
  const infoWindowContent = shallowRef<string>('')

  watch(selectedMarker, onMarkerSelected)
  watch(tracks, onTracksChange)

  function onTracksChange(val: UserTrackModel[] | undefined) {
    const newMarkers = genMarkers(val)
    markers.value = newMarkers
    updatePolylinePath(val)
    fitMapBounds(newMarkers)
  }

  async function onMarkerSelected(marker: GoogleMarker | null) {
    if (!marker) {
      infoWindowPosition.value = null
      return
    }

    focusToMarker(marker)
    const regeo = await fetchRegeo(marker)
    regeoInfo.value = regeo
    renderInfoWindow(marker, regeo)
  }

  async function fetchRegeo(marker: GoogleMarker) {
    return await weilaApi.value.v2.fetch<RegeoModel>('loc/regeo', {
      body: {
        lon: marker.position.lng,
        lat: marker.position.lat,
        radius: 300,
      },
    })
  }

  function genMarkers(val: UserTrackModel[] | undefined): GoogleMarker[] {
    if (!val?.length) {
      return []
    }

    try {
      // 生成标记点
      return val.map(({ lng, lat, created }) => ({
        id: nanoid(),
        position: { lat, lng },
        created,
        longitude: lng,
        latitude: lat,
        userId: selectedMarker.value?.userId || '',
      }))
    }
    catch (error) {
      console.error('Error generating markers:', error)
      return []
    }
  }

  function updatePolylinePath(val: UserTrackModel[] | undefined) {
    if (!val?.length) {
      polylinePath.value = []
      return
    }

    polylinePath.value = val.map(track => ({
      lat: track.lat,
      lng: track.lng,
    }))
  }

  function fitMapBounds(markers: GoogleMarker[]) {
    if (!markers.length) {
      return
    }

    // For Google Maps, we'll adjust the center and zoom instead of using bounds
    // This is a simplified approach - in a real implementation you might want to
    // calculate the appropriate center and zoom level based on all markers
    if (markers.length === 1) {
      center.value = markers[0].position
      zoom.value = 15
    }
    else {
      // Calculate center point for multiple markers
      const avgLat = markers.reduce((sum, marker) => sum + marker.position.lat, 0) / markers.length
      const avgLng = markers.reduce((sum, marker) => sum + marker.position.lng, 0) / markers.length
      center.value = { lat: avgLat, lng: avgLng }
      zoom.value = 12
    }
  }

  function focusToMarker(marker: GoogleMarker) {
    drawerVisible.value = false
    center.value = marker.position
    zoom.value = 15
  }

  function renderInfoWindow(marker: GoogleMarker, info?: RegeoModel) {
    if (!info) {
      infoWindowPosition.value = null
      return
    }

    const content = `
      <div style="color: black; max-width: 300px;">
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">${t('location-detail')}</h3>
        <div style="margin-bottom: 8px;">
          ${info.province + info.city + info.district + info.township + info.Address}
        </div>
        <div>
          <span style="margin-right: 8px;">${t('time')}</span> <span>${new Date(marker.created * 1000).toLocaleString()}</span>
        </div>
        <div>
          <span style="margin-right: 8px;">${t('longitude')}</span> <span>${marker.longitude}</span>
        </div>
        <div>
          <span style="margin-right: 8px;">${t('latitude')}</span> <span>${marker.latitude}</span>
        </div>
      </div>
    `

    nextTick(() => {
      infoWindowPosition.value = marker.position
      infoWindowContent.value = content
      isInfoWindowOpen.value = true
    })
  }

  return {
    trackVisible,
    drawerVisible,
    zoom,
    center,
    map,
    markers,
    selectedMarker,
    polylinePath,
    isInfoWindowOpen,
    infoWindowPosition,
    infoWindowContent,
  }
}
