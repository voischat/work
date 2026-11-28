<script setup lang="ts">
import type { DeptModel } from '~/api/contact'
import type { TableColumn } from '~/utils/tableModel'
import { computed, shallowRef } from 'vue'
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

const curPage = shallowRef(0)
const pageSize = shallowRef(10)

const { data, refetch } = useWeilaFetch<{
  count: number
  depts: DeptModel[]
}>(() => `corp/address/get-my-manage-dept-list?page=${curPage.value}&size=${pageSize.value}`)

const selfInfoStore = useSelfInfoStore()

const columns = computed<TableColumn<DeptModel>[]>(() => [
  {
    key: 'name',
    title: t('name'),
  },
  {
    key: 'user_count',
    title: t('user-count'),
  },
  {
    key: 'actions',
    title: t('controls'),
  },
])

function openDept(dept: DeptModel) {
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

      <DataTable
        v-model:page="curPage"
        :columns="columns"
        :data="data?.depts ?? []"
        :total="data?.count || 0"
        fixed-layout
        @row-click="openDept"
      >
        <template #cell-user_count="{ record }">
          {{ record.user_count || 0 }}
        </template>
        <template #cell-actions="{ record }">
          <div v-if="record.id && selfInfoStore.isOwner" flex gap2>
            <EditDeptModal :dept="record" />
            <DeleteDeptModal :dept="record" />
          </div>
          <div v-else op0 h9 />
        </template>
      </DataTable>
    </a-card>
  </a-page-header>
</template>
