<script setup lang="ts">
import type { WL_IDbMsgData, WL_IDbUserInfo } from '@vois/weila-sdk-core'
import { WL_IDbMsgDataStatus } from '@vois/weila-sdk-core'
import { useWeilaUiI18n } from '../../i18n'

export interface WlUnknownBubbleProps {
  msg: WL_IDbMsgData
  isSelf?: boolean
  sender?: WL_IDbUserInfo
}

const props = withDefaults(defineProps<WlUnknownBubbleProps>(), {
  isSelf: false,
})

const { t } = useWeilaUiI18n()
</script>

<template>
  <div
    class="rounded-xl px-3 py-2 text-sm overflow-hidden break-all"
    :class="isSelf ? 'bg-blue-500 text-blue-100' : 'bg-white text-neutral-400'"
  >
    <div v-if="msg.status === WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_WITHDRAW" class="italic">
      {{ isSelf ? t('message.withdrawnByMe') : t('message.withdrawnByOther') }}
    </div>
    <div v-else>{{ t('message.unsupported') }}</div>
  </div>
</template>
