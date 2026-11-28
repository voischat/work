import { shallowRef, watch } from 'vue'
import type {
  WeilaCore,
  WL_ExtEventCallback,
  WL_IDbMsgData,
  WL_IDbSession,
  WL_IDbUserInfo,
} from '@vois/weila-sdk-core'
import {
  WL_ExtEventID,
  WL_IDbMsgDataStatus,
  WL_IDbMsgDataType,
  isGroupSessionType,
} from '@vois/weila-sdk-core'

const PAGE_SIZE = 20
const MAX_MESSAGES = 300

type MessageHistoryCore = Pick<
  WeilaCore,
  | 'weila_getGroupMembers'
  | 'weila_getMsgDatas'
  | 'weila_getUserInfo'
  | 'weila_offEvent'
  | 'weila_onEvent'
>

function isMsgData(value: unknown): value is WL_IDbMsgData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sessionId' in value &&
    'sessionType' in value &&
    'msgId' in value &&
    'msgType' in value
  )
}

interface UseMessageHistoryOptions {
  shouldAppendMessage?: (message: WL_IDbMsgData) => boolean
}

function mergeMessage(existing: WL_IDbMsgData, next: WL_IDbMsgData): WL_IDbMsgData {
  const audioMsg =
    next.msgType === WL_IDbMsgDataType.WL_DB_MSG_DATA_AUDIO_TYPE
      ? next
      : existing.msgType === WL_IDbMsgDataType.WL_DB_MSG_DATA_AUDIO_TYPE
        ? existing
        : undefined

  if (!audioMsg) {
    if (
      existing.msgType === WL_IDbMsgDataType.WL_DB_MSG_DATA_PTT_TYPE &&
      next.msgType === WL_IDbMsgDataType.WL_DB_MSG_DATA_PTT_TYPE
    ) {
      return { ...existing, ...next, pttData: { ...existing.pttData, ...next.pttData } }
    }

    return next
  }

  const other = audioMsg === next ? existing : next

  return { ...other, ...audioMsg, pttData: undefined }
}

function getMessageIdentity(msg: WL_IDbMsgData): string {
  if (msg.msgId > 0) {
    return `${msg.sessionId}_${msg.sessionType}_${msg.msgId}`
  }

  return msg.combo_id || `${msg.sessionId}_${msg.sessionType}_${msg.msgId}`
}

function dedupeMessages(nextMessages: WL_IDbMsgData[]): WL_IDbMsgData[] {
  const byId = new Map<string, WL_IDbMsgData>()

  for (const msg of nextMessages) {
    const id = getMessageIdentity(msg)
    const existing = byId.get(id)
    byId.set(id, existing ? mergeMessage(existing, msg) : msg)
  }

  return [...byId.values()]
}

function retainNewest(messages: WL_IDbMsgData[]): WL_IDbMsgData[] {
  return messages.length > MAX_MESSAGES ? messages.slice(messages.length - MAX_MESSAGES) : messages
}

function retainOldest(messages: WL_IDbMsgData[]): WL_IDbMsgData[] {
  return messages.length > MAX_MESSAGES ? messages.slice(0, MAX_MESSAGES) : messages
}

export function useMessageHistory(
  getCore: () => MessageHistoryCore | null,
  getSession: () => WL_IDbSession | undefined,
  options: UseMessageHistoryOptions = {},
) {
  const messages = shallowRef<WL_IDbMsgData[]>([])
  const senderInfos = shallowRef<Map<number, WL_IDbUserInfo>>(new Map())
  const hasMore = shallowRef(false)
  const loading = shallowRef(false)
  const error = shallowRef<Error | null>(null)

  function reset() {
    messages.value = []
    senderInfos.value = new Map()
    hasMore.value = false
    loading.value = false
    error.value = null
  }

  async function ensureSenderInfo(senderId: number) {
    const core = getCore()
    if (senderInfos.value.has(senderId) || !core) return

    let info = await core.weila_getUserInfo(senderId)
    const session = getSession()
    if (!info && session && isGroupSessionType(session.sessionType)) {
      const groupMembers = await core.weila_getGroupMembers(session.sessionId)
      info = groupMembers.find((member) => member.memberInfo.userId === senderId)?.userInfo
    }

    if (!info) return

    const updated = new Map(senderInfos.value)
    updated.set(senderId, info)
    senderInfos.value = updated
  }

  async function ensureSenderInfos(nextMessages: WL_IDbMsgData[]) {
    const senderIds = [...new Set(nextMessages.map((m) => m.senderId))]
    await Promise.all(senderIds.map(ensureSenderInfo))
  }

  function isCurrentSessionMessage(msg: WL_IDbMsgData) {
    const session = getSession()
    return Boolean(
      session && msg.sessionId === session.sessionId && msg.sessionType === session.sessionType,
    )
  }

  function applyWithdrawState(msg: WL_IDbMsgData): boolean {
    if (msg.msgType !== WL_IDbMsgDataType.WL_DB_MSG_DATA_WITHDRAW_TYPE || !msg.withdrawMsgId) {
      return false
    }

    const targetIdentity = `${msg.sessionId}_${msg.sessionType}_${msg.withdrawMsgId}`
    const targetIdx = messages.value.findIndex((m) => getMessageIdentity(m) === targetIdentity)
    if (targetIdx === -1) return false

    const target = messages.value[targetIdx]
    if (target.status === WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_WITHDRAW) return true

    messages.value = [
      ...messages.value.slice(0, targetIdx),
      { ...target, status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_WITHDRAW },
      ...messages.value.slice(targetIdx + 1),
    ]
    return true
  }

  async function appendRealtimeMessage(msg: WL_IDbMsgData) {
    if (!isCurrentSessionMessage(msg)) return

    if (applyWithdrawState(msg)) return

    const msgIdentity = getMessageIdentity(msg)
    const existingIdx = messages.value.findIndex((m) => getMessageIdentity(m) === msgIdentity)
    if (existingIdx !== -1) {
      const existing = messages.value[existingIdx]
      const updated = mergeMessage(existing, msg)
      messages.value = [
        ...messages.value.slice(0, existingIdx),
        updated,
        ...messages.value.slice(existingIdx + 1),
      ]
      await ensureSenderInfo(msg.senderId)
      return
    }

    messages.value = retainNewest([...messages.value, msg])
    await ensureSenderInfo(msg.senderId)
  }

  async function loadMore(cursorMsgId?: number) {
    const core = getCore()
    const session = getSession()
    if (!core || !session || loading.value) return

    const cursor = cursorMsgId ?? (messages.value[0]?.msgId ? messages.value[0].msgId - 1 : 0)

    loading.value = true
    error.value = null

    try {
      const result = await core.weila_getMsgDatas(
        session.sessionId,
        session.sessionType,
        cursor,
        PAGE_SIZE,
      )

      const visibleResult: WL_IDbMsgData[] = []
      for (const msg of result) {
        if (msg.msgType === WL_IDbMsgDataType.WL_DB_MSG_DATA_WITHDRAW_TYPE) {
          applyWithdrawState(msg)
          continue
        }
        visibleResult.push(msg)
      }

      hasMore.value = result.length === PAGE_SIZE

      const dedupedResult = dedupeMessages(visibleResult)

      if (cursor === 0) {
        messages.value = dedupedResult
      } else {
        const existingIds = new Set(messages.value.map(getMessageIdentity))
        messages.value = retainOldest(
          dedupeMessages([
            ...dedupedResult.filter((m) => !existingIds.has(getMessageIdentity(m))),
            ...messages.value,
          ]),
        )
      }

      await ensureSenderInfos(dedupedResult)
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  const handleEvent: WL_ExtEventCallback = (eventId, eventData) => {
    if (
      eventId !== WL_ExtEventID.WL_EXT_NEW_MSG_RECV_IND &&
      eventId !== WL_ExtEventID.WL_EXT_MSG_SEND_IND &&
      eventId !== WL_ExtEventID.WL_EXT_MSG_AUDIO_READY_IND
    ) {
      return
    }

    if (!isMsgData(eventData)) return

    const msg = eventData
    if (options.shouldAppendMessage?.(msg) === false) return

    void appendRealtimeMessage(msg)
  }

  watch(
    getCore,
    (core, _oldCore, onCleanup) => {
      if (!core) return

      core.weila_onEvent(handleEvent)
      onCleanup(() => core.weila_offEvent(handleEvent))
      if (getSession()) void loadMore(0)
    },
    { immediate: true },
  )

  watch(
    () => {
      const session = getSession()
      return session ? `${session.sessionId}_${session.sessionType}` : ''
    },
    (sessionKey) => {
      reset()
      if (sessionKey) void loadMore(0)
    },
    { immediate: true },
  )

  return {
    messages,
    senderInfos,
    hasMore,
    loading,
    error,
    ensureSenderInfo,
    loadMore,
    reset,
  }
}
