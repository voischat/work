import type { RealtimeLocationModel } from '~/api/realtime-location'
import type { RegeoModel } from '~/api/track'
import { isNumber } from '@antfu/utils'
import { nanoid } from 'nanoid'
import { nextTick, shallowRef, watch } from 'vue'

export function useRealtimeMapInteraction(
  locations: Ref<RealtimeLocationModel[] | undefined>,
) {
  const { t } = useI18n()
  const userInfoStore = useUserInfoStore()

  const zoom = shallowRef(12)
  const center = shallowRef([121.59996, 31.197646])
  const map = shallowRef<AMap.Map | null>(null)
  const markers = shallowRef<AMap.Marker[]>([])
  const infoWindow = shallowRef<AMap.InfoWindow | undefined>(undefined)
  const selectedMarker = shallowRef<AMap.Marker | null>(null)
  const boundsFitted = shallowRef(false)

  const weilaApi = useWeilaApi()
  const regeoInfo = shallowRef<RegeoModel | undefined>(undefined)

  watch(selectedMarker, onMarkerSelected)
  watch(locations, onLocationsChange)

  function onLocationsChange(val: RealtimeLocationModel[] | undefined) {
    const newMarkers = genMarkers(val)
    renderMarkers(newMarkers, markers.value)
    markers.value = newMarkers
  }

  async function onMarkerSelected(marker: AMap.Marker | null) {
    focusToMarker(marker)
    const regeo = regeoInfo.value = await fetchRegeo()
    renderInfoWindow(regeo)
  }

  async function fetchRegeo() {
    if (!selectedMarker.value)
      return

    const pos = selectedMarker.value?.getPosition()
    if (!pos)
      throw new Error('No position')

    return await weilaApi.value.v2.fetch<RegeoModel>('loc/regeo', {
      body: {
        lon: pos?.getLng(),
        lat: pos?.getLat(),
        radius: 300,
      },
    })
  }

  function genMarkers(val: RealtimeLocationModel[] | undefined): AMap.Marker[] {
    if (!val?.length) {
      return []
    }

    try {
      return val.map(({ lng, lat, uid, ts, spd, dir }) => {
        const userInfo = userInfoStore.getUserInfo(uid)
        const avatarUrl = userInfo?.avatar?.replace(/^https?:/, '') || ''

        const content = avatarUrl
          ? `<div style="
            width: 50px;
            height: 50px;
            border-radius: 50%;
            overflow: hidden;
            border: 4px solid #00DC82;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            background-image: url('${avatarUrl}');
            background-size: cover;
            background-position: center;
          "></div>`
          : `<div style="
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
          </div>`

        const marker = new AMap.Marker({
          position: [lng, lat],
          content,
          offset: new AMap.Pixel(-16, -16),
          extData: {
            id: nanoid(),
            uid,
            ts,
            spd,
            dir,
            longitude: lng,
            latitude: lat,
          },
        })

        marker.on('click', () => {
          selectedMarker.value = marker
          triggerRef(selectedMarker)
        })
        return marker
      })
    }
    catch (error) {
      console.error('Error adding markers:', error)
      return []
    }
  }

  function renderMarkers(val: AMap.Marker[], oldVal: AMap.Marker[]) {
    if (oldVal.length) {
      oldVal?.forEach((marker) => {
        map.value?.remove(marker)
        marker.remove()
      })
    }

    const renderMarker = async (map: AMap.Map) => {
      val.forEach(i => map.add(i))

      if (val.length && !boundsFitted.value) {
        try {
          map.setFitView(val)
          boundsFitted.value = true
        }
        catch (error) {
          console.error('Error fitting bounds:', error)
        }
      }

      return true
    }

    if (map.value) {
      renderMarker(map.value)
    }
    else {
      const { stop } = watch(map, (m) => {
        if (m)
          renderMarker(m).then(stop)
      }, { immediate: true })
    }
  }

  function focusToMarker(marker: AMap.Marker | null) {
    if (!marker)
      return

    const pos = marker.getPosition()
    if (!pos)
      return

    const { lng, lat } = pos
    if (!isNumber(lng) || !isNumber(lat))
      return

    map.value?.setCenter([lng, lat])
    map.value?.setZoom(16)
  }

  function renderInfoWindow(info?: RegeoModel) {
    if (!selectedMarker.value)
      return

    const extData = selectedMarker.value.getExtData()
    const userInfo = userInfoStore.getUserInfo(extData.uid)

    const content = `
      <div color-black>
        <h3 class="text-lg font-semibold mb-2">${userInfo?.name || `用户${extData.uid}`}</h3>
        <div class="mb-2 ">
          ${info
            ? (info.province + info.city + info.district + info.township + info.Address)
            : t('loading')}
        </div>
        ${userInfo?.user_num
          ? `
        <div>
          <span mr2>${t('weila-number')}</span> <span>${userInfo.user_num}</span>
        </div>
        `
          : ''}
        ${userInfo?.phone
          ? `
        <div>
          <span mr2>${t('phone')}</span> <span>${userInfo.phone}</span>
        </div>
        `
          : ''}
        <div>
          <span mr2>${t('time')}</span> <span>${new Date(extData.ts * 1000).toLocaleString()}</span>
        </div>
        <div>
          <span mr2>${t('longitude')}</span> <span>${(extData.longitude as number).toFixed(6)}</span>
        </div>
        <div>
          <span mr2>${t('latitude')}</span> <span>${(extData.latitude as number).toFixed(6)}</span>
        </div>
        <div>
          <span mr2>${t('speed')}</span> <span>${(extData.spd as number).toFixed(2)} km/h</span>
        </div>
        <div>
          <span mr2>${t('direction')}</span> <span>${extData.dir}°</span>
        </div>
      </div>
    `

    nextTick(() => {
      const pos = selectedMarker.value?.getPosition()
      if (!pos)
        return
      const { lng, lat } = pos
      if (!isNumber(lng) || !isNumber(lat))
        return

      if (!infoWindow.value) {
        infoWindow.value = new AMap.InfoWindow({
          offset: new AMap.Pixel(0, -30),
        })
      }

      infoWindow.value?.setContent(content)

      if (map.value)
        infoWindow.value.open(map.value, [lng, lat])
    })
  }

  return {
    zoom,
    center,
    map,
    markers,
    selectedMarker,
  }
}
