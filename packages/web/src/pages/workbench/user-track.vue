<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
import { importLibrary } from '@googlemaps/js-api-loader'
import { useRouteQuery } from '@vueuse/router'
import dayjs from 'dayjs'
import { shallowRef } from 'vue'
import { AdvancedMarker, GoogleMap, InfoWindow, Polyline } from 'vue3-google-map'
import { useDeptTree } from '~/composables/useDeptTree'
import { useMapInteraction } from '~/composables/useMapInteraction'
import { useMapOptions } from '~/composables/useMapOptions'
import { useUserTrack } from '~/composables/useTrackData'

definePage({
  meta: {
    name: 'submenu.user-track',
  },
})

const key = import.meta.env.VITE_GOOGLE_MAP_KEY

const { locale } = useI18n()

useMapOptions(() => ({
  key,
  v: 'weekly',
  language: locale.value,
  region: locale.value,
}))

Promise.all([
  importLibrary('maps'),
  importLibrary('marker'), // Required for AdvancedMarker component
])

const { t } = useI18n()

// 用户选择状态
const selectedUserKeys = shallowRef('')
const selectedDate = useRouteQuery('date', new Date().toISOString().split('T')[0])

// 使用composables
const { treeData, loadMore } = useDeptTree()
const { tracks, trackFeatureCollection, refetch } = useUserTrack(selectedUserKeys, selectedDate)
const {
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
  updateSelectedMarker,
} = useMapInteraction(tracks)

$inspect(trackFeatureCollection)

function onClickMarker(marker: any) { // marker actually not GoogleMarker
  updateSelectedMarker(marker)
}
</script>

<template>
  <div flex gap2 p4 bg-base>
    <a-tree-select
      v-model="selectedUserKeys"
      :data="treeData"
      :load-more
      :placeholder="t('hint.please-select')"
      :block-node="true"
      max-w-60
      grow-1
    />
    <a-date-picker v-model="selectedDate" max-w-40 grow-1 :disabled-date="(current: any) => dayjs(current).isAfter(dayjs())" />
    <a-tooltip :content="t('button.refresh')">
      <a-button
        v-if="tracks?.length" shape="circle"
        @click="() => refetch().then(() => {
          Message.success(t('message.refresh-success'))
        })"
      >
        <icon-refresh />
      </a-button>
    </a-tooltip>
  </div>
  <div h-full w-full>
    <GoogleMap
      :api-key="key"
      map-id="user-track"
      relative
      :center="center"
      :zoom="zoom"
      style="width: 100%; height: 100%"
      @load="(m) => map = m"
    >
      <Polyline
        v-if="trackVisible && polylinePath.length"
        :options="{
          path: polylinePath,
          geodesic: true,
          strokeColor: '#41ab5d',
          strokeOpacity: 1.0,
          strokeWeight: 2,
        }"
      />

      <AdvancedMarker
        v-for="marker in markers"
        :key="marker.id"
        :options="{
          position: marker.position,
          title: new Date(marker.created * 1000).toLocaleString(),
        }"
        @click="() => onClickMarker(marker)"
      />

      <InfoWindow
        v-if="infoWindowPosition && selectedMarker"
        v-model="isInfoWindowOpen"
        :options="{
          position: infoWindowPosition,
          content: infoWindowContent,
          pixelOffset: {
            height: -50,
          },

        }"
      />

      <a-button
        v-if="markers?.length" type="primary" shape="circle" class="absolute right-4 top-20"
        @click="drawerVisible = true"
      >
        <template #icon>
          <icon-menu />
        </template>
      </a-button>
    </GoogleMap>

    <a-drawer v-model:visible="drawerVisible" :width="340" unmount-on-close>
      <template #title>
        {{ t('user-track') }}
      </template>
      <a-list item-layout="horizontal">
        <a-list-item v-for="marker in markers" :key="marker.id">
          <a-list-item-meta>
            <template #title>
              {{ new Date(marker.created * 1000).toLocaleString() }}
            </template>
            <template #description>
              <span mr2>{{ t('longitude') }}</span> <span>{{ marker.longitude.toFixed(6) }}</span>
              <br>
              <span mr2>{{ t('latitude') }}</span> <span>{{ marker.latitude.toFixed(6) }}<br></span>
            </template>
          </a-list-item-meta>
          <template #extra>
            <a-button type="primary" size="small" @click="() => onClickMarker(marker)">
              {{ t('button.checkout') }}
            </a-button>
          </template>
        </a-list-item>
      </a-list>
    </a-drawer>
  </div>
</template>
