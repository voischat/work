<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
import { ElAmap, ElAmapLayerSatellite } from '@vuemap/vue-amap'
import { computed, onMounted, shallowRef, toRef, watch } from 'vue'

import { useRealtimeLocation } from '~/composables/useRealtimeLocation'
import { useRealtimeMapInteraction } from '~/composables/useRealtimeMapInteraction'
import { useUserInfoStore } from '~/composables/useUserInfoStore'

const props = defineProps<{
  type: 'dept' | 'group' | 'individual'
  id: number | undefined
}>()

const { t } = useI18n()

const satelliteVisible = shallowRef(false)

const selectedType = toRef(props, 'type')
const selectedId = shallowRef(props.id)

watch(() => props.id, (newId) => {
  selectedId.value = newId
})

const {
  locations,
  refetch,
  isError,
  error,
} = useRealtimeLocation(selectedType, selectedId)
const { getUserInfo, preloadMembers } = useUserInfoStore()
const {
  zoom,
  center,
  map,
  markers,
  selectedMarker,
} = useRealtimeMapInteraction(locations)

const locationFields = [
  { key: 'userName' },
  { key: 'user_num', label: t('weila-number') },
  { key: 'phone', label: t('phone') },
  { key: 'ts', label: t('time'), formatter: (v: number) => new Date(v * 1000).toLocaleString() },
  { key: 'lng', label: t('longitude'), formatter: (v: number) => v.toFixed(6) },
  { key: 'lat', label: t('latitude'), formatter: (v: number) => v.toFixed(6) },
  { key: 'spd', label: t('speed'), formatter: (v: number) => `${v.toFixed(2)} km/h` },
]

const locationListItems = computed(() => {
  if (!markers.value?.length)
    return []

  return markers.value
    .map((marker) => {
      const extData = marker.getExtData()
      const userInfo = getUserInfo(extData.uid)
      return {
        marker,
        userName: userInfo?.name || `用户${extData.uid}`,
        user_num: userInfo?.user_num || '-',
        phone: userInfo?.phone || '-',
        ts: extData.ts,
        lng: extData.longitude,
        lat: extData.latitude,
        spd: extData.spd,
      }
    })
    .sort((a, b) => a.userName.localeCompare(b.userName))
})

function handleLocationClick(item: any) {
  selectedMarker.value = item.marker
}

const fetchState = computed(() => {
  if (selectedId.value === undefined)
    return 'idle'
  if (isError.value)
    return 'error'
  if (!locations.value?.length)
    return 'empty'
  return 'success'
})

const latestLocationDate = computed(() => {
  if (!locations.value?.length)
    return undefined
  const latest = locations.value.reduce((max, loc) => loc.ts > max.ts ? loc : max)
  return new Date(latest.ts * 1000).toLocaleString()
})

function handleFocus() {
  map.value?.setFitView(markers.value)
}

// 组件挂载时立即获取位置（确保 v-if 切换后能立刻加载）
onMounted(() => {
  if (selectedId.value !== undefined) {
    refetch()
  }
})

// 监听选择变化，预加载成员信息
watch([selectedType, selectedId], async ([type, id]) => {
  if (id !== undefined) {
    await preloadMembers(type, id)
  }
}, { immediate: true })
</script>

<template>
  <div min-h-0 flex-1 of-hidden relative>
    <MapStatusCapsule
      :state="fetchState"
      :date="latestLocationDate"
      :error-message="error?.message"
      :items="locationListItems"
      :fields="locationFields"
      @focus="handleFocus"
      @refresh="() => refetch().then(() => Message.success(t('message.refresh-success')))"
      @item-click="handleLocationClick"
    />

    <ElAmap :center="center" :zoom="zoom" relative h-full w-full @init="(m) => map = m">
      <ElAmapLayerSatellite :visible="satelliteVisible" />

      <!-- 标记点会自动通过 composable 渲染 -->

      <MapTypeSwitcher v-model="satelliteVisible" />
    </ElAmap>
  </div>
</template>
