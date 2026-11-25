<script setup lang="ts">
import type { CardListDto, OrderListDto, RenewOrderRecordDto, RenewSummaryDto, SimCardDto, SimCardWindow } from '~/api/simcard'
import { Message } from '@arco-design/web-vue'
import { shallowRef } from 'vue'
import { SIMCARD_CARD_LIST_ENDPOINT, SIMCARD_ORDER_LIST_ENDPOINT, SIMCARD_RENEW_SUMMARY_ENDPOINT } from '~/api/simcard'
import RenewSimcardModal from '~/components/RenewSimcardModal.vue'
import { useSimcardRenewal } from '~/composables/useSimcardRenewal'
import { exportFileName, formatFen, isExpired, toCardExportRow, toOrderExportRow, toOrderRecord, toSimCard } from '~/utils/simcard'
import { exportXlsx } from '~/utils/simcardExport'

definePage({
  path: '/workbench/simcard/stats',
  name: '/workbench/simcard/stats',
  meta: {
    name: 'submenu.simcard',
    roles: [255],
  },
})

const { t } = useI18n()
const selfInfoStore = useSelfInfoStore()
const isOwner = computed(() => selfInfoStore.isOwner)

const activeTab = shallowRef<'stats' | 'orders'>('stats')
const activeWindow = shallowRef<SimCardWindow>()
const selectedKeys = shallowRef<string[]>([])
const today = new Date()

const { data: summary, refetch: refetchSummary } = useWeilaFetch<RenewSummaryDto>(
  SIMCARD_RENEW_SUMMARY_ENDPOINT,
  undefined,
  { enabled: isOwner },
)

const {
  data: cardListData,
  isPending: isCardsPending,
  refetch: refetchCards,
} = useWeilaFetch<CardListDto | SimCardDto[]>(
  SIMCARD_CARD_LIST_ENDPOINT,
  {
    body: () => ({ type: activeWindow.value }),
  },
  {
    enabled: computed(() => isOwner.value && activeWindow.value !== undefined),
    staleTime: Infinity,
  },
)

const {
  data: orderListData,
  isPending: isOrdersPending,
  refetch: refetchOrders,
} = useWeilaFetch<OrderListDto | RenewOrderRecordDto[]>(
  SIMCARD_ORDER_LIST_ENDPOINT,
  undefined,
  {
    enabled: computed(() => isOwner.value && activeTab.value === 'orders'),
    staleTime: Infinity,
  },
)

const cards = computed(() => {
  const data = cardListData.value
  if (!data)
    return []
  const list = Array.isArray(data)
    ? data
    : data.cards
  return list.map(toSimCard)
})

const orders = computed(() => {
  const data = orderListData.value
  if (!data)
    return []
  const list = Array.isArray(data)
    ? data
    : data.orders
  return list.map(toOrderRecord)
})

const { state: renewalState, start: startRenewal, reset: resetRenewal } = useSimcardRenewal()

function selectWindow(window: SimCardWindow) {
  activeWindow.value = window
  selectedKeys.value = []
}

function windowLabel(window: SimCardWindow) {
  return window === 'expiring_in_30d'
    ? t('simcard.stats.expiring-in-30d')
    : t('simcard.stats.renewable')
}

function orderStatusLabels() {
  return {
    paid: t('simcard.orders.paid'),
    unpaid: t('simcard.orders.unpaid'),
    charged: t('simcard.orders.charged'),
    uncharged: t('simcard.orders.uncharged'),
  }
}

async function refreshCards() {
  await Promise.all([
    refetchSummary(),
    refetchCards(),
  ])
  Message.success(t('message.success'))
}

async function refreshOrders() {
  await refetchOrders()
  Message.success(t('message.success'))
}

async function exportSelectedCards() {
  if (!activeWindow.value || selectedKeys.value.length === 0)
    return

  const selected = cards.value.filter(card => selectedKeys.value.includes(card.iccid))

  try {
    await exportXlsx(
      exportFileName(`${t('simcard.export.card-file')}-${windowLabel(activeWindow.value)}`, new Date()),
      t('simcard.tabs.stats'),
      [
        t('simcard.card.iccid'),
        t('simcard.card.expiry-date'),
        t('simcard.card.model'),
        t('simcard.card.imei'),
        t('simcard.card.user-num'),
        t('simcard.card.user-nick'),
      ],
      [24, 14, 14, 24, 16, 16],
      selected.map(toCardExportRow),
    )
  }
  catch {
    Message.error(t('simcard.export.failed'))
  }
}

async function exportOrders() {
  try {
    await exportXlsx(
      exportFileName(t('simcard.export.order-file'), new Date()),
      t('simcard.tabs.orders'),
      [
        t('simcard.orders.order-no'),
        t('simcard.orders.iccid'),
        t('simcard.orders.amount-yuan'),
        t('simcard.orders.pay-status'),
        t('simcard.orders.charge-status'),
        t('simcard.orders.order-desc'),
        t('simcard.orders.created'),
      ],
      [26, 24, 12, 12, 12, 24, 22],
      orders.value.map(order => toOrderExportRow(order, orderStatusLabels())),
    )
  }
  catch {
    Message.error(t('simcard.export.failed'))
  }
}
</script>

<template>
  <a-page-header
    :show-back="false"
    :title="$t($route.meta.name || '')"
  >
    <a-card>
      <a-result
        v-if="!selfInfoStore.isOwner"
        status="403"
        :subtitle="t('simcard.no-permission')"
      />

      <a-tabs v-else v-model:active-key="activeTab">
        <a-tab-pane key="stats" :title="t('simcard.tabs.stats')">
          <div grid grid-cols-2 gap4>
            <a-card
              hoverable
              cursor-pointer
              :class="activeWindow === 'expiring_in_30d' ? 'border-blue-5' : ''"
              @click="selectWindow('expiring_in_30d')"
            >
              <div text-neutral-500>
                {{ t('simcard.stats.expiring-in-30d') }}
              </div>
              <div text-3xl font-semibold>
                {{ summary?.expiring_in_30d ?? '-' }}
              </div>
              <div text-xs text-neutral-400>
                {{ t('simcard.stats.expiring-in-30d-hint') }}
              </div>
            </a-card>

            <a-card
              hoverable
              cursor-pointer
              :class="activeWindow === 'renewable' ? 'border-blue-5' : ''"
              @click="selectWindow('renewable')"
            >
              <div text-neutral-500>
                {{ t('simcard.stats.renewable') }}
              </div>
              <div text-3xl font-semibold>
                {{ summary?.renewable ?? '-' }}
              </div>
              <div text-xs text-neutral-400>
                {{ t('simcard.stats.renewable-hint') }}
              </div>
            </a-card>
          </div>

          <div v-if="!activeWindow" mt6 text-center text-neutral-400>
            {{ t('simcard.stats.select-window-hint') }}
          </div>

          <div v-else mt4>
            <div mb3 flex items-center gap2>
              <span text-neutral-500>
                {{ t('simcard.card.selected-total', { selected: selectedKeys.length, total: cards.length }) }}
              </span>
              <a-button :disabled="selectedKeys.length === 0" @click="exportSelectedCards">
                {{ t('simcard.card.export-selected') }}
              </a-button>
              <a-button @click="refreshCards">
                {{ t('button.refresh') }}
              </a-button>
            </div>

            <a-table
              v-model:selected-keys="selectedKeys"
              :data="cards"
              row-key="iccid"
              :row-selection="{ type: 'checkbox', showCheckedAll: true }"
              :loading="isCardsPending"
              :pagination="{ pageSize: 20, total: cards.length }"
            >
              <template #columns>
                <a-table-column :title="t('simcard.card.iccid')">
                  <template #cell="{ record: { iccid } }">
                    {{ iccid }}
                  </template>
                </a-table-column>
                <a-table-column :title="t('simcard.card.expiry-date')">
                  <template #cell="{ record: { expiryDate } }">
                    <div flex items-center gap2>
                      <span>{{ expiryDate }}</span>
                      <a-tag v-if="isExpired(expiryDate, today)" color="red">
                        {{ t('simcard.card.expired') }}
                      </a-tag>
                    </div>
                  </template>
                </a-table-column>
                <a-table-column :title="t('simcard.card.model')">
                  <template #cell="{ record: { product } }">
                    {{ product }}
                  </template>
                </a-table-column>
                <a-table-column :title="t('simcard.card.imei')">
                  <template #cell="{ record: { imei } }">
                    {{ imei }}
                  </template>
                </a-table-column>
                <a-table-column :title="t('simcard.card.user-num')">
                  <template #cell="{ record: { userNum } }">
                    {{ userNum }}
                  </template>
                </a-table-column>
                <a-table-column :title="t('simcard.card.user-nick')">
                  <template #cell="{ record: { userNick } }">
                    {{ userNick }}
                  </template>
                </a-table-column>
                <a-table-column :title="t('controls')">
                  <template #cell="{ record }">
                    <a-button size="small" @click="startRenewal(record)">
                      {{ t('simcard.renew.action') }}
                    </a-button>
                  </template>
                </a-table-column>
              </template>
              <template #empty>
                <a-empty :description="t('simcard.card.empty')" />
              </template>
            </a-table>
          </div>
        </a-tab-pane>

        <a-tab-pane key="orders" :title="t('simcard.tabs.orders')">
          <div mb3 flex items-center gap2>
            <a-button :disabled="orders.length === 0" @click="exportOrders">
              {{ t('simcard.orders.export') }}
            </a-button>
            <a-button @click="refreshOrders">
              {{ t('button.refresh') }}
            </a-button>
          </div>

          <a-table
            :data="orders"
            row-key="orderNo"
            :loading="isOrdersPending"
            :pagination="false"
          >
            <template #columns>
              <a-table-column :title="t('simcard.orders.order-no')">
                <template #cell="{ record: { orderNo } }">
                  {{ orderNo }}
                </template>
              </a-table-column>
              <a-table-column :title="t('simcard.orders.iccid')">
                <template #cell="{ record: { iccid } }">
                  {{ iccid }}
                </template>
              </a-table-column>
              <a-table-column :title="t('simcard.orders.amount')">
                <template #cell="{ record: { amount } }">
                  {{ formatFen(amount) }}
                </template>
              </a-table-column>
              <a-table-column :title="t('simcard.orders.pay-status')">
                <template #cell="{ record: { status } }">
                  <a-tag :color="status === 1 ? 'green' : 'gray'">
                    {{ status === 1 ? t('simcard.orders.paid') : t('simcard.orders.unpaid') }}
                  </a-tag>
                </template>
              </a-table-column>
              <a-table-column :title="t('simcard.orders.charge-status')">
                <template #cell="{ record: { chargeStatus } }">
                  <a-tag :color="chargeStatus === 1 ? 'green' : 'gray'">
                    {{ chargeStatus === 1 ? t('simcard.orders.charged') : t('simcard.orders.uncharged') }}
                  </a-tag>
                </template>
              </a-table-column>
              <a-table-column :title="t('simcard.orders.order-desc')">
                <template #cell="{ record: { orderDesc } }">
                  {{ orderDesc }}
                </template>
              </a-table-column>
              <a-table-column :title="t('simcard.orders.created')">
                <template #cell="{ record: { created } }">
                  {{ created }}
                </template>
              </a-table-column>
            </template>
            <template #empty>
              <a-empty :description="t('simcard.orders.empty')" />
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <RenewSimcardModal :state="renewalState" @close="resetRenewal" />
  </a-page-header>
</template>
