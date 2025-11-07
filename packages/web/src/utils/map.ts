export function fitMapBounds(
  markers: Array<{ position: { lat: number, lng: number } }>,
  map: google.maps.Map,
): void {
  if (!markers.length)
    return

  if (markers.length === 1) {
    map.setCenter(markers[0].position)
    map.setZoom(15)
  }
  else {
    const bounds = new google.maps.LatLngBounds()
    markers.forEach(marker => bounds.extend(marker.position))

    map.fitBounds(bounds)
  }
}
