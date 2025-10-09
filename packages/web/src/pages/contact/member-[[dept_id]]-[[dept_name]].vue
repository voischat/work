<script setup lang="ts">
import type { Member } from '~/types/api'
import { shallowRef } from 'vue'

definePage({
  alias: 'member',
  meta: {
    // name: 'submenu.member-manage', // temporary disable
  },
})

const { t } = useI18n()

const filterInput = shallowRef('')
const key = useDebounce(filterInput, 500)

const curPage = shallowRef(1)
const pageSize = shallowRef(10)

const filters = shallowRef<{ [key: string]: any }>({})

const { data } = useWeilaFetch<{
  count: number
  members: Member[]
}>(() => `corp/address/get-member-list?page=${curPage.value}&size=${pageSize.value}`, {
  body: () => ({
    ...filters.value,
    key: key.value,
  }),
})

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

const isEditMemberModalOpen = shallowRef(false)
const isResetPasswordModalOpen = shallowRef(false)
const isDeleteMemberModalOpen = shallowRef(false)
const selectedItem = shallowRef<Member | undefined>(undefined)
</script>

<template>
  <a-page-header
    :show-back="false"
    :title="$t($route.meta.name || '')"
  >
    <a-card>
      <template #title>
        <a-space>
          <CreateMemberModal />

          <AddDeviceModal />

          <a-input
            v-model="filterInput" :max-length="20" show-word-limit
            :placeholder="`${t('name')}/${t('job-number')}/${t('weila-number')}/${t('phone-number')}`" allow-clear
            w-100
          />
        </a-space>
      </template>

      <MemberTable
        v-model:page="curPage" v-model:selected-item="selectedItem" :members :count="data?.count || 0" :filters="new Set(['member_types', 'dept_ids'])"
        @select="isEditMemberModalOpen = true"
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
                  <a-doption type="warning" @click="isDeleteMemberModalOpen = true">
                    {{ t('注销成员') }}
                  </a-doption>
                </div>
              </template>
            </a-dropdown>
          </a-button-group>
        </template>
      </MemberTable>

      <EditMemberModal v-model:open="isEditMemberModalOpen" :member="selectedItem" />
      <ResetMemberPasswordModal v-model:open="isResetPasswordModalOpen" :member="selectedItem" />
      <DeleteMemberModal v-model:open="isDeleteMemberModalOpen" :member="selectedItem" />
    </a-card>
  </a-page-header>
</template>
