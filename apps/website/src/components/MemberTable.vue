<script setup lang="ts">
import type { Member } from '~/types/api'
import { useI18n } from 'vue-i18n'
import { TrackType } from '~/api/contact'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useWeilaMutation } from '~/composables/useWeilaMutation'
import { useAppStore } from '~/stores/app'

withDefaults(defineProps<{
  members: Member[]
  count: number
  actions?: boolean
  filters?: Set<string>
}>(), {
  actions: true,
  filters: () => new Set(),
})

const emits = defineEmits<{
  (e: 'select', member: Member, _: PointerEvent): void
  (e: 'change', ...args: any[]): void
}>()

const curPage = defineModel('page', { default: 0, required: true })

const { t } = useI18n()
const { themeColor } = useAppStore()

const selected = defineModel<Member | undefined>('selected-item', { default: undefined })

function onSelect(member: Member, e: PointerEvent) {
  selected.value = member

  const target = e.target
  if (!(target instanceof HTMLElement) || !target.className.includes('arco-table')) {
    return void 0
  }

  emits('select', member, e)
}

const { data: depts } = useWeilaFetch<{
  id: number
  name: string
  user_count: number
}[]>('corp/address/get-my-manage-all-dept')

const { mutateAsync: changeMemberState } = useWeilaMutation<{ state: 0 | 1 }, {
  user_id: number
  state: 0 | 1
}>('corp/address/change-member-state')

async function toggleMemberState(targetId: number, state: 0 | 1) {
  const newState = state ? 0 : 1
  return changeMemberState({
    user_id: targetId,
    state: newState,
  })
    .then(({ state }) => state === newState)
    .catch(() => false)
}
</script>

<template>
  <div>
    <!-- @vue-expect-error type error when arco's row-click -->
    <a-table
      :data="members"
      :pagination="{
        pageSize: 10,
        total: count || 0,
        current: curPage + 1,
      }"
      :column-resizable="true"
      :scrollbar="true"
      @change="(...args) => emits('change', ...args) "
      @page-change="(page) => curPage = page - 1"
      @row-click="(...args) => onSelect(...args)"
    >
      <template #columns>
        <a-table-column :title="t('member.state')">
          <template #cell="{ record: { state, user_id, type } }">
            <a-switch
              :disabled="type === 255"
              :default-checked="Boolean(!state)" :checked-value="0" :unchecked-value="1"
              :checked-color="themeColor" unchecked-color="#ddd" :before-change="(state) => toggleMemberState(
                user_id,
                Number(state) ? 0 : 1,
              )"
            >
              <template #checked>
                {{ t('member-state.enabled') }}
              </template>
              <template #unchecked>
                {{ t('member-state.paused') }}
              </template>
            </a-switch>
          </template>
        </a-table-column>

        <a-table-column :title="t('avatar')" :width="80">
          <template #cell="{ record: { avatar } }">
            <a-avatar :image-url="avatar">
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
        <a-table-column
          :title="t('name')" :sortable="{
            sortDirections: ['ascend', 'descend'],
          }"
        >
          <template #cell="{ record: { name } }">
            {{ name }}
          </template>
        </a-table-column>
        <a-table-column :title="t('weila-number')">
          <template #cell="{ record: { user_num } }">
            {{ user_num }}
          </template>
        </a-table-column>

        <a-table-column
          :title="t('type')"
          data-index="member_types"
          :filterable="filters.has('member_types') ? {
            filters: [{
              text: t('user-type.member'),
              value: '0',
            }, {
              text: t('user-type.device'),
              value: '1',
            }, {
              text: t('manager'),
              value: '2',
            }, {
              text: t('user-type.owner'),
              value: '255',
            }],
            filter: (values: string[], record: any) => Number(record.type) === Number(values?.[0]),
            multiple: false,
          } : undefined"
        >
          <template #cell="{ record: { type, is_dept_admin } }">
            <a-tag :color="is_dept_admin ? 'orange' : ''">
              {{ {
                0: t('user-type.member'),
                1: t('user-type.device'),
                2: t('manager'),
                255: t('user-type.owner'),
              }[Number(type)] }}
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column :title="t('group-count')">
          <template #cell="{ record: { grp_cnt, grp_lmt } }">
            <a-tag :color="grp_cnt >= grp_lmt ? 'magenta' : 'gray'">
              {{ grp_cnt }} / {{ grp_lmt }}
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column :title="t('job-number')">
          <template #cell="{ record: { job_num } }">
            {{ job_num }}
          </template>
        </a-table-column>
        <a-table-column
          :title="t('dept.name')" data-index="dept_ids"
          :filterable="filters.has('dept_ids') ? {
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

        <a-table-column
          :title="t('created')" :sortable="{
            sortDirections: ['ascend', 'descend'],
          }"
        >
          <template #cell="{ record: { created } }">
            {{ new Date(created * 1000).toLocaleDateString() }}
          </template>
        </a-table-column>

        <a-table-column :title="t('phone')">
          <template #cell="{ record: { phone } }">
            {{ phone }}
          </template>
        </a-table-column>
        <a-table-column :title="t('track')">
          <template #cell="{ record: { track } }">
            <a-tag>
              <!-- @vue-expect-error type error -->
              {{
                {
                  [TrackType.Close]: t('track-type.close'),
                  [TrackType.High]: t('track-type.high'),
                  [TrackType.Medium]: t('track-type.medium'),
                  [TrackType.Low]: t('track-type.low'),
                  [TrackType.Fast]: t('track-type.fast'),
                }[track] }}
            </a-tag>
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

        <a-table-column v-if="actions" :title="t('controls')" fixed="right">
          <template #cell="{ record }">
            <slot name="actions" v-bind="{ record, selected }" />
          </template>
        </a-table-column>
      </template>
    </a-table>

    <slot name="bottom" v-bind="{ selected }" />
  </div>
</template>
