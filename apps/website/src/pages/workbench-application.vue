<script setup lang="ts">
import type { AppItem, AppListResponse } from '~/api/application'
import Message from '@arco-design/web-vue/es/message'

import { useClipboard } from '@vueuse/core'
import { ref as deepRef, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useWeilaMutation } from '~/composables/useWeilaMutation'
import { useSelfInfoStore } from '~/stores/selfInfo'
import CreateApplicationModal from './components/CreateApplicationModal.vue'

definePage({
  path: '/workbench/application',
  name: '/workbench/application',
  meta: {
    name: 'submenu.application',
    roles: [255],
    vip: 'api',
  },
})

const { t } = useI18n()
const selfInfoStore = useSelfInfoStore()

const curPage = shallowRef(0)
const pageSize = shallowRef(10)

const { data, refetch } = useWeilaFetch<AppListResponse>(() => `corp/api/manage/get-app-list?page=${curPage.value}&size=${pageSize.value}`)

const revealedAppId = shallowRef<string>()
const { copy } = useClipboard()

function toggleKey(app: AppItem) {
  revealedAppId.value = revealedAppId.value === app.app_id
    ? undefined
    : app.app_id
}

function maskedKey(key: string) {
  return key.length <= 8
    ? '••••••••'
    : `${key.slice(0, 4)}••••${key.slice(-4)}`
}

async function copyKey(key: string) {
  if (!key)
    return
  await copy(key)
  Message.success(t('button.copied'))
}

const selectedForDelete = deepRef<AppItem>()
const isDeleteModalOpen = shallowRef(false)

const { mutate: deleteApp, isPending: isDeletePending } = useWeilaMutation<unknown, { appid: string }>('corp/api/manage/delete-app', {
  onSuccess() {
    isDeleteModalOpen.value = false
    Message.success(t('message.success'))
    if ((data.value?.apps?.length ?? 0) === 1 && curPage.value > 0)
      curPage.value--
    refetch()
  },
})

function confirmDelete() {
  if (!selectedForDelete.value)
    return
  deleteApp({ appid: selectedForDelete.value.app_id })
}
</script>

<template>
  <a-page-header
    :show-back="false"
    :title="$t($route.meta.name || '')"
  >
    <a-card>
      <template #title>
        <CreateApplicationModal v-if="selfInfoStore.isOwner" @success="refetch" />
      </template>
      <template #extra>
        <a-link
          v-if="selfInfoStore.isOwner"
          href="https://www.voiswork.cn/common/corp-api/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('application.api-docs') }}
        </a-link>
      </template>

      <a-result
        v-if="!selfInfoStore.isOwner"
        status="403"
        :subtitle="t('application.no-permission')"
      />
      <a-table
        v-else
        :data="data?.apps"
        row-key="app_id"
        :pagination="{
          current: curPage + 1,
          pageSize,
          total: data?.count ?? 0,
        }"
        @page-change="(page: number) => curPage = page - 1"
      >
        <template #columns>
          <a-table-column :title="t('name')">
            <template #cell="{ record: { name } }">
              {{ name }}
            </template>
          </a-table-column>
          <a-table-column :title="t('application.app-id')">
            <template #cell="{ record: { app_id } }">
              {{ app_id }}
            </template>
          </a-table-column>
          <a-table-column :title="t('application.app-key')" :width="360">
            <template #cell="{ record }">
              <div flex items-center gap2>
                <span font-mono block w-56 break-all>
                  {{ revealedAppId === record.app_id ? record.app_key : maskedKey(record.app_key) }}
                </span>
                <a-button size="mini" @click="toggleKey(record)">
                  <template #icon>
                    <i :class="revealedAppId === record.app_id ? 'i-carbon-view-off' : 'i-carbon-view'" />
                  </template>
                </a-button>
                <a-button size="mini" :disabled="!record.app_key" @click="copyKey(record.app_key)">
                  {{ t('button.copy') }}
                </a-button>
              </div>
            </template>
          </a-table-column>
          <a-table-column :title="t('created')">
            <template #cell="{ record: { created } }">
              {{ new Date(created * 1000).toLocaleDateString() }}
            </template>
          </a-table-column>
          <a-table-column :title="t('controls')">
            <template #cell="{ record }">
              <a-button @click="selectedForDelete = record; isDeleteModalOpen = true">
                {{ t('button.delete') }}
              </a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>

      <a-modal v-model:visible="isDeleteModalOpen" :title="t('button.delete')">
        <p>{{ t('delete.modal.hint') }} {{ t('delete.modal.content') }}</p>
        <template #footer>
          <a-button type="primary" :loading="isDeletePending" @click="confirmDelete">
            {{ t('button.submit') }}
          </a-button>
        </template>
      </a-modal>
    </a-card>
  </a-page-header>
</template>
