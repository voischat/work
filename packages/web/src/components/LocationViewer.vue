<script setup lang="ts">
import { ElAmap } from '@vuemap/vue-amap'
import { shallowRef } from 'vue'

const props = defineProps<{
  latitude: number
  longitude: number
  name?: string
  address?: string
}>()

const { t } = useI18n()

const map = shallowRef<AMap.Map>()
const center: [number, number] = [props.longitude, props.latitude]

const amapUrl = `https://uri.amap.com/marker?position=${props.longitude},${props.latitude}`

const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
  <path fill="#1677ff" d="M16 0C9.373 0 4 5.373 4 12c0 9 12 26 12 26s12-17 12-26C28 5.373 22.627 0 16 0z"/>
  <circle cx="16" cy="11" r="5" fill="#fff"/>
</svg>`

function handleInit(m: AMap.Map) {
  map.value = m

  const marker = new AMap.Marker({
    position: center,
    content: pinSvg,
    offset: new AMap.Pixel(-16, -40),
  })
  m.add(marker)
}

function openInAmap() {
  window.open(amapUrl, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div relative h-full w-full>
    <ElAmap :center="center" :zoom="15" absolute inset-0 @init="handleInit" />
    <div v-if="name || address" absolute left-4 top-4 rounded-lg bg-white:90 p3 shadow backdrop-blur-sm>
      <div v-if="name" text-sm font-bold truncate max-w="60vw">
        {{ name }}
      </div>
      <div v-if="address && address !== name" text-xs text-neutral-500 truncate max-w="60vw">
        {{ address }}
      </div>
    </div>
    <a-button absolute bottom-4 right-4 type="primary" @click="openInAmap">
      {{ t('chat.location.open-in-amap') }}
    </a-button>
  </div>
</template>
