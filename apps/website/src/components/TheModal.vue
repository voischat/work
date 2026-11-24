<script setup lang="ts">
defineProps<{
  title: string
  classes?: string | string[]
}>()
const open = defineModel('open', { default: false })
</script>

<template>
  <slot />

  <a-modal v-model:visible="open" :title>
    <slot name="content" />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </a-modal>
</template>
