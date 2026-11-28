<script setup lang="ts">
import type { GroupModel } from '~/api/contact'
import Message from '@arco-design/web-vue/es/message'

import { computed, ref as deepRef, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useWeilaApi } from '~/composables/useWeilaApi'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useWeilaMutation } from '~/composables/useWeilaMutation'
import { useSelfInfoStore } from '~/stores/selfInfo'
import { $inspect } from '~/utils/inspect'
import CreateGroupModal from './components/CreateGroupModal.vue'
import EditGroupModal from './components/EditGroupModal.vue'

interface GroupListResponse {
  groups: GroupModel[]
  count: number
}

definePage({
  meta: {
    name: 'submenu.group-manage',
  },
})

const { t } = useI18n()

const router = useRouter()

const curPage = shallowRef(0)
const pageSize = shallowRef(10)

const { data: depts } = useWeilaFetch<{
  id: number
  name: string
  user_count: number
}[]>('corp/address/get-my-manage-all-dept')

const selfInfoStore = useSelfInfoStore()
const isDeptAdmin = computed(() => selfInfoStore.isDeptAdmin)

const { data, refetch } = useWeilaFetch<GroupListResponse>(() => `corp/group/get-my-manage-group-list?page=${curPage.value}&size=${pageSize.value}`)
const weilaApi = useWeilaApi()
const selfUserId = computed(() => Number(selfInfoStore.selfInfo?.user_id))
const groupMembership = shallowRef<Record<number, boolean>>({})
const membershipPending = new Set<number>()

async function ensureGroupMembership(groupId: number): Promise<void> {
  if (selfInfoStore.isOwner || selfInfoStore.isAdmin)
    return
  if (groupId in groupMembership.value || membershipPending.has(groupId))
    return

  membershipPending.add(groupId)
  try {
    const members = await weilaApi.value.v2.fetch<{ user_id: number }[]>('corp/group/get-group-all-member', {
      body: { group_id: groupId },
    })
    groupMembership.value = {
      ...groupMembership.value,
      [groupId]: members.some(member => Number(member.user_id) === selfUserId.value),
    }
  }
  catch (error) {
    console.error(`获取群组 ${groupId} 成员失败:`, error)
  }
  finally {
    membershipPending.delete(groupId)
  }
}

const selectedGroup = deepRef<any>(undefined)
const isDeleteGroupModalOpen = shallowRef(false)

const checkedGroupIds = deepRef<number[]>([])

const { mutate: deleteGroup, isPending: isDeleteGroupPending } = useWeilaMutation<{
  group_id: number
}>('corp/group/delete-group', {
  onSuccess: () => {
    isDeleteGroupModalOpen.value = false
    Message.success(t('message.success'))
    refetch()
  },
})

$inspect(checkedGroupIds)

function onSelect(group: GroupModel, e: PointerEvent) {
  selectedGroup.value = group
  const target = e.target
  if (!(target instanceof HTMLElement) || !target.className.includes('arco-table')) {
    return void 0
  }

  router.push(`/contact/group-${group.id}-${group.name}`)
}

function canSendGroupMessage(group: GroupModel) {
  return selfInfoStore.isOwner
    || selfInfoStore.isAdmin
    || groupMembership.value[group.id] === true
}

function openGroupChat(group: GroupModel) {
  if (!canSendGroupMessage(group))
    return

  router.push({
    path: '/workbench/message',
    query: {
      sessionId: String(group.id),
      sessionType: '18',
      sessionName: group.name,
      sessionAvatar: group.avatar || undefined,
    },
  })
}
</script>

<template>
  <a-page-header
    :show-back="false"
    :title="$t($route.meta.name || '')"
  >
    <a-card>
      <template #title>
        <a-space>
          <CreateGroupModal />
        </a-space>
      </template>

      <!-- @vue-expect-error type error when arco's row-click -->
      <a-table
        :pagination="{
          pageSize: 10,
          total: data?.count || 0,
        }"
        :data="data?.groups" size="medium" :column-resizable="true" :scroll="{
          x: 1000,
          y: 600,
        }" :scrollbar="true" @row-click="(...args) => onSelect(...args)"

        @page-change="(page) => curPage = page - 1"
      >
        <template #columns>
          <a-table-column :title="t('avatar')">
            <template #cell="{ record: { avatar } }">
              <a-avatar :image-url="avatar?.replace(/^https?:/, '')">
                <IconUser />
              </a-avatar>
            </template>
          </a-table-column>
          <a-table-column :title="t('name')">
            <template #cell="{ record: { name } }">
              {{ name }}
            </template>
          </a-table-column>
          <a-table-column :title="t('user-count')">
            <template #cell="{ record: { user_count } }">
              {{ user_count }}
            </template>
          </a-table-column>
          <a-table-column :title="t('burst-mode')">
            <template #cell="{ record: { burst_mode } }">
              <a-tag>
                {{
                  {
                    0: t('burst-mode-0'),
                    1: t('burst-mode-1'),
                    2: t('burst-mode-2'),
                  }[burst_mode as number]
                }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column
            :title="t('dept.name')" data-index="dept_ids"
            :filterable="!isDeptAdmin ? {
              filters: depts?.map((i) => ({
                text: i.name,
                value: String(i.id),
              })),
              filter: (values: string[], record: any) => values.some((i: string) => i === String(record.dept_id)),
              multiple: true,
            } : undefined"
          >
            <template #cell="{ record: { dept_id } }">
              {{ depts?.find(d => d.id === dept_id)?.name || '' }}
            </template>
          </a-table-column>
          <a-table-column :title="t('created')">
            <template #cell="{ record: { created } }">
              {{ new Date(created * 1000).toLocaleDateString() }}
            </template>
          </a-table-column>
          <a-table-column :title="t('controls')">
            <template #cell="{ record }">
              <div flex gap2>
                <EditGroupModal :group="selectedGroup" @success="refetch">
                  <a-button @click="() => selectedGroup = record">
                    {{ t('button.edit') }}
                  </a-button>
                </EditGroupModal>
                <a-dropdown :hide-on-select="false">
                  <a-button @click="ensureGroupMembership(record.id)">
                    <template #icon>
                      <icon-down />
                    </template>
                  </a-button>
                  <template #content>
                    <div flex="~ col" p0>
                      <a-doption v-if="canSendGroupMessage(record)" @click="openGroupChat(record)">
                        {{ t('button.send-message') }}
                      </a-doption>
                      <a-doption type="warning" @click="selectedGroup = record; isDeleteGroupModalOpen = true">
                        {{ t('button.delete') }}
                      </a-doption>
                    </div>
                  </template>
                </a-dropdown>
              </div>
            </template>
          </a-table-column>
        </template>
      </a-table>
      <a-modal v-model:visible="isDeleteGroupModalOpen" :title="t('delete.modal.title')">
        <p>{{ t('delete.modal.hint') }} {{ t('delete.modal.content') }}</p>
        <template #footer>
          <a-button type="primary" :loading="isDeleteGroupPending" @click="deleteGroup({ group_id: selectedGroup?.id })">
            {{ t('button.submit') }}
          </a-button>
        </template>
      </a-modal>
    </a-card>
  </a-page-header>
</template>
