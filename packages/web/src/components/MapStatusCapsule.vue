<script setup lang="ts">
type MapStatusState = 'idle' | 'success' | 'empty' | 'error'

const props = withDefaults(defineProps<{
  state: MapStatusState
  date?: string
  errorMessage?: string
}>(), {
  date: undefined,
  errorMessage: undefined,
})

const emit = defineEmits<{
  focus: []
  refresh: []
  list: []
}>()

const { t } = useI18n()

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

      <button
        v-if="state === 'success'"
        type="button"
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-neutral-600 shadow-sm transition-colors hover:bg-neutral-100 whitespace-nowrap"
        :title="t('location-status.list')"
        @click="emit('list')"
      >
        <icon-menu />
        <span>{{ t('location-status.list') }}</span>
      </button>

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
