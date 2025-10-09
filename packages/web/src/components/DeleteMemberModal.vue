<script setup lang="ts">
import type { Member } from '~/types/api'
import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'

defineProps<{
  member?: Member
}>()

const { t } = useI18n()

const open = defineModel('open', { default: false })

const qc = useQueryClient()

const { mutate, isPending } = useWeilaMutation<never, {
  user_id: number
}>('corp/address/delete-member', {
  onSuccess: () => {
    open.value = false
    Message.success(t('message.success'))

    qc.invalidateQueries({ queryKey: ['corp/address/get-member-list'] })
  },
})
</script>

<template>
  <a-modal v-model:visible="open" :title="t('注销成员')">
    <p>
      {{ t('delete.modal.hint') }} {{ t('delete.modal.content') }}
    </p>
    <template #footer>
      <a-button type="primary" :loading="isPending" @click="mutate({ user_id: member!.user_id })">
        {{ t('button.submit') }}
      </a-button>
    </template>
  </a-modal>
</template>
