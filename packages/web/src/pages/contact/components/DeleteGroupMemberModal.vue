<script setup lang="ts">
import type { Member } from '~/types/api'
import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, useSlots } from 'vue'

defineProps<{
  groupId?: number
  member?: Member
}>()

const emits = defineEmits(['success'])
const slots = useSlots()
const hasTrigger = computed(() => !!slots.default)

const { t } = useI18n()

const open = defineModel('open', { default: false })
const qc = useQueryClient()

const { mutateAsync, isPending } = useWeilaMutation<{
  group_id: number
  user_id: number
}>('corp/group/delete-group-member', {
  onSuccess() {
    open.value = false
    Message.success(t('message.success'))
    qc.invalidateQueries({ queryKey: ['corp/group/get-group-member-list'] })
    qc.invalidateQueries({ queryKey: ['corp/group/get-group-all-member'] })
    qc.invalidateQueries({ queryKey: ['corp/group/get-group-all-member/self-membership'] })
    emits('success')
  },
})
</script>

<template>
  <ModalTrigger v-if="hasTrigger" v-model:open="open" :trigger="{ status: 'danger' }" :title=" t('delete.modal.title') ">
    <slot />
    <template #content>
      <a-list my-4>
        <a-list-item v-if="member">
          {{ member.name }} ({{ member.user_num }})
        </a-list-item>
      </a-list>
    </template>
    <template #footer>
      <a-button
        type="primary" :loading="isPending" :disabled="!member" @click="() => mutateAsync({
          group_id: groupId,
          user_id: member?.user_id,
        })"
      >
        {{ t('button.submit') }}
      </a-button>
    </template>
  </ModalTrigger>
  <a-modal
    v-else
    v-model:visible="open"
    :title="t('delete.modal.title')"
    :mask-closable="false"
    :esc-to-close="!isPending"
  >
    <a-list my-4>
      <a-list-item v-if="member">
        {{ member.name }} ({{ member.user_num }})
      </a-list-item>
    </a-list>
    <template #footer>
      <a-button :disabled="isPending" @click="open = false">
        {{ t('button.cancel') }}
      </a-button>
      <a-button
        type="primary" :loading="isPending" :disabled="!member" @click="() => mutateAsync({
          group_id: groupId,
          user_id: member?.user_id,
        })"
      >
        {{ t('button.submit') }}
      </a-button>
    </template>
  </a-modal>
</template>
