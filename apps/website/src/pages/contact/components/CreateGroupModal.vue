<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import CreateGroupForm from './CreateGroupForm.vue'

const props = defineProps<{
  deptId?: number
}>()

const emit = defineEmits<{
  success: []
}>()

const { t } = useI18n()

const open = shallowRef(false)

function handleSuccess() {
  open.value = false
  emit('success')
}
</script>

<template>
  <slot name="trigger" :open="() => open = true">
    <a-button type="primary" @click="open = true">
      {{ t('button.create-group') }}
    </a-button>
  </slot>
  <a-modal v-model:visible="open" :title=" t('button.create-group') " :footer="false">
    <CreateGroupForm v-if="open" :dept-id="props.deptId" @success="handleSuccess" />
  </a-modal>
</template>
