<script setup lang="ts">
import type { Member } from '~/types/api'
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

const { data } = useWeilaFetch(() => `corp/group/get-group-member-list?page=${curPage.value}&size=${pageSize.value}`, {
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

function onSelect(member: Member, e: PointerEvent) {
  selectedItem.value = member
  const target = e.target
  if (!(target instanceof HTMLElement) || !target.className.includes('arco-table')) {
    return void 0
  }

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

      <!-- @vue-expect-error type error when arco's row-click -->
      <a-table
        :columns="cols"
        :pagination="{
          pageSize: 10,
          total: data?.count || 0,
        }"
        :data="data?.members"
        size="medium" :column-resizable="true" :scroll="{
          x: 1000,
          y: 600,
        }" :scrollbar="true"
        @page-change="(page) => curPage = page - 1" @row-click="(...args) => onSelect(...args)"
      >
        <template #columns>
          <a-table-column :title="t('avatar')">
            <template #cell="{ record: { avatar } }">
              <a-avatar :image-url="avatar?.replace(/^https?:/, '')">
                <IconUser />
              </a-avatar>
            </template>
          </a-table-column>

          <a-table-column :title="t('member.online-status')" :width="100">
            <template #cell="{ record: { online_status } }">
              <a-tag :color="online_status === 1 ? 'green' : 'gray'">
                {{ online_status === 1 ? t('online') : t('offline') }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column :title="t('name')">
            <template #cell="{ record: { name } }">
              {{ name }}
            </template>
          </a-table-column>
          <a-table-column :title="t('weila-number')">
            <template #cell="{ record: { user_num } }">
              {{ user_num }}
            </template>
          </a-table-column>
          <a-table-column :title="t('phone-number')">
            <template #cell="{ record: { phone } }">
              {{ phone }}
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
          <a-table-column :title="t('loc_share')">
            <template #cell="{ record: { loc_share } }">
              <a-tag v-if="loc_share" color="green">
                {{ t('open') }}
              </a-tag>
              <a-tag v-else color="gray">
                {{ t('close') }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column :title="t('track')">
            <template #cell="{ record: { track } }">
              <a-tag>
                <!-- @vue-expect-error type error -->
                {{ {
                  [TrackType.Close]: t('track-type.close'),
                  [TrackType.High]: t('track-type.high'),
                  [TrackType.Medium]: t('track-type.medium'),
                  [TrackType.Low]: t('track-type.low'),
                  [TrackType.Fast]: t('track-type.fast'),
                }[track] }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column :title="t('controls')">
            <template #cell="{ record }">
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
          </a-table-column>
        </template>
      </a-table>

      <EditMemberModal v-model:open="isEditModalVisible" :member="selectedItem" />
    </a-card>
  </a-page-header>
</template>
