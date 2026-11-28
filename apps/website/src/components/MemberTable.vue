<script setup lang="ts">
import type { Member } from '~/types/api'
import type { TableColumn, TableFilters } from '~/utils/tableModel'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TrackType } from '~/api/contact'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useWeilaMutation } from '~/composables/useWeilaMutation'
import { useAppStore } from '~/stores/app'

const props = withDefaults(defineProps<{
  members: Member[]
  count: number
  deptFilter?: boolean
}>(), {
  deptFilter: false,
})

const emit = defineEmits<{
  (e: 'filterChange', filters: TableFilters): void
}>()

const page = defineModel<number>('page', { required: true })

const { t } = useI18n()
const { themeColor } = useAppStore()

const { data: depts } = useWeilaFetch<{
  id: number
  name: string
  user_count: number
}[]>('corp/address/get-my-manage-all-dept')

const columns = computed<TableColumn<Member>[]>(() => [
  {
    key: 'state',
    title: t('member.state'),
  },
  {
    key: 'avatar',
    title: t('avatar'),
    width: 80,
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
    key: 'member_types',
    title: t('type'),
    filter: {
      options: [
        {
          label: t('user-type.member'),
          value: 0,
        },
        {
          label: t('user-type.device'),
          value: 1,
        },
        {
          label: t('manager'),
          value: 2,
        },
        {
          label: t('user-type.owner'),
          value: 255,
        },
      ],
      predicate: (values, member) => member.type === values[0],
    },
  },
  {
    key: 'grp_cnt',
    title: t('group-count'),
  },
  {
    key: 'job_num',
    title: t('job-number'),
  },
  {
    key: 'dept_ids',
    title: t('dept.name'),
    filter: props.deptFilter
      ? {
          multiple: true,
          options: (depts.value ?? []).map(dept => ({ label: dept.name, value: dept.id })),
          predicate: (values, member) => values.includes(member.dept_id),
        }
      : undefined,
  },
  {
    key: 'created',
    title: t('created'),
  },
  {
    key: 'phone',
    title: t('phone'),
  },
  {
    key: 'track',
    title: t('track'),
  },
  {
    key: 'loc_share',
    title: t('loc_share'),
  },
  {
    key: 'actions',
    title: t('controls'),
    fixedRight: true,
  },
])

function typeLabel(type: number): string {
  const labels: Record<number, string> = {
    0: t('user-type.member'),
    1: t('user-type.device'),
    2: t('manager'),
    255: t('user-type.owner'),
  }

  return labels[type] ?? ''
}

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
  <DataTable
    v-model:page="page"
    :columns="columns"
    :data="members"
    :total="count"
    size="large"
    @filter-change="filters => emit('filterChange', filters)"
  >
    <template #cell-state="{ record }">
      <a-switch
        :disabled="record.type === 255"
        :default-checked="Boolean(!record.state)"
        :checked-value="0"
        :unchecked-value="1"
        :checked-color="themeColor"
        unchecked-color="#ddd"
        :before-change="value => toggleMemberState(record.user_id, Number(value) ? 0 : 1)"
      >
        <template #checked>
          {{ t('member-state.enabled') }}
        </template>
        <template #unchecked>
          {{ t('member-state.paused') }}
        </template>
      </a-switch>
    </template>

    <template #cell-avatar="{ record }">
      <a-avatar :image-url="record.avatar">
        <IconUser />
      </a-avatar>
    </template>

    <template #cell-online_status="{ record }">
      <a-tag :color="record.online_status === 1 ? 'green' : 'gray'">
        {{ record.online_status === 1 ? t('online') : t('offline') }}
      </a-tag>
    </template>

    <template #cell-member_types="{ record }">
      <a-tag :color="record.is_dept_admin ? 'orange' : ''">
        {{ typeLabel(record.type) }}
      </a-tag>
    </template>

    <template #cell-grp_cnt="{ record }">
      <a-tag :color="record.grp_cnt >= record.grp_lmt ? 'magenta' : 'gray'">
        {{ record.grp_cnt }} / {{ record.grp_lmt }}
      </a-tag>
    </template>

    <template #cell-dept_ids="{ record }">
      {{ deptName(record.dept_id) }}
    </template>

    <template #cell-created="{ record }">
      {{ new Date(record.created * 1000).toLocaleDateString() }}
    </template>

    <template #cell-track="{ record }">
      <a-tag>{{ trackLabel(record.track) }}</a-tag>
    </template>

    <template #cell-loc_share="{ record }">
      <a-tag v-if="record.loc_share" color="green">
        {{ t('open') }}
      </a-tag>
      <a-tag v-else color="gray">
        {{ t('close') }}
      </a-tag>
    </template>

    <template #cell-actions="{ record }">
      <slot name="actions" :record="record" />
    </template>
  </DataTable>
</template>
