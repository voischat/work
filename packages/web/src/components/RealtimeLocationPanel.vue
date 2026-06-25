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
  drawerVisible,
  zoom,
  center,
  map,
  markers,
  selectedMarker,
} = useRealtimeMapInteraction(locations)

// 新的 computed data，包含用户信息和标记点，按用户名排序
const sortedMarkersWithUserInfo = computed(() => {
  if (!markers.value?.length)
    return []

  return markers.value
    .map((marker) => {
      const userInfo = getUserInfo(marker.getExtData().uid)
      return {
        marker,
        userInfo,
        userName: userInfo?.name || `用户${marker.getExtData().uid}`,
      }
    })
    .sort((a, b) => a.userName.localeCompare(b.userName))
})

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
    <LocationFetchStatus
      :state="fetchState"
      :date="latestLocationDate"
      :error-message="error?.message"
      @focus="handleFocus"
      @refresh="() => refetch().then(() => Message.success(t('message.refresh-success')))"
    />

    <ElAmap :center="center" :zoom="zoom" relative h-full w-full @init="(m) => map = m">
      <ElAmapLayerSatellite :visible="satelliteVisible" />

      <!-- 标记点会自动通过 composable 渲染 -->

      <MapTypeSwitcher v-model="satelliteVisible" />

      <a-button
        v-if="markers?.length" type="primary" shape="circle" class="absolute right-4 top-4 z-10"
        @click="drawerVisible = true"
      >
        <template #icon>
          <icon-menu />
        </template>
      </a-button>
    </ElAmap>

    <a-drawer v-model:visible="drawerVisible" :width="720" unmount-on-close :footer="false">
      <template #title>
        {{ t('realtime-location') }}
      </template>
      <a-empty v-if="!sortedMarkersWithUserInfo?.length" />
      <a-list v-else item-layout="horizontal">
        <a-list-item v-for="item in sortedMarkersWithUserInfo" :key="item.marker.getExtData().id">
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
                    value: item.marker.getExtData().uid,
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
                    value: new Date(item.marker.getExtData().ts * 1000).toLocaleString(),
                  },
                  {
                    label: t('longitude'),
                    value: (item.marker.getExtData().longitude as number).toFixed(6),
                  },
                  {
                    label: t('latitude'),
                    value: (item.marker.getExtData().latitude as number).toFixed(6),
                  },
                  {
                    label: t('speed'),
                    value: `${(item.marker.getExtData().spd as number).toFixed(2)} km/h`,
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
