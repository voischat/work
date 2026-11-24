<script setup lang="ts">
import type { OrgTreeSelectedItem } from '~/components/orgTreeSelection'
import type { Member } from '~/types/api'
import { Message } from '@arco-design/web-vue'
import { useQueryClient } from '@tanstack/vue-query'
import { shallowRef } from 'vue'

const props = defineProps<{
  groupId: number
}>()

const emits = defineEmits(['success'])

const qc = useQueryClient()
const { t } = useI18n()

const open = shallowRef(false)

const selectedMembers = shallowRef<OrgTreeSelectedItem[]>([])
const selectedUserIds = computed(() => selectedMembers.value.map(item => item.id))

const { data: groupMembers, refetch, isPending: isGroupMembersPending } = useWeilaFetch<Member[]>('corp/group/get-group-all-member', {
  body: { group_id: props.groupId },
})

const disabledMemberIds = computed(() => groupMembers.value?.map(i => i.user_id))
const isMemberEnabled = (member: Member) => member.grp_cnt < member.grp_lmt
const memberTitle = (member: Member) => `${member.name} (${member.grp_cnt}/${member.grp_lmt})`

watchEffect(() => {
  if (open.value) {
    selectedMembers.value = []
    refetch()
  }
})

const { mutate, isPending } = useWeilaMutation('corp/group/add-group-members', {
  onSuccess() {
    Message.success(t('message.success'))
    open.value = false
    qc.invalidateQueries({
      queryKey: ['corp/group/get-group-member-list'],
    })
    qc.invalidateQueries({
      queryKey: ['corp/group/get-group-all-member'],
    })
    qc.invalidateQueries({
      queryKey: ['corp/group/get-group-all-member/self-membership'],
    })
    emits('success')
  },
})
</script>

<template>
  <ModalTrigger v-model:open="open" :trigger="{ type: 'primary' }" :title=" t('button.add-group-member') ">
    <template #content>
      <div class="min-w-100 min-h-80 max-h-[60vh] overflow-y-auto p-4">
        <OrgTree
          v-model:selected="selectedMembers"
          class="rounded border border-neutral-200"
          select-mode="multi"
          :disabled-member-ids="disabledMemberIds"
          :disabled-member-ids-loading="isGroupMembersPending"
          :is-member-enabled="isMemberEnabled"
          :member-title="memberTitle"
        />
      </div>
    </template>
    <template #footer>
      <a-button
        type="primary" :disabled="!selectedUserIds.length" :loading="isPending" @click="() => mutate({
          group_id: Number(props.groupId),
          user_ids: selectedUserIds,
        })"
      >
        {{ t('button.submit') }}
      </a-button>
    </template>
  </ModalTrigger>
</template>
