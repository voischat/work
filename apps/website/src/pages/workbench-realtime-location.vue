<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'

import { useI18n } from 'vue-i18n'
import RealtimeLocationPanel from '~/components/RealtimeLocationPanel.vue'
import { useDeptList } from '~/composables/useDeptList'
import { useGroupList } from '~/composables/useGroupList'

definePage({
  path: '/workbench/realtime-location',
  name: '/workbench/realtime-location',
  meta: {
    name: 'submenu.realtime-location',
  },
})

const { t } = useI18n()

const selectedType = shallowRef<'dept' | 'group'>('group')
const selectedId = shallowRef<number | undefined>(undefined)

const { deptOptions } = useDeptList()
const { groupOptions } = useGroupList()

const currentOptions = computed(() => {
  return selectedType.value === 'dept'
    ? deptOptions.value
    : groupOptions.value
})

watch(selectedType, () => {
  selectedId.value = undefined
})
</script>

<template>
  <div h-full min-h-0 flex flex-col>
    <div flex shrink-0 gap2 p4 bg-base>
      <a-radio-group v-model="selectedType" type="button">
        <a-radio value="group">
          {{ t('group.name') }}
        </a-radio>
        <a-radio value="dept">
          {{ t('dept.name') }}
        </a-radio>
      </a-radio-group>

      <a-select
        v-model="selectedId"
        :options="currentOptions"
        :placeholder="t('hint.please-select')"
        max-w-60
        grow-1
      />
    </div>

    <RealtimeLocationPanel :id="selectedId" :type="selectedType" class="flex-1 min-h-0" />
  </div>
</template>
