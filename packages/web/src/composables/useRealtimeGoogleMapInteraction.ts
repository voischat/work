import type { RealtimeLocationModel } from '~/api/realtime-location'
import type { RegeoModel } from '~/api/track'
import { nanoid } from 'nanoid'
import { nextTick, shallowRef, triggerRef, watch } from 'vue'

export interface GoogleRealtimeMarker {
  id: string
  position: { lat: number, lng: number }
  uid: number
  ts: number
  spd: number
  dir: number
  longitude: number
  latitude: number
  content?: HTMLElement
}

export function useRealtimeGoogleMapInteraction(
  locations: Ref<RealtimeLocationModel[] | undefined>,
) {
  const { t } = useI18n()
  const userInfoStore = useUserInfoStore()

  // 地图相关状态
  const drawerVisible = shallowRef(false)
  const zoom = shallowRef(12)
  const center = shallowRef({ lat: 31.197646, lng: 121.59996 })
  const map = shallowRef<any | null>(null)
  const markers = shallowRef<GoogleRealtimeMarker[]>([])
  const selectedMarker = shallowRef<GoogleRealtimeMarker | null>(null)

  // 逆地理编码相关
  const weilaApi = useWeilaApi()
  const regeoInfo = shallowRef<RegeoModel | undefined>(undefined)

  // InfoWindow 相关
  const isInfoWindowOpen = shallowRef(false)
  const infoWindowPosition = shallowRef<{ lat: number, lng: number } | null>(null)
  const infoWindowContent = shallowRef<string>('')

  watch(selectedMarker, onMarkerSelected)
  watch(locations, onLocationsChange)

  function onLocationsChange(val: RealtimeLocationModel[] | undefined) {
    const newMarkers = genMarkers(val)
    markers.value = newMarkers
    // if (map.value)
    // fitMapBounds(newMarkers, map.value)
  }

  async function onMarkerSelected(marker: GoogleRealtimeMarker | null) {
    if (!marker) {
      infoWindowPosition.value = null
      return
    }

    drawerVisible.value = false
    center.value = marker.position
    zoom.value = 15
    const regeo = await fetchRegeo(marker)
    regeoInfo.value = regeo
    renderInfoWindow(marker, regeo)
  }

  async function fetchRegeo(marker: GoogleRealtimeMarker) {
    return await weilaApi.value.v2.fetch<RegeoModel>('loc/regeo', {
      body: {
        lon: marker.position.lng,
        lat: marker.position.lat,
        radius: 300,
      },
    })
  }

  function genMarkers(val: RealtimeLocationModel[] | undefined): GoogleRealtimeMarker[] {
    if (!val?.length) {
      return []
    }

    try {
      // 生成标记点
      return val.map(({ lng, lat, uid, ts, spd, dir }) => {
        const userInfo = userInfoStore.getUserInfo(uid)
        const avatarUrl = userInfo?.avatar?.replace(/^https?:/, '') || ''

        // 创建自定义头像内容
        const content = document.createElement('div')
        if (avatarUrl) {
          content.innerHTML = `
            <div style="
              width: 50px;
              height: 50px;
              border-radius: 50%;
              overflow: hidden;
              border: 4px solid #00DC82;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              background-image: url('${avatarUrl}');
              background-size: cover;
              background-position: center;
            "></div>
          `
        }
        else {
          content.innerHTML = `
            <div style="
              width: 50px;
              height: 50px;
              border-radius: 50%;
              overflow: hidden;
              border: 4px solid #00DC82;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              background: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32">
                <path fill="none" d="M8.007 24.93A4.996 4.996 0 0 1 13 20h6a4.996 4.996 0 0 1 4.993 4.93a11.94 11.94 0 0 1-15.986 0M20.5 12.5A4.5 4.5 0 1 1 16 8a4.5 4.5 0 0 1 4.5 4.5"/>
                <path fill="#666" d="M26.749 24.93A13.99 13.99 0 1 0 2 16a13.9 13.9 0 0 0 3.251 8.93l-.02.017c.07.084.15.156.222.239c.09.103.187.2.28.3q.418.457.87.87q.14.124.28.242q.48.415.99.782c.044.03.084.069.128.1v-.012a13.9 13.9 0 0 0 16 0v.012c.044-.031.083-.07.128-.1q.51-.368.99-.782q.14-.119.28-.242q.451-.413.87-.87c.093-.1.189-.197.28-.3c.071-.083.152-.155.222-.24ZM16 8a4.5 4.5 0 1 1-4.5 4.5A4.5 4.5 0 0 1 16 8M8.007 24.93A4.996 4.996 0 0 1 13 20h6a4.996 4.996 0 0 1 4.993 4.93a11.94 11.94 0 0 1-15.986 0"/>
              </svg>
            </div>
          `
        }

        return {
          id: nanoid(),
          position: { lat, lng },
          uid,
          ts,
          spd,
          dir,
          longitude: lng,
          latitude: lat,
          content: content.firstElementChild as HTMLElement,
        }
      })
    }
    catch (error) {
      console.error('Error generating markers:', error)
      return []
    }
  }

  function renderInfoWindow(marker: GoogleRealtimeMarker, info?: RegeoModel) {
    const userInfo = userInfoStore.getUserInfo(marker.uid)

    const content = `
      <div style="color: black; max-width: 300px;">
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">${userInfo?.name || `用户${marker.uid}`}</h3>
        <div style="margin-bottom: 8px;">
          ${info ? (info.province + info.city + info.district + info.township + info.Address) : t('loading')}
        </div>
        ${userInfo?.user_num
          ? `
        <div>
          <span style="margin-right: 8px;">${t('weila-number')}</span> <span>${userInfo.user_num}</span>
        </div>
        `
          : ''}
        ${userInfo?.phone
          ? `
        <div>
          <span style="margin-right: 8px;">${t('phone')}</span> <span>${userInfo.phone}</span>
        </div>
        `
          : ''}
        <div>
          <span style="margin-right: 8px;">${t('time')}</span> <span>${new Date(marker.ts * 1000).toLocaleString()}</span>
        </div>
        <div>
          <span style="margin-right: 8px;">${t('longitude')}</span> <span>${marker.longitude.toFixed(2)}</span>
        </div>
        <div>
          <span style="margin-right: 8px;">${t('latitude')}</span> <span>${marker.latitude.toFixed(2)}</span>
        </div>
        <div>
          <span style="margin-right: 8px;">${t('speed')}</span> <span>${marker.spd.toFixed(2)} km/h</span>
        </div>
        <div>
          <span style="margin-right: 8px;">${t('direction')}</span> <span>${marker.dir}°</span>
        </div>
      </div>
    `

    nextTick(() => {
      infoWindowPosition.value = marker.position
      infoWindowContent.value = content
      isInfoWindowOpen.value = true
    })
  }

  function updateSelectedMarker(marker: GoogleRealtimeMarker | null) {
    selectedMarker.value = marker
    triggerRef(selectedMarker)
  }

  return {
    drawerVisible,
    zoom,
    center,
    map,
    markers,
    selectedMarker,
    isInfoWindowOpen,
    infoWindowPosition,
    infoWindowContent,
    updateSelectedMarker,
  }
}
