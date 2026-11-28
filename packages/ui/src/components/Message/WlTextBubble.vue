<script setup lang="ts">
import { computed } from 'vue'
import type { WL_TextMsgData, WL_IDbUserInfo } from '@vois/weila-sdk-core'
import WLEmoji from '@/components/Emoji/WlEmoji.vue'
import { parseTextWithEmoji } from '@/utils'

export interface WlTextBubbleProps {
  msg: WL_TextMsgData
  isSelf?: boolean
  sender?: WL_IDbUserInfo
}

const props = withDefaults(defineProps<WlTextBubbleProps>(), {
  isSelf: false,
})

const parsedText = computed(() => parseTextWithEmoji(props.msg.textData))
</script>

<template>
  <div
    class="rounded-xl px-3 py-2 text-sm break-all whitespace-pre-wrap overflow-hidden"
    :class="isSelf ? 'bg-blue-500 text-white' : 'bg-white text-neutral-900'"
  >
    <span v-for="(token, index) in parsedText" :key="index">
      <WLEmoji v-if="token.type === 'emoji'" :name="token.value" :size="24" />
      <template v-else>{{ token.value }}</template>
    </span>
  </div>
</template>
