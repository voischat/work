<script setup lang="ts">
import type { OrgTreeSelectedItem } from './orgTreeSelection'
import type { DeptModel } from '~/api/contact'
import type { Member } from '~/types/api'
import Message from '@arco-design/web-vue/es/message'
import { computed, nextTick, shallowRef } from 'vue'
import {
  addDeptToSelection,
  computeDeptCheckState,
  createCommitQueue,
  createSelectedItem,
  pruneSelection,
  removeDeptFromSelection,
  toCheckboxView,
  toggleMemberInSelection,
} from './orgTreeSelection'

interface DeptState {
  dept: DeptModel
  expanded: boolean
  loading: boolean
  loaded: boolean
  members: Member[]
}

const props = withDefaults(defineProps<{
  selected?: OrgTreeSelectedItem[]
  selectMode?: 'solo' | 'multi'
  disabledMemberIds?: number[]
  disabledMemberIdsLoading?: boolean
  isMemberEnabled?: (member: Member) => boolean
  memberTitle?: (member: Member) => string
}>(), {
  selected: () => [],
  selectMode: 'solo',
  disabledMemberIds: () => [],
  disabledMemberIdsLoading: false,
  isMemberEnabled: () => true,
  memberTitle: (member: Member) => member.name,
})

const emit = defineEmits<{
  'update:selected': [items: OrgTreeSelectedItem[]]
  'selectMember': [member: Member]
}>()

const { t } = useI18n()

const { data: deptData, isPending: isDeptPending } = useWeilaFetch<DeptModel[]>('corp/address/get-my-manage-all-dept')

const weilaApi = useWeilaApi()
const deptStates = shallowRef<DeptState[]>([])
const selectedMemberIds = computed(() => new Set(props.selected.map(item => item.id)))
const disabledIdSet = computed(() => new Set(props.disabledMemberIds))

function isMemberSelectable(member: Member) {
  return props.isMemberEnabled(member) && !disabledIdSet.value.has(member.user_id)
}

const deptCheckStates = computed(() => new Map(
  deptStates.value.map(item => [
    item.dept.id,
    computeDeptCheckState({
      loaded: item.loaded,
      loading: item.loading,
      members: item.members,
      selectedIds: selectedMemberIds.value,
      isSelectable: isMemberSelectable,
    }),
  ]),
))

const { commit: commitSelection } = createCommitQueue({
  read: () => props.selected,
  write: next => emit('update:selected', next),
  flush: () => nextTick(),
})

watch(
  deptData,
  (data) => {
    const previous = new Map(deptStates.value.map(state => [state.dept.id, state]))
    deptStates.value = (data ?? []).map((dept) => {
      const existing = previous.get(dept.id)
      if (existing) {
        existing.dept = dept
        return existing
      }
      return {
        dept,
        expanded: false,
        loading: false,
        loaded: false,
        members: [],
      }
    })

    const first = deptStates.value[0]
    if (first && !first.expanded)
      void expandDept(first)
  },
  { immediate: true },
)

watch(
  [
    disabledIdSet,
    () => props.selected,
    () => props.isMemberEnabled,
  ],
  () => {
    void commitSelection(current => pruneSelection(current, isMemberSelectable))
  },
  { flush: 'post' },
)

async function loadDeptMembers(item: DeptState) {
  if (item.loaded)
    return true
  if (item.loading)
    return false

  item.loading = true
  deptStates.value = [...deptStates.value]

  try {
    const members = await weilaApi.value.v2.fetch<Member[]>('corp/address/get-dept-all-member', {
      body: { dept_id: item.dept.id },
    })
    item.members = members
    item.loaded = true
    return true
  }
  catch (error) {
    console.error('[OrgTree] Failed to load dept members:', error)
    Message.error(t('org-tree.load-error'))
    return false
  }
  finally {
    item.loading = false
    deptStates.value = [...deptStates.value]
  }
}

async function expandDept(item: DeptState) {
  item.expanded = true
  deptStates.value = [...deptStates.value]
  await loadDeptMembers(item)
}

async function toggleDept(item: DeptState) {
  item.expanded = !item.expanded
  deptStates.value = [...deptStates.value]

  if (item.expanded)
    await loadDeptMembers(item)
}

function deptCheckboxView(item: DeptState) {
  return toCheckboxView(deptCheckStates.value.get(item.dept.id) ?? 'unloaded', props.disabledMemberIdsLoading)
}

async function selectDept(item: DeptState) {
  if (props.selectMode !== 'multi' || props.disabledMemberIdsLoading)
    return

  const state = deptCheckStates.value.get(item.dept.id) ?? 'unloaded'
  if (state === 'loading' || state === 'empty')
    return

  if (state === 'all') {
    const knownMemberIds = new Set(item.members.map(member => member.user_id))
    await commitSelection(current => removeDeptFromSelection(current, item.dept.id, knownMemberIds))
    return
  }

  if (state === 'unloaded') {
    await expandDept(item)
    if (props.selectMode !== 'multi' || props.disabledMemberIdsLoading)
      return

    const currentItem = deptStates.value.find(current => current.dept.id === item.dept.id)
    if (!currentItem?.loaded)
      return

    await commitSelection(current => addDeptToSelection(current, currentItem.members, currentItem.dept.id, isMemberSelectable))
    return
  }

  await commitSelection(current => addDeptToSelection(current, item.members, item.dept.id, isMemberSelectable))
}

function selectMember(member: Member, dept: DeptModel) {
  if (props.disabledMemberIdsLoading || !isMemberSelectable(member))
    return

  if (props.selectMode === 'multi') {
    const next = toggleMemberInSelection(props.selected, member, dept.id, isMemberSelectable)
    if (next !== props.selected)
      emit('update:selected', next)
  }
  else {
    emit('update:selected', [
      createSelectedItem(member, dept.id),
    ])
  }

  emit('selectMember', member)
}
</script>

<template>
  <a-spin :loading="isDeptPending" class="org-tree">
    <div v-if="deptStates.length" class="org-tree__list">
      <div v-for="item in deptStates" :key="item.dept.id" class="org-tree__dept">
        <div class="org-tree__dept-row">
          <a-checkbox
            v-if="selectMode === 'multi'"
            :model-value="deptCheckboxView(item).checked"
            :indeterminate="deptCheckboxView(item).indeterminate"
            :disabled="deptCheckboxView(item).disabled"
            @change="() => selectDept(item)"
          >
            <span class="sr-only">{{ t('org-tree.select-dept-members', { name: item.dept.name }) }}</span>
          </a-checkbox>
          <button
            type="button"
            class="org-tree__dept-button"
            :aria-expanded="item.expanded"
            @click="toggleDept(item)"
          >
            <span class="min-w-0 flex-1">
              <span class="org-tree__dept-name">{{ item.dept.name }}</span>
              <span class="org-tree__dept-meta">{{ t('org-tree.dept-member-count', { count: item.dept.user_count }) }}</span>
            </span>
            <IconRight
              class="org-tree__chevron"
              :class="{ 'rotate-90': item.expanded }"
            />
          </button>
        </div>

        <div v-if="item.expanded" class="org-tree__members">
          <div v-if="item.loading" class="org-tree__state">
            <a-spin size="small" />
          </div>
          <OrgTreeMemberItem
            v-for="member in item.members"
            v-else
            :key="member.user_id"
            :member="member"
            :selected="selectedMemberIds.has(member.user_id)"
            :disabled="disabledMemberIdsLoading || !isMemberSelectable(member)"
            :show-checkbox="selectMode === 'multi'"
            :member-title="props.memberTitle"
            @select="selectMember(member, item.dept)"
          />
          <div v-if="!item.loading && item.loaded && item.members.length === 0" class="org-tree__state">
            {{ t('org-tree.empty.member') }}
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="!isDeptPending" class="org-tree__state py-10">
      {{ t('org-tree.empty.dept') }}
    </div>
  </a-spin>
</template>

<style scoped>
.org-tree {
  display: block;
  min-height: 160px;
}

.org-tree__list {
  display: flex;
  flex-direction: column;
}

.org-tree__dept {
  overflow: hidden;
  background: transparent;
}

.org-tree__dept-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
}

.org-tree__dept-row:hover {
  background: var(--color-fill-2);
}

.org-tree__dept-button {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 10px 12px 10px 0;
}

.org-tree__chevron {
  width: 16px;
  height: 16px;
  flex: none;
  color: var(--color-text-3);
  transition: transform 0.2s ease;
}

.org-tree__dept-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
}

.org-tree__dept-meta {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--color-text-3);
}

.org-tree__members {
  background: var(--color-fill-1);
}

.org-tree__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  color: var(--color-text-3);
  font-size: 13px;
}
</style>
