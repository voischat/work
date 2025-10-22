<script setup lang="ts">
import { ElAmap } from '@vuemap/vue-amap'
import { ElAmapLoca, ElAmapLocaLine } from '@vuemap/vue-amap-loca'
import { shallowRef } from 'vue'

import { useDeptTree } from '~/composables/useDeptTree'
import { useMapInteraction } from '~/composables/useMapInteraction'
import { useUserTrack } from '~/composables/useTrackData'

definePage({
  meta: {
    name: 'submenu.user-track',
  },
})

const { t } = useI18n()

// 用户选择状态
const selectedUserKeys = shallowRef('')
const selectedDate = shallowRef('')

// 使用composables
const { treeData, loadMore } = useDeptTree()
const { tracks, trackFeatureCollection } = useUserTrack(selectedUserKeys, selectedDate)
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

$inspect(trackFeatureCollection)

function onMarkerSelected(marker: AMap.Marker) {
  selectedMarker.value = marker
  triggerRef(selectedMarker)
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
    <a-date-picker v-model="selectedDate" max-w-40 grow-1 />
  </div>
  <div h-full w-full>
    <ElAmap :center="center" :zoom="zoom" relative h-full w-full @init="(m) => map = m">
      <ElAmapLoca>
        <ElAmapLocaLine :visible="trackVisible" :source-data="trackFeatureCollection" :layer-style="layerStyle" />
      </ElAmapLoca>

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
              <span mr2>{{ t('longitude') }}</span> <span>{{ marker.getExtData().longitude }}</span>
              <br>
              <span mr2>{{ t('latitude') }}</span> <span>{{ marker.getExtData().latitude }}<br></span>
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
</template>
