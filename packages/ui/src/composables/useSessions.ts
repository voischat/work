import { computed, reactive, ref, watch } from 'vue'
import type { WeilaCore } from '@vois/weila-sdk-core'
import type { WL_IDbSession, WL_ExtEventCallback } from '@vois/weila-sdk-core'
import {
  WL_DataPrepareState,
  WL_ExtEventID,
  WL_IDbMsgDataType,
  isGroupSessionType,
  isIndividualSessionType,
} from '@vois/weila-sdk-core'

const BACKGROUND_REFRESH_DEBOUNCE_MS = 200
const PROFILE_REFRESH_INTERVAL_MS = 60_000

interface BatchSessionProfileResult {
  sessionName?: string
  sessionAvatar?: string
  memberCount?: number
  invalid?: boolean
}

export type BatchSessionProfileResolver = (
  sessions: WL_IDbSession[],
) => Promise<Map<string, BatchSessionProfileResult>>

function isEventRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPrepareState(value: Record<string, unknown>, expected: WL_DataPrepareState): boolean {
  return value.state === expected
}

function isRealtimePttData(data: unknown) {
  if (!isEventRecord(data)) return false

  const lastMsgData = data.lastMsgData
  const msg = isEventRecord(lastMsgData) ? lastMsgData : data

  return (
    msg.msgType === WL_IDbMsgDataType.WL_DB_MSG_DATA_PTT_TYPE ||
    (msg.msgType === WL_IDbMsgDataType.WL_DB_MSG_DATA_AUDIO_TYPE && Boolean(msg.pttData))
  )
}

export function useSessions(
  getCore: () => WeilaCore | null,
  batchResolveProfiles?: BatchSessionProfileResolver,
) {
  const sessions = ref<WL_IDbSession[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const invalidSessionKeys = reactive(new Set<string>())
  let backgroundRefreshTimer: ReturnType<typeof setTimeout> | null = null
  let fetchPromise: Promise<void> | null = null
  let lastProfileSyncAt = 0
  let lastProfileKeys = ''

  const sortedSessions = computed(() => {
    return sessions.value.toSorted((a, b) => {
      const aTime = a.latestUpdate || 0
      const bTime = b.latestUpdate || 0
      return bTime - aTime
    })
  })

  const personalSessions = computed(() =>
    sortedSessions.value.filter((s) => isIndividualSessionType(s.sessionType)),
  )

  const groupSessions = computed(() =>
    sortedSessions.value.filter((s) => isGroupSessionType(s.sessionType)),
  )

  async function applyBatchProfiles(core: WeilaCore, fetchedSessions: WL_IDbSession[]) {
    if (!batchResolveProfiles || fetchedSessions.length === 0) return

    const keys = fetchedSessions
      .map((session) => `${session.sessionId}_${session.sessionType}`)
      .toSorted()
      .join(',')

    if (keys === lastProfileKeys && Date.now() - lastProfileSyncAt < PROFILE_REFRESH_INTERVAL_MS)
      return

    lastProfileKeys = keys
    lastProfileSyncAt = Date.now()

    try {
      const profileMap = await batchResolveProfiles(fetchedSessions)
      invalidSessionKeys.clear()

      for (const session of fetchedSessions) {
        const key = `${session.sessionId}_${session.sessionType}`
        const result = profileMap.get(key)

        if (result?.invalid) {
          invalidSessionKeys.add(key)
          continue
        }

        if (result?.sessionName) {
          await core.weila_updateSessionProfile(session.sessionId, session.sessionType, {
            sessionName: result.sessionName,
            sessionAvatar: result.sessionAvatar,
            memberCount: result.memberCount,
          })
        }
      }
    } catch (e) {
      console.warn('[Weila:UI:useSessions] batch resolve profiles failed:', e)
    }
  }

  async function fetchSessions(showLoading = sessions.value.length === 0) {
    if (fetchPromise) return fetchPromise

    const core = getCore()
    if (!core) {
      error.value = new Error('WeilaCore is not provided')
      return
    }

    if (showLoading) loading.value = true
    error.value = null

    fetchPromise = (async () => {
      try {
        sessions.value = await core.weila_getSessionsFromDb()
        await applyBatchProfiles(core, sessions.value)
      } catch (e) {
        error.value = e instanceof Error ? e : new Error(String(e))
        console.log('[Weila:UI:useSessions] fetchSessions error:', e)
      } finally {
        if (showLoading) loading.value = false
        fetchPromise = null
      }
    })()

    return fetchPromise
  }

  function scheduleBackgroundRefresh() {
    if (backgroundRefreshTimer) clearTimeout(backgroundRefreshTimer)

    backgroundRefreshTimer = setTimeout(() => {
      backgroundRefreshTimer = null
      void fetchSessions(false)
    }, BACKGROUND_REFRESH_DEBOUNCE_MS)
  }

  const handleEvent: WL_ExtEventCallback = (eventId, eventData) => {
    if (eventId === WL_ExtEventID.WL_EXT_DATA_PREPARE_IND) {
      if (
        !isEventRecord(eventData) ||
        !isPrepareState(eventData, WL_DataPrepareState.PREPARE_SUCC_END)
      )
        return
      void fetchSessions(sessions.value.length === 0)
    } else if (eventId === WL_ExtEventID.WL_EXT_NEW_SESSION_OPEN_IND) {
      scheduleBackgroundRefresh()
    } else if (
      eventId === WL_ExtEventID.WL_EXT_NEW_MSG_RECV_IND ||
      eventId === WL_ExtEventID.WL_EXT_SESSION_UPDATED_IND
    ) {
      if (isRealtimePttData(eventData)) return
      scheduleBackgroundRefresh()
    } else if (eventId === WL_ExtEventID.WL_EXT_MSG_SEND_IND) {
      scheduleBackgroundRefresh()
    } else if (eventId === WL_ExtEventID.WL_EXT_GROUP_MODIFIED_IND) {
      scheduleBackgroundRefresh()
    }
  }

  watch(
    getCore,
    (newCore, _oldCore, onCleanup) => {
      if (newCore) {
        newCore.weila_onEvent(handleEvent)
        onCleanup(() => {
          newCore.weila_offEvent(handleEvent)
          if (backgroundRefreshTimer) {
            clearTimeout(backgroundRefreshTimer)
            backgroundRefreshTimer = null
          }
        })
        const currentSessions = newCore.weila_getSessions()
        if (currentSessions.length > 0) {
          void fetchSessions(true)
        }
      }
    },
    { immediate: true },
  )

  return {
    sessions: sortedSessions,
    personalSessions,
    groupSessions,
    loading,
    error,
    invalidSessionKeys,
    refresh: () => fetchSessions(true),
    refreshSilently: () => fetchSessions(false),
  }
}
