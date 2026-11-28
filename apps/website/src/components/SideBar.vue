<script setup lang="ts">
import type { RouteRecordNormalized } from 'vue-router'
import type { VipInfo } from '~/stores/auth'
import type { Corp } from '~/types'
import { objectEntries, objectKeys } from '@antfu/utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useSelfInfoStore } from '~/stores/selfInfo'
import { $inspect } from '~/utils/inspect'
import { isPathVipGated } from '~/utils/vipGate'

const router = useRouter()

const { data: vip } = useWeilaFetch<VipInfo>('corp/org/get-vip-membership')

const { t } = useI18n()

const limitLabels = {
  member_limit: 'corp.member-limit',
  dept_limit: 'corp.dept-limit',
  dept_member_limit: 'corp.dept-member-limit',
  group_limit: 'corp.group-limit',
  group_member_limit: 'corp.group-member-limit',
}

const { data: corp } = useWeilaFetch<Corp>('corp/org/get-my-org')

const selfInfoStore = useSelfInfoStore()
const selfInfoType = computed(() => selfInfoStore.selfInfo?.type)

interface Menu {
  [key: string]: {
    name: string
    submenu: RouteRecordNormalized[]
  }
}

const menu = computed<Menu>(() => {
  const data: Menu = {
    contact: {
      name: t('menu.contact'),
      submenu: [],
    },
    workbench: {
      name: t('menu.workbench'),
      submenu: [],
    },
  }
  const routeList = router.getRoutes().filter((i: any) => i?.meta?.name)

  const routeRootRE = /^\/([\w-]+)(\/[\w-]+)*\/?$/

  for (const route of routeList) {
    const matches = route.path.match(routeRootRE)
    if (!matches)
      continue

    const rootKey = matches[1] as keyof Menu
    if (!rootKey)
      continue

    const menuItem = data?.[rootKey]
    if (!menuItem)
      continue

    if (!route?.meta?.roles
      || selfInfoType.value === undefined
      || (route?.meta?.roles && route?.meta?.roles?.includes(selfInfoType.value))) {
      menuItem.submenu.push(route)
    }
  }

  return data
})

const curPath = computed(() => patchPatch(router.currentRoute.value.path))

function patchPatch(path: string) {
  for (const [_, { submenu }] of objectEntries(menu.value)) {
    const matched = submenu.find(i => path.includes(i.path))
    if (matched)
      return matched.path
  }

  return path
}

$inspect(curPath)

function goTo(path: string) {
  router.push(path)
}
</script>

<template>
  <div h-full>
    <a-menu
      :selected-keys="[curPath]"
      :style="{ width: '200px', height: '100%' }"
      auto-open
      @menu-item-click="goTo"
    >
      <a-trigger v-if="corp" position="bl" auto-fit-position :unmount-on-close="true" :popup-translate="[5, 5]" trigger="hover">
        <div cursor-pointer text-neutral-500 px4 py2 hover:bg-neutral-200:50 rounded border mb4 mt2 flex items-center justify-between @click="goTo('/contact/org')">
          <div flex gap-2 items-center>
            <a-image width="40" height="40" :src="corp.avatar" rounded-full size-10 />
            <div>
              <div font-bold truncate>
                {{ corp.name }}
              </div>
              <CertificationTag v-if="selfInfoStore.isOwner" />
            </div>
          </div>
          <IconRight />
        </div>
        <template #content>
          <div bg-white border p4 rounded-lg space-y-4>
            <a-descriptions
              :column="1"
              :data="[
                { label: t('corp.number'), value: String(corp?.num ?? '') },
              ]"
              bordered
            />

            <a-descriptions
              v-if="vip?.level"
              :column="1"
              :data="[
                { label: t('vip.level'), value: vip?.name },
                { label: t('vip.enable.time'), value: new Date(vip?.created * 1000).toLocaleDateString() },
                { label: t('vip.expired.time'), value: new Date(vip?.expired * 1000).toLocaleDateString() },
              ].filter(i => i && i.value)"
              bordered
            />
            <a-descriptions
              :column="1"
              :data="objectKeys(limitLabels).map((limit) => {
                return {
                  label: t(limitLabels[limit]),
                  value: String(vip?.[limit] ?? ''),
                }
              }).filter(i => i.value)" bordered
            />
          </div>
        </template>
      </a-trigger>
      <a-menu-item key="/contact/org">
        {{ $t('home') }}
      </a-menu-item>
      <a-sub-menu v-for="{ name, submenu } in menu" :key="name">
        <template #title>
          {{ name }}
        </template>
        <a-menu-item
          v-for="i in submenu" :key="i.path"
          v-tips="() => isPathVipGated(i.path, vip, i.meta?.vip) ? t('tooltips.vip-unsupported') : ''"
          :disabled="isPathVipGated(i.path, vip, i.meta?.vip)"
        >
          {{ $t(i.meta.name || '') }}
        </a-menu-item>
      </a-sub-menu>
    </a-menu>
  </div>
</template>
