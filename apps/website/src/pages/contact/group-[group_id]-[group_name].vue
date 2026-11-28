<script setup lang="ts">
import type { Member } from '~/types/api'
import type { TableColumn } from '~/utils/tableModel'
import Message from '@arco-design/web-vue/es/message'
import { useQuery } from '@tanstack/vue-query'
import { WL_IDbSessionType } from '@vois/weila-sdk-core'
import { storeToRefs } from 'pinia'

import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { TrackType } from '~/api/contact'
import { useWeilaApi } from '~/composables/useWeilaApi'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useSelfInfoStore } from '~/stores/selfInfo'
import { useWeilaStore } from '~/stores/weila'
import AddGroupMemberModal from './components/AddGroupMemberModal.vue'
import DeleteGroupMemberModal from './components/DeleteGroupMemberModal.vue'

const { t } = useI18n()
const route = useRoute('/contact/group-[group_id]-[group_name]')
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
const weilaApi = useWeilaApi()
const groupId = computed(() => Number(route.params.group_id))
const selfUserId = computed(() => Number(selfInfoStore.selfInfo?.user_id))

const columns = computed<TableColumn<Member>[]>(() => [
  {
    key: 'avatar',
    title: t('avatar'),
  },
  {
    key: 'online_status',
    title: t('member.online-status'),
    width: 100,
  },
  {
    key: 'name',
    title: t('name'),
  },
  {
    key: 'user_num',
    title: t('weila-number'),
  },
  {
    key: 'phone',
    title: t('phone-number'),
  },
  {
    key: 'dept_ids',
    title: t('dept.name'),
    filter: isDeptAdmin.value
      ? undefined
      : {
          multiple: true,
          options: (depts.value ?? []).map(dept => ({ label: dept.name, value: dept.id })),
          predicate: (values, member) => values.includes(member.dept_id),
        },
  },
  {
    key: 'loc_share',
    title: t('loc_share'),
  },
  {
    key: 'track',
    title: t('track'),
  },
  {
    key: 'actions',
    title: t('controls'),
  },
])

function trackLabel(track: number): string {
  const labels: Record<number, string> = {
    [TrackType.Close]: t('track-type.close'),
    [TrackType.High]: t('track-type.high'),
    [TrackType.Medium]: t('track-type.medium'),
    [TrackType.Low]: t('track-type.low'),
    [TrackType.Fast]: t('track-type.fast'),
  }

  return labels[track] ?? ''
}

function deptName(deptId: number): string {
  return depts.value?.find(dept => dept.id === deptId)?.name ?? ''
}

const weilaStore = useWeilaStore()
const { core: weilaCore, userInfo } = storeToRefs(weilaStore)

async function initSdk() {
  if (weilaCore.value && userInfo.value)
    return weilaCore.value

  const loggedIn = await weilaStore.autoLogin()
  return loggedIn ? weilaCore.value : null
}

const startingSessionUserId = shallowRef<number>()

async function handleSendMessage(member: Member) {
  if (selfInfoStore.isCurrentUser(member.user_id))
    return

  if (!member.user_id) {
    Message.error('成员缺少用户 ID')
    return
  }

  startingSessionUserId.value = member.user_id

  try {
    const core = weilaCore.value ?? await initSdk()

    if (!core) {
      Message.error('SDK 初始化失败，请重新登录后再试')
      return
    }

    const session = await core.weila_startNewSession(
      String(member.user_id),
      WL_IDbSessionType.SESSION_CORP_INDIVIDUAL_TYPE,
      {
        sessionName: member.name,
        sessionAvatar: member.avatar,
      },
    )

    await router.push({
      path: '/workbench/message',
      query: {
        sessionId: session.sessionId,
        sessionType: String(WL_IDbSessionType.SESSION_CORP_INDIVIDUAL_TYPE),
        sessionName: member.name,
        sessionAvatar: member.avatar || undefined,
      },
    })
  }
  catch (err) {
    console.error('[Group] Failed to start session:', err)
    Message.error('发送消息失败')
  }
  finally {
    startingSessionUserId.value = undefined
  }
}

const { data } = useWeilaFetch<{ count: number, members: Member[] }>(() => `corp/group/get-group-member-list?page=${curPage.value}&size=${pageSize.value}`, {
  body: () => ({
    group_id: groupId.value,
  }),
})

const { data: canSendGroupMessage } = useQuery<boolean>({
  enabled: computed(() => Boolean(selfUserId.value && groupId.value)),
  queryKey: ['corp/group/get-group-all-member/self-membership', groupId, selfUserId],
  queryFn: async () => {
    const members = await weilaApi.value.v2.fetch<Member[]>('corp/group/get-group-all-member', {
      body: { group_id: groupId.value },
    })

    return members.some(member => Number(member.user_id) === selfUserId.value)
  },
})

const isEditModalVisible = shallowRef(false)
const selectedItem = shallowRef<Member | undefined>(undefined)

function openGroupChat() {
  if (canSendGroupMessage.value !== true)
    return

  router.push({
    path: '/workbench/message',
    query: {
      sessionId: String(route.params.group_id),
      sessionType: '18',
      sessionName: String(route.params.group_name),
    },
  })
}

function openMember(member: Member) {
  selectedItem.value = member
  isEditModalVisible.value = true
}
</script>

<template>
  <a-page-header
    show-back
    :title="$t('submenu.group-manage')"
    @back="$router.back"
  >
    <template #breadcrumb>
      <a-breadcrumb>
        <a-breadcrumb-item>{{ $t('group-list') }}</a-breadcrumb-item>
        <a-breadcrumb-item>{{ route.params.group_name }}</a-breadcrumb-item>
      </a-breadcrumb>
    </template>
    <template #extra>
      <a-button v-if="canSendGroupMessage || selfInfoStore.isOwner || selfInfoStore.isAdmin" type="primary" @click="openGroupChat">
        {{ t('button.send-message') }}
      </a-button>
    </template>
    <a-card>
      <template #title>
        <a-space>
          <AddGroupMemberModal :group-id="groupId">
            <a-button>
              <i i-ph-plus inline-block /> {{ t('button.add-group-member') }}
            </a-button>
          </AddGroupMemberModal>
        </a-space>
      </template>

      <DataTable
        v-model:page="curPage"
        :columns="columns"
        :data="data?.members ?? []"
        :total="data?.count || 0"
        fixed-layout
        @row-click="openMember"
      >
        <template #cell-avatar="{ record }">
          <a-avatar :image-url="record.avatar?.replace(/^https?:/, '')">
            <IconUser />
          </a-avatar>
        </template>
        <template #cell-online_status="{ record }">
          <a-tag :color="record.online_status === 1 ? 'green' : 'gray'">
            {{ record.online_status === 1 ? t('online') : t('offline') }}
          </a-tag>
        </template>
        <template #cell-dept_ids="{ record }">
          {{ deptName(record.dept_id) }}
        </template>
        <template #cell-loc_share="{ record }">
          <a-tag v-if="record.loc_share" color="green">
            {{ t('open') }}
          </a-tag>
          <a-tag v-else color="gray">
            {{ t('close') }}
          </a-tag>
        </template>
        <template #cell-track="{ record }">
          <a-tag>{{ trackLabel(record.track) }}</a-tag>
        </template>
        <template #cell-actions="{ record }">
          <div flex gap2>
            <a-button
              v-if="!selfInfoStore.isCurrentUser(record.user_id)"
              :disabled="startingSessionUserId === record.user_id"
              @click="handleSendMessage(record)"
            >
              {{ t('button.send-message') }}
            </a-button>
            <DeleteGroupMemberModal
              :group-id="groupId" :member="selectedItem"
            >
              <a-button status="danger">
                {{ t('button.delete') }}
              </a-button>
            </DeleteGroupMemberModal>
          </div>
        </template>
      </DataTable>

      <EditMemberModal v-model:open="isEditModalVisible" :member="selectedItem" />
    </a-card>
  </a-page-header>
</template>
