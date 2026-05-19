<script setup lang="ts">
import type { WL_IDbSession } from '@weilasdk/core'
import Message from '@arco-design/web-vue/es/message'
import { WlChatPanel } from '@weilasdk/ui'
import { computed, shallowRef, watch } from 'vue'
import '@weilasdk/ui/dist/index.css'

definePage({
  meta: {
    name: 'submenu.chat',
  },
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// ── SDK 初始化 ──
const weilaStore = useWeilaStore()
const { core: weilaCore, userInfo } = storeToRefs(weilaStore)

async function initSdk() {
  if (weilaCore.value && userInfo.value)
    return weilaCore.value

  const loggedIn = await weilaStore.autoLogin()
  return loggedIn ? weilaCore.value : null
}

// 页面挂载时自动初始化 SDK
onMounted(() => {
  void initSdk()
})

// ── 当前用户 ID ──
const currentUserId = computed(() => userInfo.value?.userId ?? 0)

function parseSessionType(value: unknown) {
  if (typeof value !== 'string')
    return undefined

  const sessionType = Number(value)
  return Number.isFinite(sessionType) ? sessionType : undefined
}

const selectedSessionId = shallowRef(typeof route.query.sessionId === 'string' ? route.query.sessionId : '')
const selectedSessionType = shallowRef<number | undefined>(parseSessionType(route.query.sessionType))
const chatPanelRef = shallowRef<InstanceType<typeof WlChatPanel>>()
const pendingDeleteSession = shallowRef<WL_IDbSession>()
const isDeleteSessionModalOpen = shallowRef(false)
const isDeletingSession = shallowRef(false)

const pendingDeleteSessionName = computed(() => {
  return pendingDeleteSession.value?.sessionName || pendingDeleteSession.value?.sessionId || ''
})

watch(
  () => route.query.sessionId,
  (sessionId) => {
    selectedSessionId.value = typeof sessionId === 'string' ? sessionId : ''
  },
)

watch(
  () => route.query.sessionType,
  (sessionType) => {
    selectedSessionType.value = parseSessionType(sessionType)
  },
)

async function ensureSelectedSession() {
  const core = weilaCore.value
  const sessionId = selectedSessionId.value
  const sessionType = selectedSessionType.value
  if (!core || !sessionId || sessionType === undefined)
    return

  if (core.weila_getSession(sessionId, sessionType))
    return

  await core.weila_startNewSession(sessionId, sessionType, {
    sessionName: typeof route.query.sessionName === 'string' ? route.query.sessionName : undefined,
    sessionAvatar: typeof route.query.sessionAvatar === 'string' ? route.query.sessionAvatar : undefined,
  })
}

watch([selectedSessionId, selectedSessionType], ([sessionId, sessionType]) => {
  if (route.query.sessionId === sessionId && parseSessionType(route.query.sessionType) === sessionType)
    return

  void router.replace({
    query: {
      ...route.query,
      sessionId: sessionId || undefined,
      sessionType: sessionId && sessionType !== undefined ? String(sessionType) : undefined,
    },
  })
})

watch([weilaCore, selectedSessionId, selectedSessionType], () => {
  void ensureSelectedSession()
}, { immediate: true })

function handleDeleteSessionRequest(session: WL_IDbSession) {
  pendingDeleteSession.value = session
  isDeleteSessionModalOpen.value = true
}

function handleCancelDeleteSession() {
  if (isDeletingSession.value)
    return

  isDeleteSessionModalOpen.value = false
  pendingDeleteSession.value = undefined
}

async function handleConfirmDeleteSession() {
  if (!pendingDeleteSession.value || isDeletingSession.value)
    return

  isDeletingSession.value = true

  try {
    const success = await chatPanelRef.value?.deleteSession(pendingDeleteSession.value)
    if (!success)
      return

    Message.success(t('chat.delete-session.success'))
    isDeleteSessionModalOpen.value = false
    pendingDeleteSession.value = undefined
  }
  finally {
    isDeletingSession.value = false
  }
}
</script>

<template>
  <div h-full>
    <div v-if="!weilaCore" class="flex items-center justify-center h-full text-neutral-400">
      {{ t('chat.sdk-loading') }}
    </div>
    <WlChatPanel
      v-else
      ref="chatPanelRef"
      v-model:selected-session-id="selectedSessionId"
      v-model:selected-session-type="selectedSessionType"
      :core="weilaCore"
      :current-user-id="currentUserId"
      message-list-height="calc(100vh - 220px)"
      @delete-session="handleDeleteSessionRequest"
    />
    <a-modal
      v-model:visible="isDeleteSessionModalOpen"
      :title="t('chat.delete-session.title')"
      :footer="false"
      :mask-closable="!isDeletingSession"
      :esc-to-close="!isDeletingSession"
      :closable="!isDeletingSession"
    >
      <div>{{ t('chat.delete-session.content', { name: pendingDeleteSessionName }) }}</div>
      <div mt6 flex justify-end gap3>
        <a-button :disabled="isDeletingSession" @click="handleCancelDeleteSession">
          {{ t('button.cancel') }}
        </a-button>
        <a-button status="danger" type="primary" :loading="isDeletingSession" @click="handleConfirmDeleteSession">
          {{ t('button.confirm') }}
        </a-button>
      </div>
    </a-modal>
  </div>
</template>
