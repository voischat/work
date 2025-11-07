import type { Ref } from 'vue'

export function fitMapBounds(
  markers: Array<{ position: { lat: number, lng: number } }>,
  center: Ref<{ lat: number, lng: number }>,
  zoom: Ref<number>,
  map: any,
): void {
  if (!markers.length) {
    return
  }

  // 如果只有一个标记点，调用 focusToMarker 函数
  if (markers.length === 1) {
    focusToMarker(markers[0], center, zoom)
  }
  else {
    // 创建 LatLngBounds 对象
    const bounds = new google.maps.LatLngBounds()

    // 把坐标加入 bounds
    markers.forEach(marker => bounds.extend(marker.position))

    // 设置地图视野
    if (map) {
      map.fitBounds(bounds)
    }
  }
}

/**
 * 聚焦到单个标记点
 * @param marker 标记点
 * @param center 中心点引用
 * @param zoom 缩放级别引用
 */
export function focusToMarker(
  marker: { position: { lat: number, lng: number } },
  center: Ref<{ lat: number, lng: number }>,
  zoom: Ref<number>,
): void {
  center.value = marker.position
  zoom.value = 15
}
