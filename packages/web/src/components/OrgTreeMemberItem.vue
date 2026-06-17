<script setup lang="ts">
import type { Member } from '~/types/api'

interface Props {
  member: Member
  selected?: boolean
  disabled?: boolean
  memberTitle?: (member: Member) => string
  showActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  disabled: false,
  memberTitle: (member: Member) => member.name,
  showActions: false,
})

const emit = defineEmits<{
  select: [member: Member]
}>()

const { t } = useI18n()

function handleClick() {
  if (props.disabled)
    return
  emit('select', props.member)
}

function formatMemberMeta(member: Member) {
  return member.user_num || String(member.user_id)
}

function isMemberOnline(member: Member) {
  return (member.online_status ?? member.online) === 1
}

function getMemberTypeLabel(member: Member) {
  if (member.is_dept_admin)
    return t('dept-manager')

  if (member.type === 1)
    return t('device')

  return ''
}
</script>

<template>
  <button
    type="button"
    class="org-tree-member-item"
    :disabled="disabled"
    :class="{
      'org-tree-member-item--selected': selected,
      'org-tree-member-item--disabled': disabled,
    }"
    @click="handleClick"
  >
    <a-avatar :image-url="member.avatar?.replace(/^https?:/, '')" :size="32">
      <IconUser />
    </a-avatar>
    <span class="min-w-0 flex-1">
      <span class="org-tree-member-item__title">
        <span truncate>{{ props.memberTitle(member) }}</span>
        <a-tag :color="isMemberOnline(member) ? 'green' : 'gray'" size="small">
          {{ isMemberOnline(member) ? t('online') : t('offline') }}
        </a-tag>
        <a-tag v-if="getMemberTypeLabel(member)" color="blue" size="small">
          {{ getMemberTypeLabel(member) }}
        </a-tag>
      </span>
      <span class="org-tree-member-item__meta">
        {{ t('weila-number-with-value', { num: formatMemberMeta(member) }) }}
      </span>
    </span>
    <span class="org-tree-member-item__actions" @click.stop>
      <slot name="actions" :member="member" />
    </span>
  </button>
</template>

<style scoped>
.org-tree-member-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 9px 12px 9px 34px;
}

.org-tree-member-item:hover {
  background: var(--color-fill-2);
}

.org-tree-member-item--selected {
  background: rgb(var(--primary-1));
  color: rgb(var(--primary-6));
}

.org-tree-member-item--disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.org-tree-member-item--disabled:hover {
  background: transparent;
}

.org-tree-member-item__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
}

.org-tree-member-item__meta {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--color-text-3);
}

.org-tree-member-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
  margin-left: auto;
  opacity: v-bind('showActions ? 1 : 0');
  transition: opacity 0.2s ease;
}

.org-tree-member-item:hover .org-tree-member-item__actions,
.org-tree-member-item--selected .org-tree-member-item__actions {
  opacity: 1;
}
</style>
