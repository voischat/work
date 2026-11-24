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

    qc.invalidateQueries({
      queryKey: ['corp/address/get-member-list'],
    })
    qc.invalidateQueries({
      queryKey: ['corp/address/get-dept-member-list'],
    })
  },
})
</script>

<template>
  <a-modal v-model:visible="open" :title="t('注销成员')">
    <a-descriptions
      v-if="member"
      :column="1"
      :data="[
        { label: t('name'), value: member.name },
        { label: t('weila-number'), value: member.user_num },
        { label: t('job-number'), value: member.job_num },
        { label: t('phone-number'), value: member.phone },
      ].filter(i => i.value)"
      bordered
      mb4
    />
    <p>
      {{ t('delete.modal.hint') }} {{ t('delete.modal.content') }}
    </p>
    <template #footer>
      <a-popconfirm
        :content="t('delete-member-modal.confirm-content')"
        type="warning"
        @ok="mutate({ user_id: member!.user_id })"
      >
        <a-button type="primary" :loading="isPending">
          {{ t('button.submit') }}
        </a-button>
      </a-popconfirm>
    </template>
  </a-modal>
</template>
