<script setup lang="ts">
import type { RenewalState } from '~/composables/useSimcardRenewal'
import { formatFen } from '~/utils/simcard'

defineProps<{
  state: RenewalState
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
</script>

<template>
  <a-modal
    :visible="state.kind !== 'idle'"
    :title="t('simcard.renew.title')"
    :mask-closable="state.kind !== 'creating'"
    :closable="state.kind !== 'creating'"
    :esc-to-close="state.kind !== 'creating'"
    @cancel="emit('close')"
  >
    <div v-if="state.kind === 'creating'" flex items-center gap3>
      <a-spin />
      <div>
        <div>{{ t('simcard.renew.creating') }}</div>
        <div text-neutral-500>
          {{ state.card.iccid }}
        </div>
      </div>
    </div>

    <template v-else-if="state.kind === 'created'">
      <a-descriptions
        :column="1"
        bordered
        :data="[
          { label: t('simcard.renew.product-name'), value: state.order.productName },
          { label: t('simcard.renew.product-desc'), value: state.order.productDesc },
          { label: t('simcard.renew.amount'), value: `${formatFen(state.order.amount)} ${state.order.currency}` },
          { label: t('simcard.renew.order-no'), value: state.order.orderNo },
        ]"
      />
      <a-alert mt4 type="warning">
        {{ t('simcard.renew.notice') }}
      </a-alert>
    </template>

    <template v-else-if="state.kind === 'failed'">
      <a-alert type="error">
        {{ state.message || t('simcard.renew.failed') }}
      </a-alert>
    </template>

    <template #footer>
      <a-button :disabled="state.kind === 'creating'" @click="emit('close')">
        {{ state.kind === 'creating' ? t('button.cancel') : t('simcard.renew.close') }}
      </a-button>
    </template>
  </a-modal>
</template>
