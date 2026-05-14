<script setup lang="ts">
import type { WL_ExtEventCallback, WL_IDbMsgData, WL_IDbSession } from '@weilasdk/core'
import { WL_ExtEventID } from '@weilasdk/core'
import { SessionList, useSessions, WlMsgList } from '@weilasdk/ui'
import { computed, shallowRef, toRaw, watch } from 'vue'
import '@weilasdk/ui/dist/index.css'

definePage({
  meta: {
    name: 'submenu.chat',
  },
})

const { t } = useI18n()

// ── SDK 初始化 ──
const { core: weilaCore, userInfo, init: initSdk } = useWeilaCore()

// 页面挂载时自动初始化 SDK
onMounted(() => {
  void initSdk()
})

// ── 会话列表 ──
const sessionState = useSessions(() => weilaCore.value)

const selectedSession = shallowRef<WL_IDbSession>()

// ── 消息历史 ──
const { messages, senderInfos, hasMore, loading: messagesLoading, loadMore } = useMessageHistory(weilaCore, selectedSession)

// ── 当前用户 ID ──
const currentUserId = computed(() => userInfo.value?.userId ?? 0)

// ── 音频播放状态 ──
const playingAudioId = shallowRef<string | null>(null)

async function handleAudioPlay(msg: WL_IDbMsgData) {
  if (!weilaCore.value)
    return
  await weilaCore.value.weila_stopSingle()
  const plainMsg = toRaw(msg)
  await weilaCore.value.weila_playSingle(plainMsg)
  playingAudioId.value = msg.combo_id
}

function handleAudioPause() {
  playingAudioId.value = null
  weilaCore.value?.weila_stopSingle()
}

// ── 实时消息监听 ──
const handleMessageEvent: WL_ExtEventCallback = (eventId, eventData) => {
  if (
    eventId !== WL_ExtEventID.WL_EXT_NEW_MSG_RECV_IND
    && eventId !== WL_ExtEventID.WL_EXT_MSG_SEND_IND
  ) {
    return
  }

  const msgData = eventData as WL_IDbMsgData
  const session = selectedSession.value
  if (
    !session
    || msgData.sessionId !== session.sessionId
    || msgData.sessionType !== session.sessionType
  ) {
    return
  }

  // 去重
  if (messages.value.some((m: WL_IDbMsgData) => m.combo_id === msgData.combo_id))
    return

  messages.value = [...messages.value, msgData]
}

watch(
  weilaCore,
  (core, _oldCore, onCleanup) => {
    if (!core)
      return
    core.weila_onEvent(handleMessageEvent)
    onCleanup(() => core.weila_offEvent(handleMessageEvent))
  },
  { immediate: true },
)

// ── 发送文本消息 ──
const inputText = shallowRef('')

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || !weilaCore.value || !selectedSession.value)
    return

  inputText.value = ''

  try {
    await weilaCore.value.weila_sendTextMsg(
      selectedSession.value.sessionId,
      selectedSession.value.sessionType,
      text,
    )
  }
  catch (err) {
    console.error('[Chat] Failed to send message:', err)
  }
}
</script>

<template>
  <div flex h-full>
    <!-- Session list sidebar -->
    <aside class="w-60 shrink-0 border-r border-gray-200">
      <div v-if="!weilaCore" class="flex items-center justify-center h-full text-neutral-400">
        {{ t('chat.sdk-loading') }}
      </div>
      <SessionList
        v-else
        :sessions="sessionState.sessions"
        :loading="sessionState.loading"
        :error="sessionState.error"
        @select="s => selectedSession = s"
        @refresh="sessionState.refresh"
      />
    </aside>

    <!-- Chat area -->
    <div flex-1 flex flex-col min-w-0>
      <WlMsgList
        v-if="selectedSession"
        :messages="messages"
        :current-user-id="currentUserId"
        :sender-infos="senderInfos"
        :has-more="hasMore"
        :loading="messagesLoading"
        :playing-audio-id="playingAudioId"
        class="flex-1"
        @audio-play="handleAudioPlay"
        @audio-pause="handleAudioPause"
        @load-more="loadMore(messages[0]?.msgId - 1)"
      />
      <div v-else class="flex-1 flex items-center justify-center text-neutral-400">
        {{ t('chat.select-session') }}
      </div>

      <!-- Input bar -->
      <div flex items-center gap-2 border-t border-gray-200 px-4 py-3 bg-white>
        <input
          v-model="inputText"
          flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none
          :placeholder="t('chat.placeholder')"
          @keydown.enter="handleSend"
        >
        <a-button type="primary" :disabled="!inputText.trim() || !selectedSession" @click="handleSend">
          {{ t('button.send') }}
        </a-button>
      </div>
    </div>
  </div>
</template>
