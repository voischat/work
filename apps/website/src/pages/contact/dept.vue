<script setup lang="ts">
import type { DeptModel } from '~/api/contact'
import { shallowRef } from 'vue'

import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useSelfInfoStore } from '~/stores/selfInfo'
import CreateDeptModal from './components/CreateDeptModal.vue'
import DeleteDeptModal from './components/DeleteDeptModal.vue'
import EditDeptModal from './components/EditDeptModal.vue'

definePage({
  meta: {
    name: 'submenu.dept-manage',
  },
})

const router = useRouter()

const { t } = useI18n()

interface Dept {
  id: number
  name: string
  user_count: number
}

const curPage = shallowRef(0)
const pageSize = shallowRef(10)

const { data, refetch } = useWeilaFetch<{
  count: number
  dept: Dept
}>(() => `corp/address/get-my-manage-dept-list?page=${curPage.value}&size=${pageSize.value}`)

const selfInfoStore = useSelfInfoStore()

function onSelect(dept: DeptModel, e: PointerEvent) {
  // @ts-expect-error type error
  if (!e.target?.className?.includes?.('arco-table')) {
    return void 0
  }

  router.push(`/contact/dept-${dept.id}-${dept.name}`)
}
</script>

<template>
  <a-page-header
    :show-back="false"
    :title="$t($route.meta.name || '')"
  >
    <a-card :header-style="selfInfoStore.isOwner ? {} : { display: 'none' }">
      <template #title>
        <a-space v-if="selfInfoStore.isOwner">
          <CreateDeptModal @success="refetch" />
        </a-space>
      </template>

      <!-- @vue-expect-error type error when arco's row-click -->
      <a-table
        :pagination="{
          pageSize: 10,
          total: data?.count || 0,
        }"
        :data="data?.depts" size="medium" :column-resizable="true" :scroll="{
          x: 1000,
          y: 600,
        }" :scrollbar="true" :columns="[{ title: t('name'), dataIndex: 'name' }]"
        @row-click="(...args) => onSelect(...args)"

        @page-change="(page) => curPage = page - 1"
      >
        <template #columns>
          <a-table-column :title="t('name')">
            <template #cell="{ record: { name } }">
              {{ name }}
            </template>
          </a-table-column>
          <a-table-column :title="t('user-count')">
            <template #cell="{ record: { user_count } }">
              {{ user_count || 0 }}
            </template>
          </a-table-column>
          <a-table-column :title="t('controls')">
            <template #cell="{ record }">
              <div v-if="record.id && selfInfoStore.isOwner" flex gap2>
                <EditDeptModal :dept="record" />
                <DeleteDeptModal :dept="record" />
              </div>
              <div v-else op0 h9 />
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </a-page-header>
</template>
