<script setup lang="ts">
import type { WeilaCore } from '@weilasdk/core'
import type { GroupModel } from '~/api/contact'
import type { Member } from '~/types/api'
import Message from '@arco-design/web-vue/es/message'
import IconMessage from '@arco-design/web-vue/es/icon/icon-message'
import { WL_IDbSessionType } from '@weilasdk/core'
import { computed, shallowRef } from 'vue'

interface Props {
  core: WeilaCore | null
}

interface MemberListResponse {
  count: number
  members: Member[]
}

interface GroupListResponse {
  count: number
  groups: GroupModel[]
}

const props = defineProps<Props>()

const router = useRouter()
const weilaStore = useWeilaStore()
const { userInfo } = storeToRefs(weilaStore)

const currentUserId = computed(() => userInfo.value?.userId ?? 0)

const modalVisible = shallowRef(false)
const activeType = shallowRef<'individual' | 'group'>('individual')

const memberPage = shallowRef(1)
const memberSearch = shallowRef('')
const debouncedMemberSearch = useDebounce(memberSearch, 300)

const {
  data: memberData,
  isPending: isMembersPending,
} = useWeilaFetch<MemberListResponse>(
  () => `corp/address/get-member-list?page=${memberPage.value}&size=10`,
  {
    body: () => ({ key: debouncedMemberSearch.value }),
  },
)

const members = computed(
  () => memberData.value?.members?.filter(m => m.user_id !== currentUserId.value) ?? [],
)
const hasMoreMembers = computed(
  () => (memberData.value?.count ?? 0) > memberPage.value * 10,
)

const groupPage = shallowRef(1)
const groupSearch = shallowRef('')
const debouncedGroupSearch = useDebounce(groupSearch, 300)

const {
  data: groupData,
  isPending: isGroupsPending,
} = useWeilaFetch<GroupListResponse>(
  () => `corp/group/get-my-manage-group-list?page=${groupPage.value}&size=10`,
  {
    body: () => ({ key: debouncedGroupSearch.value }),
  },
)

const groups = computed(() => groupData.value?.groups ?? [])
const hasMoreGroups = computed(
  () => (groupData.value?.count ?? 0) > groupPage.value * 10,
)

function openIndividual() {
  activeType.value = 'individual'
  memberPage.value = 1
  memberSearch.value = ''
  modalVisible.value = true
}

function openGroup() {
  activeType.value = 'group'
  groupPage.value = 1
  groupSearch.value = ''
  modalVisible.value = true
}

function goPrev() {
  if (activeType.value === 'individual')
    memberPage.value = Math.max(1, memberPage.value - 1)
  else
    groupPage.value = Math.max(1, groupPage.value - 1)
}

function goNext() {
  if (activeType.value === 'individual' && hasMoreMembers.value)
    memberPage.value++
  else if (activeType.value === 'group' && hasMoreGroups.value)
    groupPage.value++
}

async function startIndividual(member: Member) {
  if (!props.core || !member.user_id)
    return

  try {
    await props.core.weila_startNewSession(
      String(member.user_id),
      WL_IDbSessionType.SESSION_CORP_INDIVIDUAL_TYPE,
      {
        sessionName: member.name,
        sessionAvatar: member.avatar,
      },
    )

    await router.replace({
      path: '/workbench/chat',
      query: {
        sessionId: String(member.user_id),
        sessionType: String(WL_IDbSessionType.SESSION_CORP_INDIVIDUAL_TYPE),
        sessionName: member.name,
        sessionAvatar: member.avatar || undefined,
      },
    })

    modalVisible.value = false
  }
  catch (err) {
    console.error('[ChatLauncher] Failed to start individual session:', err)
    Message.error('发起会话失败')
  }
}

async function startGroup(group: GroupModel) {
  if (!props.core)
    return

  try {
    await props.core.weila_startNewSession(
      String(group.id),
      WL_IDbSessionType.SESSION_CORP_GROUP_TYPE,
      {
        sessionName: group.name,
        sessionAvatar: group.avatar,
      },
    )

    await router.replace({
      path: '/workbench/chat',
      query: {
        sessionId: String(group.id),
        sessionType: String(WL_IDbSessionType.SESSION_CORP_GROUP_TYPE),
        sessionName: group.name,
        sessionAvatar: group.avatar || undefined,
      },
    })

    modalVisible.value = false
  }
  catch (err) {
    console.error('[ChatLauncher] Failed to start group session:', err)
    Message.error('发起会话失败')
  }
}
</script>

<template>
    <a-dropdown position="br">
      <a-button type="primary" size="small" class="flex items-center gap-1">
        <template #icon>
          <IconMessage />
        </template>
        <span>发起聊天</span>
      </a-button>
      <template #content>
        <a-doption @click="openIndividual">
          单呼
        </a-doption>
        <a-doption @click="openGroup">
          群呼
        </a-doption>
      </template>
    </a-dropdown>

    <a-modal
      v-model:visible="modalVisible"
      :title="activeType === 'individual' ? '单呼' : '群呼'"
      :footer="false"
      width="480px"
    >
      <div class="flex flex-col gap-3">
        <a-input
          v-if="activeType === 'individual'"
          v-model="memberSearch"
          placeholder="搜索成员"
          allow-clear
        />
        <a-input
          v-else
          v-model="groupSearch"
          placeholder="搜索群组"
          allow-clear
        />

        <a-spin
          :loading="activeType === 'individual' ? isMembersPending : isGroupsPending"
          class="min-h-48"
        >
          <template v-if="activeType === 'individual'">
            <a-list
              :bordered="false"
              size="small"
              class="max-h-80 overflow-y-auto"
            >
              <a-list-item
                v-for="member in members"
                :key="member.user_id"
                class="cursor-pointer hover:bg-neutral-50"
                @click="startIndividual(member)"
              >
                <a-list-item-meta>
                  <template #avatar>
                    <a-avatar
                      :image-url="member.avatar?.replace(/^https?:/, '')"
                      size="small"
                    />
                  </template>
                  <template #title>
                    {{ member.name }}
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </a-list>
            <div v-if="members.length === 0" class="py-6 text-center text-sm text-neutral-400">
              暂无成员
            </div>
          </template>

          <template v-else>
            <a-list
              :bordered="false"
              size="small"
              class="max-h-80 overflow-y-auto"
            >
              <a-list-item
                v-for="group in groups"
                :key="group.id"
                class="cursor-pointer hover:bg-neutral-50"
                @click="startGroup(group)"
              >
                <a-list-item-meta>
                  <template #avatar>
                    <a-avatar
                      :image-url="group.avatar?.replace(/^https?:/, '')"
                      size="small"
                    />
                  </template>
                  <template #title>
                    {{ group.name }}
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </a-list>
            <div v-if="groups.length === 0" class="py-6 text-center text-sm text-neutral-400">
              暂无群组
            </div>
          </template>
        </a-spin>

        <div class="flex justify-end gap-2 pt-2 border-t border-neutral-100">
          <a-button
            size="mini"
            :disabled="(activeType === 'individual' ? memberPage : groupPage) <= 1"
            @click="goPrev"
          >
            上一页
          </a-button>
          <a-button
            size="mini"
            :disabled="activeType === 'individual' ? !hasMoreMembers : !hasMoreGroups"
            @click="goNext"
          >
            下一页
          </a-button>
        </div>
      </div>
    </a-modal>
  </template>
