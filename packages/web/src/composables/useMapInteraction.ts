import type { RegeoModel, UserTrackModel } from '~/api/track'
import { isNull, isNumber, isUndefined } from '@antfu/utils'
import { nanoid } from 'nanoid'
import { ref as deepRef, nextTick, shallowRef, watch } from 'vue'

export function useMapInteraction(tracks: Ref<UserTrackModel[] | undefined>) {
  const { t } = useI18n()

  // 地图相关状态
  const trackVisible = shallowRef(true)
  const zoom = shallowRef(12)
  const center = shallowRef([121.59996, 31.197646])
  const map = shallowRef<AMap.Map | null>(null)
  const markers = shallowRef<AMap.Marker[]>([])
  const infoWindow = shallowRef<AMap.InfoWindow | undefined>(undefined)
  const selectedMarker = shallowRef<AMap.Marker | null>(null)

  // 逆地理编码相关
  const weilaApi = useWeilaApi()
  const regeoInfo = shallowRef<RegeoModel | undefined>(undefined)

  // 图层样式
  const layerStyle = deepRef({
    color: '#41ab5d',
    lineWidth: 2,
    dashArray: [10, 0, 10, 0],
  })

  watch(selectedMarker, onMarkerSelected)
  watch(tracks, onTracksChange)

  function onTracksChange(val: UserTrackModel[] | undefined) {
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

  function genMarkers(val: UserTrackModel[] | undefined): AMap.Marker[] {
    if (!val?.length) {
      return []
    }

    try {
      // 生成标记点
      return val.map(({ lng, lat, created }) => {
        const marker = new AMap.Marker({
          position: [lng, lat],
          extData: {
            id: nanoid(),
            userId: selectedMarker.value?.getExtData()?.userId || '',
            created,
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

  // 渲染标记点到地图

  function renderMarkers(val: AMap.Marker[], oldVal: AMap.Marker[]) {
    if (oldVal.length) {
      oldVal?.forEach((marker) => {
        map.value?.remove(marker)
        marker.remove()
      })
    }

    const renderMarker = async (map: AMap.Map) => {
      val.forEach(i => map.add(i))

      if (val.length)
        map.setFitView([...val, infoWindow.value].filter(i => !isUndefined(i) && !isNull(i)))

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
  }

  function renderInfoWindow(info?: RegeoModel) {
    if (!info)
      return

    const content = `
      <div color-black>
        <h3 class="text-lg font-semibold mb-2">${t('location-detail')}</h3>
        <div class="mb-2 ">
          ${info.province + info.city + info.district + info.township + info.Address}
        </div>
        <div>
          <span mr2>${t('time')}</span> <span>${new Date(selectedMarker.value?.getExtData().created * 1000).toLocaleString()}</span>
        </div>
        <div>
          <span mr2>${t('longitude')}</span> <span>${(selectedMarker.value?.getExtData().longitude as number).toFixed(6)}</span>
        </div>
        <div>
          <span mr2>${t('latitude')}</span> <span>${(selectedMarker.value?.getExtData().latitude as number).toFixed(6)}<br></span>
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
    trackVisible,
    zoom,
    center,
    map,
    markers,
    selectedMarker,
    layerStyle,
  }
}
