<script setup lang="ts">
import type { DeptModel } from '~/api/contact'
import type { Member } from '~/types/api'
import Message from '@arco-design/web-vue/es/message'
import { computed, shallowRef } from 'vue'

export interface OrgTreeSelectedItem {
  type: 'member'
  id: number
  deptId: number
  member: Member
}

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
  isMemberEnabled?: (member: Member) => boolean
  memberTitle?: (member: Member) => string
}>(), {
  selected: () => [],
  selectMode: 'solo',
  disabledMemberIds: () => [],
  isMemberEnabled: () => true,
  memberTitle: (member: Member) => member.name,
})

const emit = defineEmits<{
  'update:selected': [items: OrgTreeSelectedItem[]]
  'selectMember': [member: Member]
}>()

const { data: deptData, isPending: isDeptPending } = useWeilaFetch<{
  depts: DeptModel[]
}>('corp/address/get-my-manage-dept-list')

const weilaApi = useWeilaApi()
const deptStates = shallowRef<DeptState[]>([])
const selectedMemberIds = computed(() => new Set(props.selected.map(item => item.id)))

watch(
  deptData,
  (data) => {
    deptStates.value = (data?.depts ?? []).map(dept => ({
      dept,
      expanded: deptStates.value.find(item => item.dept.id === dept.id)?.expanded ?? false,
      loading: false,
      loaded: false,
      members: deptStates.value.find(item => item.dept.id === dept.id)?.members ?? [],
    }))

    const first = deptStates.value[0]
    if (first && !first.expanded)
      void expandDept(first)
  },
  { immediate: true },
)

async function loadDeptMembers(item: DeptState) {
  if (item.loaded || item.loading)
    return

  item.loading = true
  deptStates.value = [...deptStates.value]

  try {
    const members = await weilaApi.value.v2.fetch<Member[]>('corp/address/get-dept-all-member', {
      body: { dept_id: item.dept.id },
    })
    item.members = members
    item.loaded = true
  }
  catch (error) {
    console.error('[OrgTree] Failed to load dept members:', error)
    Message.error('加载成员失败')
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

function selectMember(member: Member, dept: DeptModel) {
  if (!isMemberSelectable(member))
    return

  const selectedItem: OrgTreeSelectedItem = {
    type: 'member',
    id: member.user_id,
    deptId: dept.id,
    member,
  }
  const next = props.selectMode === 'multi'
    ? selectedMemberIds.value.has(member.user_id)
      ? props.selected.filter(item => item.id !== member.user_id)
      : [...props.selected, selectedItem]
    : [selectedItem]

  emit('update:selected', next)
  emit('selectMember', member)
}

function isMemberSelectable(member: Member) {
  return props.isMemberEnabled(member) && !props.disabledMemberIds.includes(member.user_id)
}

function formatMemberMeta(member: Member) {
  return [
    member.job_num ? `工号 ${member.job_num}` : '',
    member.phone ? `${member.country_code ? `+${member.country_code} ` : ''}${member.phone}` : '',
    member.is_dept_admin ? '部门管理员' : '',
  ].filter(Boolean).join(' · ')
}
</script>

<template>
  <a-spin :loading="isDeptPending" class="org-tree">
    <div v-if="deptStates.length" class="org-tree__list">
      <div v-for="item in deptStates" :key="item.dept.id" class="org-tree__dept">
        <button type="button" class="org-tree__dept-button" @click="toggleDept(item)">
          <span
            class="icon-[carbon--chevron-right] org-tree__chevron"
            :class="{ 'rotate-90': item.expanded }"
          />
          <span class="min-w-0 flex-1">
            <span class="org-tree__dept-name">{{ item.dept.name }}</span>
            <span class="org-tree__dept-meta">部门 ID {{ item.dept.id }} · {{ item.dept.user_count }} 人</span>
          </span>
        </button>

        <div v-if="item.expanded" class="org-tree__members">
          <div v-if="item.loading" class="org-tree__state">
            <a-spin size="small" />
          </div>
          <button
            v-for="member in item.members"
            v-else
            :key="member.user_id"
            type="button"
            class="org-tree__member"
            :disabled="!isMemberSelectable(member)"
            :class="{
              'org-tree__member--selected': selectedMemberIds.has(member.user_id),
              'org-tree__member--disabled': !isMemberSelectable(member),
            }"
            @click="selectMember(member, item.dept)"
          >
            <a-avatar :image-url="member.avatar?.replace(/^https?:/, '')" :size="32">
              <IconUser />
            </a-avatar>
            <span class="min-w-0 flex-1">
              <span class="org-tree__member-title">
                <span truncate>{{ props.memberTitle(member) }}</span>
              </span>
              <span class="org-tree__member-meta">{{ formatMemberMeta(member) || `用户 ID ${member.user_id}` }}</span>
            </span>
          </button>
          <div v-if="!item.loading && item.loaded && item.members.length === 0" class="org-tree__state">
            暂无成员
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="!isDeptPending" class="org-tree__state py-10">
      暂无部门
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
  border-bottom: 1px solid var(--color-border-1);
  background: transparent;
}

.org-tree__dept:last-child {
  border-bottom: 0;
}

.org-tree__dept-button,
.org-tree__member {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.org-tree__dept-button {
  padding: 10px 12px;
}

.org-tree__dept-button:hover,
.org-tree__member:hover {
  background: var(--color-fill-2);
}

.org-tree__member--selected {
  background: rgb(var(--primary-1));
  color: rgb(var(--primary-6));
}

.org-tree__member--disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.org-tree__member--disabled:hover {
  background: transparent;
}

.org-tree__chevron {
  width: 16px;
  height: 16px;
  flex: none;
  color: var(--color-text-3);
  transition: transform 0.2s ease;
}

.org-tree__dept-name,
.org-tree__member-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
}

.org-tree__dept-meta,
.org-tree__member-meta {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--color-text-3);
}

.org-tree__members {
  border-top: 1px solid var(--color-border-1);
  background: var(--color-fill-1);
}

.org-tree__member {
  border-top: 1px solid var(--color-border-1);
  padding: 9px 12px 9px 34px;
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
