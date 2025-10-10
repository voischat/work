<script setup lang="ts">
import type { SelfInfo } from '~/types'
import type { Member } from '~/types/api'
import { shallowRef } from 'vue'

const { data: selfInfo } = useWeilaFetch<SelfInfo>('corp/user/get-selfinfo')

const curPage = shallowRef(1)
const pageSize = shallowRef(10)

const filterInput = shallowRef('')
const key = useDebounce(filterInput, 500)

const filters = shallowRef<{ [key: string]: any }>({})

const route = useRoute('/contact/dept-[dept_id]-[dept_name]')
const { data, refetch } = useWeilaFetch<{
  count: number
  members: Member[]
}>(
  () => `corp/address/get-dept-member-list?page=${curPage.value}&size=${pageSize.value}`,
  {
    body: () => ({
      dept_id: Number(route.params.dept_id),
      ...filters.value,
      key: key.value,
    }),
  },
)

const { t } = useI18n()

const members = computed(() => {
  if (!data.value?.members)
    return []

  if (!filterInput.value)
    return data.value.members

  const searchTerm = filterInput.value.toLowerCase()

  return data.value.members
    .filter(member =>
      member.name.toLowerCase().includes(searchTerm)
      || member.phone.toLowerCase().includes(searchTerm)
      || member.user_num.toLowerCase().includes(searchTerm)
      || member.job_num.toLowerCase().includes(searchTerm),
    )
    .sort((a, b) => a.dept_id - b.dept_id)
})

// const isResetPasswordModalVisible = shallowRef(false)
const isEditMemberModalOpen = shallowRef(false)
const isResetPasswordModalOpen = shallowRef(false)
const isDeleteMemberModalOpen = shallowRef(false)

const selectedItem = shallowRef<Member | undefined>(undefined)
</script>

<template>
  <a-page-header
    :title="$t('submenu.dept-manage')"
    @back="$router.back"
  >
    <template #breadcrumb>
      <a-breadcrumb>
        <a-breadcrumb-item>{{ $t('department-list') }}</a-breadcrumb-item>
        <a-breadcrumb-item>{{ route.params.dept_name }}</a-breadcrumb-item>
      </a-breadcrumb>
    </template>
    <a-card>
      <template #title>
        <a-space>
          <CreateMemberModal :dept-id="Number(route.params.dept_id)" />

          <AddDeviceModal :dept-id="Number(route.params.dept_id)" />

          <a-input
            v-model="filterInput" :max-length="20" show-word-limit
            :placeholder="`${t('name')}/${t('job-number')}/${t('weila-number')}/${t('phone-number')}`" allow-clear
            w-100
          />
        </a-space>
      </template>
      <template #extra>
        <AddDeptMemberModal v-if="selfInfo?.type === 255" :dept-id="Number(route.params.dept_id)" @success="refetch" />
      </template>

      <MemberTable
        v-model:page="curPage" v-model:selected-item="selectedItem" :members :count="data?.count || 0" :filters="new Set(['member_types'])"
        @change="(_: any, e: any) => {
          if (e.type === 'filter')
            filters = e.filters
        }"
      >
        <template #actions="{ record }">
          <a-button-group>
            <a-button @click="isEditMemberModalOpen = true">
              {{ t('edit') }}
            </a-button>

            <a-dropdown v-if="record.type !== 255" :hide-on-select="false">
              <a-button>
                <template #icon>
                  <icon-down />
                </template>
              </a-button>
              <template #content>
                <div flex="~ col" p0>
                  <a-doption @click="isResetPasswordModalOpen = true">
                    {{ t('reset-password.button') }}
                  </a-doption>
                  <a-doption @click="isDeleteMemberModalOpen = true">
                    {{ t('注销成员') }}
                  </a-doption>
                </div>
              </template>
            </a-dropdown>
          </a-button-group>
        </template>
      </MemberTable>

      <EditMemberModal v-model:open="isEditMemberModalOpen" :member="selectedItem" :dept-id="Number(route.params.dept_id)" />
      <ResetMemberPasswordModal v-model:open="isResetPasswordModalOpen" :member="selectedItem" />
      <DeleteMemberModal v-model:open="isDeleteMemberModalOpen" :member="selectedItem" />
    </a-card>
  </a-page-header>
</template>
