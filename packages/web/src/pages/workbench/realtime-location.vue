<script setup lang="ts">
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { shallowRef } from 'vue'
import { AdvancedMarker, GoogleMap, InfoWindow } from 'vue3-google-map'
import { useDeptList } from '~/composables/useDeptList'
import { useGroupList } from '~/composables/useGroupList'
import { useRealtimeGoogleMapInteraction } from '~/composables/useRealtimeGoogleMapInteraction'
import { useRealtimeLocation } from '~/composables/useRealtimeLocation'
import { useUserInfoStore } from '~/composables/useUserInfoStore'

definePage({
  meta: {
    name: 'submenu.realtime-location',
  },
})

const key = import.meta.env.VITE_GOOGLE_MAP_KEY

const mapRef = shallowRef<InstanceType<typeof GoogleMap> | null>(null)

watch(() => mapRef.value?.ready, () => {
  const map = mapRef.value?.map
  if (map)
    onMapLoaded(map)
}, { immediate: true })

setOptions({
  key,
  v: 'weekly',
})

Promise.all([
  importLibrary('maps'),
  importLibrary('marker'), // Required for AdvancedMarker component
])

const { t } = useI18n()

const selectedType = shallowRef<'dept' | 'group'>('group')
const selectedId = shallowRef<number | undefined>(undefined)

const { deptOptions } = useDeptList()
const { groupOptions } = useGroupList()
const { locations } = useRealtimeLocation(selectedType, selectedId)
const { getUserInfo, preloadMembers } = useUserInfoStore()
const {
  drawerVisible,
  zoom,
  center,
  map,
  markers,
  selectedMarker,
  isInfoWindowOpen,
  infoWindowPosition,
  infoWindowContent,
} = useRealtimeGoogleMapInteraction(locations)

const currentOptions = computed(() => {
  return selectedType.value === 'dept' ? deptOptions.value : groupOptions.value
})

// 新的 computed data，包含用户信息和标记点，按用户名排序
const sortedMarkersWithUserInfo = computed(() => {
  if (!markers.value?.length)
    return []

  return markers.value
    .map((marker) => {
      const userInfo = getUserInfo(marker.uid)
      return {
        marker,
        userInfo,
        userName: userInfo?.name || `用户${marker.uid}`,
      }
    })
    .sort((a, b) => a.userName.localeCompare(b.userName))
})

// 监听选择变化，预加载成员信息
watch([selectedType, selectedId], async ([type, id]) => {
  if (id !== undefined) {
    await preloadMembers(type, id)
  }
})

function onMapLoaded(value: google.maps.Map) {
  map.value = value
}
</script>

<template>
  <div flex gap2 p4 bg-base>
    <!-- 类型选择 -->
    <a-radio-group v-model="selectedType" type="button">
      <a-radio value="group">
        {{ t('group.name') }}
      </a-radio>
      <a-radio value="dept">
        {{ t('dept.name') }}
      </a-radio>
    </a-radio-group>

    <!-- 部门/群组选择 -->
    <a-select
      v-model="selectedId"
      :options="currentOptions"
      :placeholder="t('hint.please-select')"
      max-w-60
      grow-1
    />
  </div>

  <div h-full w-full>
    <GoogleMap
      ref="mapRef"
      :api-key="key"
      map-id="realtime-location"
      relative
      :center="center"
      :zoom="zoom"
      style="width: 100%; height: 100%"
    >
      <AdvancedMarker
        v-for="marker in markers"
        :key="marker.id"
        :options="{
          position: marker.position,
          title: getUserInfo(marker.uid)?.name || `用户${marker.uid}`,
          content: marker.content,
        }"
        @click="() => selectedMarker = marker"
      />

      <InfoWindow
        v-if="infoWindowPosition && selectedMarker"
        v-model="isInfoWindowOpen"
        :options="{
          position: infoWindowPosition,
          content: infoWindowContent,
          // @ts-expect-error type error
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

    <a-drawer v-model:visible="drawerVisible" :width="720" unmount-on-close :footer="false">
      <template #title>
        {{ t('realtime-location') }}
      </template>
      <a-empty v-if="!sortedMarkersWithUserInfo?.length" />
      <a-list v-else item-layout="horizontal">
        <a-list-item v-for="item in sortedMarkersWithUserInfo" :key="item.marker.id">
          <a-list-item-meta>
            <template #avatar>
              <a-avatar :image-url="item.userInfo?.avatar?.replace(/^https?:/, '')">
                <IconUser />
              </a-avatar>
            </template>
            <template #title>
              {{ item.userName }}
            </template>
            <template #description>
              <a-descriptions
                :column="2"
                :data="[
                  {
                    label: t('user-id'),
                    value: item.marker.uid,
                  },
                  {
                    label: t('phone'),
                    value: item.userInfo?.phone || '-',
                  },
                  {
                    label: t('weila-number'),
                    value: item.userInfo?.user_num || '-',
                  },
                  {
                    label: t('time'),
                    value: new Date(item.marker.ts * 1000).toLocaleString(),
                  },
                  {
                    label: t('longitude'),
                    value: item.marker.longitude.toFixed(2),
                  },
                  {
                    label: t('latitude'),
                    value: item.marker.latitude.toFixed(2),
                  },
                  {
                    label: t('speed'),
                    value: `${item.marker.spd.toFixed(2)} km/h`,
                  },
                ].filter(item => item.value)"
                bordered
                size="small"
              />
            </template>
          </a-list-item-meta>
          <template #actions>
            <a-button type="primary" size="small" @click="selectedMarker = item.marker">
              {{ t('button.checkout') }}
            </a-button>
          </template>
        </a-list-item>
      </a-list>
    </a-drawer>
  </div>
</template>
