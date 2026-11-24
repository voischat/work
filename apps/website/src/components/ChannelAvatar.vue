<script setup lang="ts">
interface Props {
  src?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-8 h-8'
    case 'lg':
      return 'w-16 h-16'
    default:
      return 'w-12 h-12'
  }
})

function getFallback(name?: string) {
  return (name || '?').charAt(0).toUpperCase()
}

function handleImageError(event: Event) {
  (event.currentTarget as HTMLImageElement).style.display = 'none'
}
</script>

<template>
  <div
    class="relative shrink-0 overflow-hidden flex items-center justify-center rounded-full bg-neutral-200"
    :class="[sizeClass]"
  >
    <span class="text-lg font-medium text-neutral-400">
      {{ getFallback(name) }}
    </span>
    <img
      v-if="src"
      :key="src"
      :src="src"
      :alt="name"
      class="absolute inset-0 size-full object-cover"
      @error="handleImageError"
    >
  </div>
</template>
