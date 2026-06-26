<script setup lang="ts">
import { computed, nextTick, shallowRef } from 'vue'

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
  canFetch?: boolean
}>(), {
  date: undefined,
  errorMessage: undefined,
  items: () => [],
  fields: () => [],
  canFetch: true,
})

const emit = defineEmits<{
  focus: []
  refresh: []
  itemClick: [item: any, index: number]
}>()

const { t } = useI18n()

const popupVisible = shallowRef(false)
const isFlashing = shallowRef(false)
const statusKey = computed(() => `${props.state}:${message.value}`)

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
      return 'bg-red-50 text-red-500'
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

let flashTimer: ReturnType<typeof setTimeout> | null = null

function flashMessage() {
  if (props.canFetch || isFlashing.value) return
  if (flashTimer) {
    clearTimeout(flashTimer)
    flashTimer = null
  }
  isFlashing.value = false
  nextTick(() => {
    isFlashing.value = true
    flashTimer = setTimeout(() => {
      isFlashing.value = false
      flashTimer = null
    }, 600)
  })
}

defineExpose({ flashMessage })
</script>

<template>
  <div class="absolute left-1/2 top-4 z-10 -translate-x-1/2 flex flex-col items-center gap-2">
    <div
      class="relative flex max-w-[calc(100vw-2rem)] items-center justify-center overflow-hidden rounded-full px-3 py-1.5 text-lg shadow-lg ring-1 ring-black/10 backdrop-blur transition-colors duration-300 ease-out md:px-5 md:py-2"
      :class="[wrapperClass, { 'animate-message-shake': isFlashing }]"
    >
      <Transition name="status-fade" mode="out-in">
        <div
          :key="statusKey"
          class="flex items-center gap-1.5 md:gap-2"
        >
          <icon-info-circle v-if="state === 'idle'" />
          <icon-check-circle v-else-if="state === 'success'" />
          <icon-empty v-else-if="state === 'empty'" />
          <icon-exclamation-circle v-else-if="state === 'error'" />

          <template v-if="state === 'success'">
            <span class="shrink-0 whitespace-nowrap">{{ t('location-status.success-prefix') }}</span>
            <span class="status-text max-w-[45vw] truncate whitespace-nowrap md:max-w-[55vw]">{{ date ?? '-' }}</span>
          </template>
          <span v-else class="status-text max-w-[70vw] truncate whitespace-nowrap md:max-w-[80vw]">{{ message }}</span>
        </div>
      </Transition>
    </div>

    <Transition name="buttons-fade">
      <div
        v-if="state !== 'idle'"
        class="flex flex-wrap items-center justify-center gap-2"
      >
      <button
        v-if="state === 'success'"
        type="button"
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-base text-neutral-600 shadow-sm transition-colors hover:bg-neutral-100 whitespace-nowrap"
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
          class="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-base text-neutral-600 shadow-sm transition-colors hover:bg-neutral-100 whitespace-nowrap"
          :title="t('location-status.track')"
        >
          <icon-message />
          <span>{{ t('location-status.track') }}</span>
        </button>
        <template #content>
          <div class="max-h-80 min-w-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
            <div
              v-for="(item, index) in items"
              :key="index"
              class="cursor-pointer rounded px-5 py-5 transition-colors hover:bg-neutral-50"
              @click="handleItemClick(item, index)"
            >
              <div
                v-for="(field, fieldIndex) in fields"
                :key="field.key"
                class="flex gap-1"
                :class="fieldIndex === 0 ? 'text-lg font-medium text-neutral-900' : 'text-base text-neutral-500 mt-0.5'"
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
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-base text-neutral-600 shadow-sm transition-colors hover:bg-neutral-100 whitespace-nowrap"
        :title="t('button.refresh')"
        @click="emit('refresh')"
      >
        <icon-refresh />
        <span>{{ t('button.refresh') }}</span>
      </button>
    </div>
    </Transition>
  </div>
</template>

<style scoped>
.status-fade-enter-active,
.status-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.status-fade-enter-from,
.status-fade-leave-to {
  opacity: 0;
  filter: blur(8px);
  transform: scale(0.92) translateY(-4px);
}

.buttons-fade-enter-active,
.buttons-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.buttons-fade-enter-from,
.buttons-fade-leave-to {
  opacity: 0;
  filter: blur(10px);
  transform: translateY(-10px);
}

@keyframes message-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.animate-message-shake {
  animation: message-shake 0.5s ease-in-out;
}
</style>
