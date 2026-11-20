<script setup lang="ts">
import type { OrgTreeSelectedItem } from '~/components/orgTreeSelection'
import { Message } from '@arco-design/web-vue'
import { ElAmap, ElAmapLayerSatellite } from '@vuemap/vue-amap'
import { ElAmapLoca, ElAmapLocaLine } from '@vuemap/vue-amap-loca'
import { useRouteQuery } from '@vueuse/router'
import dayjs from 'dayjs'

import { computed, shallowRef, watch } from 'vue'
import MapStatusCapsule from '~/components/MapStatusCapsule.vue'
import { useMapInteraction } from '~/composables/useMapInteraction'
import { useUserTrack } from '~/composables/useTrackData'

definePage({
  meta: {
    name: 'submenu.user-track',
  },
})

const { t } = useI18n()

const selectedOrgItems = shallowRef<OrgTreeSelectedItem[]>([])
const selectedUserKeys = computed(() => String(selectedOrgItems.value[0]?.id ?? ''))
const selectedDate = useRouteQuery('date', new Date().toISOString().split('T')[0])
const satelliteVisible = shallowRef(false)
const capsuleRef = shallowRef<InstanceType<typeof MapStatusCapsule>>()

const {
  tracks,
  trackFeatureCollection,
  refetch,
  isError,
  error,
} = useUserTrack(selectedUserKeys, selectedDate)
const {
  trackVisible,
  zoom,
  center,
  map,
  markers,
  selectedMarker,
  layerStyle,
} = useMapInteraction(tracks)

const trackFields = [
  {
    key: 'created',
    label: t('time'),
    formatter: (v: number) => new Date(v * 1000).toLocaleString(),
  },
  {
    key: 'lng',
    label: t('longitude'),
    formatter: (v: number) => v.toFixed(6),
  },
  {
    key: 'lat',
    label: t('latitude'),
    formatter: (v: number) => v.toFixed(6),
  },
]

function handleTrackClick(item: any, index: number) {
  const marker = markers.value[index]
  if (marker) {
    selectedMarker.value = marker
    triggerRef(selectedMarker)
  }
}

const fetchState = computed(() => {
  if (!selectedOrgItems.value.length || !selectedDate.value)
    return 'idle'
  if (isError.value)
    return 'error'
  if (!tracks.value?.length)
    return 'empty'
  return 'success'
})

const latestDate = computed(() => {
  if (!tracks.value?.length)
    return undefined
  const latest = Math.max(...tracks.value.map(t => t.created))
  return new Date(latest * 1000).toLocaleString()
})

const canFetch = computed(() => !!selectedOrgItems.value.length && !!selectedDate.value)

$inspect(trackFeatureCollection)

function onFocusAllMarkers() {
  map.value?.setFitView(markers.value)
}

watch(map, (m) => {
  if (!m)
    return
  const onInteract = () => capsuleRef.value?.flashMessage()
  m.on('mapmove', onInteract)
  m.on('zoomchange', onInteract)
}, { once: true })
</script>

<template>
  <div h-full min-h-0 flex>
    <aside class="w-86 shrink-0 border-r border-neutral-200 bg-white flex flex-col min-h-0">
      <div class="border-b border-neutral-100 p-4">
        <div class="mb-3 text-base font-medium">
          {{ t('user-track') }}
        </div>
        <div class="flex gap-2">
          <a-date-picker v-model="selectedDate" class="min-w-0 flex-1" :disabled-date="(current: any) => dayjs(current).isAfter(dayjs())" />
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <OrgTree v-model:selected="selectedOrgItems" select-mode="solo" />
      </div>
    </aside>
    <div min-w-0 flex-1 of-hidden relative>
      <MapStatusCapsule
        ref="capsuleRef"
        :state="fetchState"
        :date="latestDate"
        :error-message="error?.message"
        :items="tracks"
        :fields="trackFields"
        :can-fetch="canFetch"
        @focus="onFocusAllMarkers"
        @refresh="() => refetch().then(() => Message.success(t('message.refresh-success')))"
        @item-click="handleTrackClick"
      />

      <ElAmap :center="center" :zoom="zoom" relative h-full w-full @init="(m) => map = m">
        <ElAmapLayerSatellite :visible="satelliteVisible" />

        <ElAmapLoca>
          <ElAmapLocaLine :visible="trackVisible" :source-data="trackFeatureCollection" :layer-style="layerStyle" />
        </ElAmapLoca>

        <MapTypeSwitcher v-model="satelliteVisible" />
      </ElAmap>
    </div>
  </div>
</template>
