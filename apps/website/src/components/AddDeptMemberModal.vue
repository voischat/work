<script setup lang="ts">
import type { OrgTreeSelectedItem } from '~/components/orgTreeSelection'
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

const { data: deptMembers, isPending: isDeptMembersPending } = useWeilaFetch<Member[]>('corp/address/get-dept-all-member', {
  body: { dept_id: props.deptId },
}, {
  enabled: open,
})

const disabledMemberIds = computed(() => deptMembers.value?.map(i => i.user_id))

watchEffect(() => {
  if (open.value)
    selectedMembers.value = []
})

const { mutate, isPending } = useWeilaMutation<never, {
  dept_id: number
  user_ids: number[]
}>('corp/address/add-dept-members', {
  onSuccess() {
    Message.success(t('message.success'))
    open.value = false
    qc.invalidateQueries({
      queryKey: ['corp/address/get-dept-member-list'],
    })
    qc.invalidateQueries({
      queryKey: ['corp/address/get-dept-all-member'],
    })
    qc.invalidateQueries({
      queryKey: ['corp/address/get-my-manage-all-dept'],
    })
  },
})
</script>

<template>
  <ModalTrigger v-model:open="open" :title="t('add-member')" :trigger="{ type: 'primary' }">
    <template #content>
      <div class="min-w-100 min-h-80 max-h-[60vh] overflow-y-auto p-4">
        <OrgTree
          v-model:selected="selectedMembers"
          class="rounded border border-neutral-200"
          select-mode="multi"
          :disabled-member-ids="disabledMemberIds"
          :disabled-member-ids-loading="isDeptMembersPending"
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
