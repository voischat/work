<template>
  <img
    v-if="src"
    :src="src"
    :alt="name"
    :width="size"
    :height="size"
    style="display: inline; vertical-align: middle"
  />
</template>

<script setup lang="ts">
import { EMOJI_TOKENS } from '@weila/shared'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: string | number
  }>(),
  {
    size: 32,
  },
)

const src = computed(() => {
  const index = EMOJI_TOKENS.indexOf(props.name)
  if (index === -1) return ''
  return new URL(`./assets/face_${index + 1}.png`, import.meta.url).href
})
</script>
