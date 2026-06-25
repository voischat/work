<script setup lang="ts">
import type { OrgTreeSelectedItem } from '~/components/OrgTree.vue'
import { Message } from '@arco-design/web-vue'
import { ElAmap, ElAmapLayerSatellite } from '@vuemap/vue-amap'
import { ElAmapLoca, ElAmapLocaLine } from '@vuemap/vue-amap-loca'
import { useRouteQuery } from '@vueuse/router'
import dayjs from 'dayjs'

import { computed, shallowRef } from 'vue'
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

// 使用composables
const {
  tracks,
  trackFeatureCollection,
  refetch,
  isError,
  error,
} = useUserTrack(selectedUserKeys, selectedDate)
const {
  trackVisible,
  drawerVisible,
  zoom,
  center,
  map,
  markers,
  selectedMarker,
  layerStyle,
} = useMapInteraction(tracks)

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

$inspect(trackFeatureCollection)

function onMarkerSelected(marker: AMap.Marker) {
  selectedMarker.value = marker
  triggerRef(selectedMarker)
}

function onFocusAllMarkers() {
  map.value?.setFitView(markers.value)
}
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
          <a-tooltip :content="t('button.refresh')">
            <a-button
              type="outline"
              @click="() => refetch().then(() => {
                Message.success(t('message.refresh-success'))
              })"
            >
              <template #icon>
                <icon-refresh />
              </template>
            </a-button>
          </a-tooltip>
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <OrgTree v-model:selected="selectedOrgItems" select-mode="solo" />
      </div>
    </aside>
    <div min-w-0 flex-1 of-hidden relative>
      <LocationFetchStatus
        :state="fetchState"
        :date="latestDate"
        :error-message="error?.message"
        @focus="onFocusAllMarkers"
        @refresh="() => refetch().then(() => Message.success(t('message.refresh-success')))"
      />

      <ElAmap :center="center" :zoom="zoom" relative h-full w-full @init="(m) => map = m">
        <ElAmapLayerSatellite :visible="satelliteVisible" />

        <ElAmapLoca>
          <ElAmapLocaLine :visible="trackVisible" :source-data="trackFeatureCollection" :layer-style="layerStyle" />
        </ElAmapLoca>

        <MapTypeSwitcher v-model="satelliteVisible" />

        <a-button
          v-if="markers?.length" type="primary" shape="circle" class="absolute right-4 top-4"
          @click="drawerVisible = true"
        >
          <template #icon>
            <icon-menu />
          </template>
        </a-button>
      </ElAmap>

      <a-drawer v-model:visible="drawerVisible" :width="340" unmount-on-close>
        <template #title>
          {{ t('user-track') }}
        </template>
        <a-list item-layout="horizontal">
          <a-list-item v-for="marker, key in markers" :key>
            <a-list-item-meta>
              <template #title>
                {{ new Date(marker.getExtData().created * 1000).toLocaleString() }}
              </template>
              <template #description>
                <span mr2>{{ t('longitude') }}</span> <span>{{ (marker.getExtData().longitude as number).toFixed(6) }}</span>
                <br>
                <span mr2>{{ t('latitude') }}</span> <span>{{ (marker.getExtData().latitude as number).toFixed(6) }}<br></span>
              </template>
            </a-list-item-meta>
            <template #extra>
              <a-button type="primary" size="small" @click="() => onMarkerSelected(marker)">
                {{ t('button.checkout') }}
              </a-button>
            </template>
          </a-list-item>
        </a-list>
      </a-drawer>
    </div>
  </div>
</template>
