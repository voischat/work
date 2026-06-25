<script setup lang="ts">
import { shallowRef } from 'vue'

interface ListField<T = any> {
  key: string
  label?: string
  formatter?: (value: any, item: T) => string
}

type MapStatusState = 'idle' | 'success' | 'empty' | 'error'

const props = withDefaults(defineProps<{
  state: MapStatusState
  date?: string
  errorMessage?: string
  items?: any[]
  fields?: ListField[]
}>(), {
  date: undefined,
  errorMessage: undefined,
  items: () => [],
  fields: () => [],
})

const emit = defineEmits<{
  focus: []
  refresh: []
  itemClick: [item: any, index: number]
}>()

const { t } = useI18n()

const popupVisible = shallowRef(false)

const message = computed(() => {
  switch (props.state) {
    case 'idle':
      return t('location-status.idle')
    case 'empty':
      return t('location-status.empty')
    case 'error':
      return props.errorMessage || t('location-status.error')
    default:
      return ''
  }
})

const wrapperClass = computed(() => {
  switch (props.state) {
    case 'success':
      return 'bg-green-50 text-green-700'
    case 'empty':
      return 'bg-orange-50 text-orange-600'
    case 'error':
      return 'bg-red-50 text-red-600'
    default:
      return 'bg-white/90 text-gray-500'
  }
})

function formatValue(field: ListField, item: any): string {
  const value = item[field.key]
  if (field.formatter)
    return field.formatter(value, item)
  return value ?? '-'
}

function handleItemClick(item: any, index: number) {
  popupVisible.value = false
  emit('itemClick', item, index)
}
</script>

<template>
  <div class="absolute left-1/2 top-4 z-10 -translate-x-1/2 flex flex-col items-center gap-2">
    <div
      class="flex items-center gap-2 rounded-full px-3 py-1 text-sm shadow-md backdrop-blur transition-all duration-300 ease-out whitespace-nowrap"
      :class="wrapperClass"
    >
      <icon-info-circle v-if="state === 'idle'" />
      <icon-check-circle v-else-if="state === 'success'" />
      <icon-empty v-else-if="state === 'empty'" />
      <icon-exclamation-circle v-else-if="state === 'error'" />

      <template v-if="state === 'success'">
        <span>{{ t('location-status.success-prefix') }}</span>
        <span>{{ date ?? '-' }}</span>
      </template>
      <span v-else>{{ message }}</span>
    </div>

    <div
      v-if="state !== 'idle'"
      class="flex flex-wrap items-center justify-center gap-2"
    >
      <button
        v-if="state === 'success'"
        type="button"
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-neutral-600 shadow-sm transition-colors hover:bg-neutral-100 whitespace-nowrap"
        :title="t('location-status.focus')"
        @click="emit('focus')"
      >
        <icon-compass />
        <span>{{ t('button.checkout') }}</span>
      </button>

      <a-trigger
        v-if="state === 'success' && items?.length"
        v-model:popup-visible="popupVisible"
        trigger="click"
        position="bottom"
        :popup-translate="[0, 8]"
        :unmount-on-close="true"
      >
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-neutral-600 shadow-sm transition-colors hover:bg-neutral-100 whitespace-nowrap"
          :title="t('location-status.track')"
        >
          <icon-menu />
          <span>{{ t('location-status.track') }}</span>
        </button>
        <template #content>
          <div class="max-h-80 min-w-60 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
            <div
              v-for="(item, index) in items"
              :key="index"
              class="cursor-pointer rounded px-3 py-2 transition-colors hover:bg-neutral-50"
              @click="handleItemClick(item, index)"
            >
              <div
                v-for="(field, fieldIndex) in fields"
                :key="field.key"
                class="flex gap-1"
                :class="fieldIndex === 0 ? 'text-sm font-medium text-neutral-900' : 'text-xs text-neutral-500 mt-0.5'"
              >
                <span v-if="field.label" class="shrink-0 text-neutral-400">{{ field.label }}{{ t('colon') }}</span>
                <span class="truncate">{{ formatValue(field, item) }}</span>
              </div>
            </div>
          </div>
        </template>
      </a-trigger>

      <button
        type="button"
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-neutral-600 shadow-sm transition-colors hover:bg-neutral-100 whitespace-nowrap"
        :title="t('button.refresh')"
        @click="emit('refresh')"
      >
        <icon-refresh />
        <span>{{ t('button.refresh') }}</span>
      </button>
    </div>
  </div>
</template>
