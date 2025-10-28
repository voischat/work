<script setup lang="ts">
import { ElAmap } from '@vuemap/vue-amap'
import { shallowRef } from 'vue'

import { useDeptList } from '~/composables/useDeptList'
import { useGroupList } from '~/composables/useGroupList'
import { useRealtimeLocation } from '~/composables/useRealtimeLocation'
import { useRealtimeMapInteraction } from '~/composables/useRealtimeMapInteraction'
import { useUserInfoStore } from '~/composables/useUserInfoStore'

definePage({
  meta: {
    name: 'submenu.realtime-location',
  },
})

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
} = useRealtimeMapInteraction(locations)

const currentOptions = computed(() => {
  return selectedType.value === 'dept' ? deptOptions.value : groupOptions.value
})

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

// 监听选择变化，预加载成员信息
watch([selectedType, selectedId], async ([type, id]) => {
  if (id !== undefined) {
    await preloadMembers(type, id)
  }
})
</script>

<template>
  <div flex gap2 p4 bg-base>
    <!-- 类型选择 -->
    <a-radio-group v-model="selectedType" type="button">
      <a-radio value="group">
        {{ t('group.name') }}
      </a-radio>
      <!-- <a-radio value="dept">
        {{ t('dept.name') }}
      </a-radio> -->
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
    <ElAmap :center="center" :zoom="zoom" relative h-full w-full @init="(m) => map = m">
      <!-- 标记点会自动通过 composable 渲染 -->

      <a-button
        v-if="markers?.length" type="primary" shape="circle" class="absolute right-4 top-4"
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
                    value: (item.marker.getExtData().longitude as number).toFixed(2),
                  },
                  {
                    label: t('latitude'),
                    value: (item.marker.getExtData().latitude as number).toFixed(2),
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
