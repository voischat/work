<script setup lang="ts">
import type { GroupModel } from '~/api/contact'
import type { Member } from '~/types/api'
import { useQueryClient } from '@tanstack/vue-query'
import { shallowRef } from 'vue'
import AddGroupMemberModal from '~/pages/contact/components/AddGroupMemberModal.vue'
import DeleteGroupMemberModal from '~/pages/contact/components/DeleteGroupMemberModal.vue'
import EditGroupModal from '~/pages/contact/components/EditGroupModal.vue'

const props = defineProps<{
  groupId: number
}>()

const emits = defineEmits(['close', 'success'])

const { t } = useI18n()
const qc = useQueryClient()

const searchQuery = shallowRef('')
const selectedMember = shallowRef<Member | undefined>(undefined)
const memberToDelete = shallowRef<Member | undefined>(undefined)
const isEditMemberModalOpen = shallowRef(false)
const isDeleteModalOpen = shallowRef(false)

watch(isDeleteModalOpen, (open) => {
  if (!open)
    memberToDelete.value = undefined
})

const { data: group, refetch: refetchGroup } = useWeilaFetch<GroupModel>('corp/group/get-group', {
  body: { group_id: props.groupId },
})

const { data: members, refetch: refetchMembers } = useWeilaFetch<Member[]>('corp/group/get-group-all-member', {
  body: { group_id: props.groupId },
})

const filteredMembers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const list = members.value ?? []
  if (!query)
    return list

  return list.filter((member) => {
    const name = member.name?.toLowerCase() ?? ''
    const userNum = member.user_num?.toLowerCase() ?? ''
    return name.includes(query) || userNum.includes(query)
  })
})

const memberCount = computed(() => members.value?.length ?? 0)

function handleEditMember(member: Member) {
  selectedMember.value = member
  isEditMemberModalOpen.value = true
}

function handleMembersChanged() {
  qc.invalidateQueries({ queryKey: ['corp/group/get-group-all-member'] })
  qc.invalidateQueries({ queryKey: ['corp/group/get-group'] })
  emits('success')
}

function handleGroupUpdated() {
  refetchGroup()
  qc.invalidateQueries({ queryKey: ['corp/group/get-group'] })
  emits('success')
}

function handleEditMemberSuccess() {
  refetchMembers()
  emits('success')
}

watch(() => props.groupId, () => {
  searchQuery.value = ''
  selectedMember.value = undefined
})

function formatCreatedTime(timestamp?: number) {
  if (!timestamp)
    return '-'
  return new Date(timestamp * 1000).toLocaleDateString()
}

function getBurstModeLabel(mode?: number) {
  return {
    0: t('burst-mode-0'),
    1: t('burst-mode-1'),
    2: t('burst-mode-2'),
  }[mode as number] ?? '-'
}
</script>

<template>
  <div h-full flex flex-col>
    <div class="flex justify-between items-center p-3 border-b">
      <span font-medium>{{ t('group.settings.title') }}</span>
      <div class="flex items-center gap-1">
        <EditGroupModal :group="group" @success="handleGroupUpdated">
          <a-button type="text" size="mini">
            <template #icon>
              <icon-edit />
            </template>
            {{ t('button.edit') }}
          </a-button>
        </EditGroupModal>
        <a-button status="danger" type="text" @click="emits('close')">
          <template #icon>
            <icon-close />
          </template>
        </a-button>
      </div>
    </div>

    <div flex-1 min-h-0 of-y-auto p-4>
      <a-spin :loading="!group" class="w-full">
        <div class="flex items-start gap-4 pb-4 border-b border-neutral-200">
          <ChannelAvatar :src="group?.avatar" :name="group?.name" size="lg" />
          <div flex-1 min-w-0>
            <div class="flex items-center gap-2">
              <span class="text-lg font-medium truncate">
                {{ group?.name ?? '-' }}
              </span>
              <a-tag size="small">
                {{ getBurstModeLabel(group?.burst_mode) }}
              </a-tag>
            </div>
            <div class="mt-1 text-sm text-neutral-500">
              {{ t('group.settings.member-count', { count: memberCount }) }}
            </div>
            <div class="mt-1 text-sm text-neutral-500">
              {{ t('group.settings.created', { date: formatCreatedTime(group?.created) }) }}
            </div>
          </div>
        </div>
      </a-spin>

      <div class="pt-4">
        <div class="flex items-center justify-between gap-3 pb-4">
          <a-input-search
            v-model="searchQuery"
            class="flex-1"
            :placeholder="t('search')"
            allow-clear
          />
          <AddGroupMemberModal :group-id="groupId" @success="handleMembersChanged">
            <a-button type="primary">
              <template #icon>
                <icon-plus />
              </template>
              {{ t('button.add-group-member') }}
            </a-button>
          </AddGroupMemberModal>
        </div>

        <div class="text-sm font-medium mb-2">
          {{ t('group.settings.members-count', { count: filteredMembers.length }) }}
        </div>

        <a-spin :loading="!members" class="w-full">
          <div v-if="filteredMembers.length" class="flex flex-col">
            <OrgTreeMemberItem
              v-for="member in filteredMembers"
              :key="member.user_id"
              :member="member"
              show-actions
              class="!pl-3"
              @select="handleEditMember(member)"
            >
              <template #actions>
                <a-dropdown position="br" :hide-on-select="false">
                  <a-button type="text" size="mini">
                    <template #icon>
                      <icon-more />
                    </template>
                  </a-button>
                  <template #content>
                    <a-doption @click="handleEditMember(member)">
                      {{ t('button.edit') }}
                    </a-doption>
                    <a-doption @click="memberToDelete = member; isDeleteModalOpen = true">
                      <span class="text-red-6">{{ t('button.delete') }}</span>
                    </a-doption>
                  </template>
                </a-dropdown>
              </template>
            </OrgTreeMemberItem>
          </div>
          <div v-else class="py-10 text-center text-neutral-400">
            {{ t('no-data') }}
          </div>
        </a-spin>
      </div>
    </div>
  </div>

  <EditMemberModal
    v-model:open="isEditMemberModalOpen"
    :member="selectedMember"
    @success="handleEditMemberSuccess"
  />

  <DeleteGroupMemberModal
    v-if="memberToDelete"
    v-model:open="isDeleteModalOpen"
    :group-id="groupId"
    :member="memberToDelete"
    @success="handleMembersChanged"
  />
</template>
