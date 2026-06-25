<script setup lang="ts">
import type { WeilaCore } from '@weilasdk/core'
import type { GroupModel } from '~/api/contact'
import type { Member } from '~/types/api'
import IconMessage from '@arco-design/web-vue/es/icon/icon-message'
import Message from '@arco-design/web-vue/es/message'
import { WL_IDbSessionType } from '@weilasdk/core'
import { computed, shallowRef } from 'vue'
import CreateGroupModal from '../../contact/components/CreateGroupModal.vue'

interface Props {
  core: WeilaCore | null
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
const popupVisible = shallowRef(false)

const triggerRef = shallowRef<HTMLElement>()
const triggerWidth = computed(() => triggerRef.value?.clientWidth ?? 296)

function openIndividualFromPopup() {
  popupVisible.value = false
  openIndividual()
}

function openGroupFromPopup() {
  popupVisible.value = false
  openGroup()
}

const groupPage = shallowRef(1)
const groupSearch = shallowRef('')
const debouncedGroupSearch = useDebounce(groupSearch, 300)

const {
  data: groupData,
  isPending: isGroupsPending,
  refetch: refetchGroups,
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
  modalVisible.value = true
}

function openGroup() {
  activeType.value = 'group'
  groupPage.value = 1
  groupSearch.value = ''
  modalVisible.value = true
}

function goPrev() {
  if (activeType.value === 'group')
    groupPage.value = Math.max(1, groupPage.value - 1)
}

function goNext() {
  if (activeType.value === 'group' && hasMoreGroups.value)
    groupPage.value++
}

async function startIndividual(member: Member) {
  if (!props.core || !member.user_id)
    return

  if (member.user_id === currentUserId.value) {
    Message.warning('不能和自己发起个人对话')
    return
  }

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
        memberCount: group.user_count,
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
  <div class="w-full">
    <a-trigger
      v-model:popup-visible="popupVisible"
      position="br"
      trigger="click"
      :popup-style="{ width: `${triggerWidth}px` }"
      :popup-translate="[0, 4]"
      auto-fit-position
      :unmount-on-close="true"
    >
      <div ref="triggerRef" class="w-full">
        <a-button type="primary" long class="justify-center flex items-center gap-1">
          <template #icon>
            <IconMessage />
          </template>
          <span>发起对话</span>
        </a-button>
      </div>
      <template #content>
        <div class="bg-white rounded border border-neutral-200 shadow-lg py-1">
          <div
            class="px-3 py-2 text-center text-sm text-primary hover:bg-neutral-50 cursor-pointer"
            @click="openIndividualFromPopup"
          >
            个人对话
          </div>
          <div
            class="px-3 py-2 text-center text-sm text-primary hover:bg-neutral-50 cursor-pointer"
            @click="openGroupFromPopup"
          >
            群组对话
          </div>
        </div>
      </template>
    </a-trigger>
  </div>

  <a-modal
    v-model:visible="modalVisible"
    :title="activeType === 'individual' ? '个人对话' : '群组对话'"
    :footer="false"
    width="480px"
  >
    <div class="flex min-h-80 max-h-[70vh] flex-col gap-3 overflow-hidden">
      <a-input
        v-if="activeType === 'group'"
        v-model="groupSearch"
        placeholder="搜索群组"
        allow-clear
      />

      <a-spin
        :loading="activeType === 'group' && isGroupsPending"
        class="min-h-48"
      >
        <template v-if="activeType === 'individual'">
          <OrgTree class="max-h-[52vh] overflow-y-auto rounded border border-neutral-200" @select-member="startIndividual" />
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
          <CreateGroupModal @success="refetchGroups">
            <template #trigger="{ open }">
              <a-button type="outline" long class="mt-3" @click="open">
                <template #icon>
                  <icon-plus />
                </template>
                创建群组
              </a-button>
            </template>
          </CreateGroupModal>
        </template>
      </a-spin>

      <div v-if="activeType === 'group'" class="flex justify-end gap-2 pt-2 border-t border-neutral-100">
        <a-button
          size="mini"
          :disabled="groupPage <= 1"
          @click="goPrev"
        >
          上一页
        </a-button>
        <a-button
          size="mini"
          :disabled="!hasMoreGroups"
          @click="goNext"
        >
          下一页
        </a-button>
      </div>
    </div>
  </a-modal>
</template>
