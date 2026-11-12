<script setup lang="ts">
import type { WeilaCore } from '@vois/weila-sdk-core'
import type { GroupModel } from '~/api/contact'
import type { Member } from '~/types/api'
import { WL_IDbSessionType } from '@vois/weila-sdk-core'
import { computed, shallowRef, watch } from 'vue'
import CreateGroupModal from '../../contact/components/CreateGroupModal.vue'

export interface SessionSelectPayload {
  sessionId: string
  sessionType: number
  sessionName?: string
  sessionAvatar?: string
  memberCount?: number
}

interface GroupListResponse {
  count: number
  groups: GroupModel[]
}

interface Props {
  visible: boolean
  core: WeilaCore | null
  activeType?: 'individual' | 'group'
  title?: string
  disabledUserIds?: number[]
  loading?: boolean
  loadingText?: string
}

const props = withDefaults(defineProps<Props>(), {
  activeType: 'individual',
  title: '发起对话',
  disabledUserIds: () => [],
  loading: false,
  loadingText: '转发中...',
})

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  'select': [payload: SessionSelectPayload]
}>()

const localVisible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

const currentActiveType = shallowRef(props.activeType)

const groupPage = shallowRef(1)
const groupSearch = shallowRef('')
const debouncedGroupSearch = useDebounce(groupSearch, 300)
const groupQuerySize = computed(() => debouncedGroupSearch.value.trim() ? 100 : 10)

const {
  data: groupData,
  isPending: isGroupsPending,
  refetch: refetchGroups,
} = useWeilaFetch<GroupListResponse>(
  () => `corp/group/get-my-manage-group-list?page=${groupPage.value}&size=${groupQuerySize.value}`,
)

const groups = computed(() => {
  const list = groupData.value?.groups ?? []
  const key = debouncedGroupSearch.value.trim().toLowerCase()
  return key ? list.filter(group => group.name.toLowerCase().includes(key)) : list
})
const hasMoreGroups = computed(
  () => (groupData.value?.count ?? 0) > groupPage.value * groupQuerySize.value,
)

watch(debouncedGroupSearch, () => {
  groupPage.value = 1
})

watch(
  () => props.visible,
  (visible) => {
    if (!visible)
      return

    currentActiveType.value = props.activeType
    groupPage.value = 1
    groupSearch.value = ''
  },
)

function goPrev() {
  if (currentActiveType.value === 'group')
    groupPage.value = Math.max(1, groupPage.value - 1)
}

function goNext() {
  if (currentActiveType.value === 'group' && hasMoreGroups.value)
    groupPage.value++
}

function handleSelectMember(member: Member) {
  if (!member.user_id)
    return

  emit('select', {
    sessionId: String(member.user_id),
    sessionType: WL_IDbSessionType.SESSION_CORP_INDIVIDUAL_TYPE,
    sessionName: member.name,
    sessionAvatar: member.avatar || undefined,
  })
}

function handleSelectGroup(group: GroupModel) {
  emit('select', {
    sessionId: String(group.id),
    sessionType: WL_IDbSessionType.SESSION_CORP_GROUP_TYPE,
    sessionName: group.name,
    sessionAvatar: group.avatar || undefined,
    memberCount: group.user_count,
  })
}
</script>

<template>
  <a-modal
    v-model:visible="localVisible"
    :title="title"
    :footer="false"
    width="480px"
  >
    <div class="relative flex min-h-80 max-h-[70vh] flex-col gap-3 overflow-hidden">
      <div
        v-if="loading"
        class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-sm"
      >
        <a-spin tip-size="24" />
        <span class="text-sm text-neutral-500">{{ loadingText }}</span>
      </div>

      <a-tabs v-model:active-key="currentActiveType">
        <a-tab-pane key="individual" title="个人对话">
          <OrgTree
            class="max-h-[52vh] overflow-y-auto rounded border border-neutral-200"
            :disabled-member-ids="disabledUserIds"
            @select-member="handleSelectMember"
          />
        </a-tab-pane>

        <a-tab-pane key="group" title="群组对话">
          <div class="flex flex-col gap-3">
            <a-input
              v-model="groupSearch"
              placeholder="搜索群组"
              allow-clear
            />

            <a-spin
              :loading="isGroupsPending"
              class="min-h-48"
            >
              <a-list
                :bordered="false"
                size="small"
                class="max-h-80 overflow-y-auto"
              >
                <a-list-item
                  v-for="group in groups"
                  :key="group.id"
                  class="cursor-pointer hover:bg-neutral-50"
                  @click="handleSelectGroup(group)"
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
            </a-spin>

            <div class="flex justify-end gap-2 pt-2 border-t border-neutral-100">
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
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-modal>
</template>
