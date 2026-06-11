<script setup lang="ts">
import type { OrgTreeSelectedItem } from '~/components/OrgTree.vue'
import type { Member } from '~/types/api'
import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'
import { shallowRef } from 'vue'

const props = defineProps<{
  deptId: number
}>()

const qc = useQueryClient()
const { t } = useI18n()

const open = shallowRef(false)

const selectedMembers = shallowRef<OrgTreeSelectedItem[]>([])
const selectedUserIds = computed(() => selectedMembers.value.map(item => item.id))

const { data, refetch } = useWeilaFetch<{ depts: Member[], count: number }>('corp/address/get-my-manage-dept-list', {
  body: { dept_id: props.deptId },
}, {
  enabled: open,
})

watchEffect(() => {
  if (open.value) {
    selectedMembers.value = []
    refetch()
  }
})

const { mutate, isPending } = useWeilaMutation<never, {
  dept_id: number
  user_ids: number[]
}>('corp/address/add-dept-members', {
  onSuccess() {
    Message.success(t('message.success'))
    open.value = false
    qc.invalidateQueries({ queryKey: ['corp/address/get-dept-member-list'] })
  },
})
</script>

<template>
  <ModalTrigger v-model:open="open" :title="t('add-member')" :trigger="{ type: 'primary' }">
    <template #content>
      <div relative p4 min-w-100 max-h-60vh of-y-auto>
        <OrgTree
          v-model:selected="selectedMembers"
          select-mode="multi"
          :disabled-member-ids="data?.depts?.map(i => i.user_id)"
        />
      </div>
    </template>
    <template #footer>
      <a-button
        type="primary" :disabled="!selectedUserIds.length" :loading="isPending" @click="() => mutate({
          dept_id: Number(props.deptId),
          user_ids: selectedUserIds,
        })"
      >
        {{ t('button.submit') }}
      </a-button>
    </template>
  </ModalTrigger>
</template>
