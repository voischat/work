<script setup lang="ts">
import type { WL_IDbLocationShared, WL_IDbMsgData, WL_IDbSession } from '@vois/weila-sdk-core'
import type { BatchSessionProfileResolver } from '@vois/weila-sdk-ui'
import type { SessionSelectPayload } from './components/ChatSessionPickerModal.vue'
import type { Member } from '~/types/api'
import Message from '@arco-design/web-vue/es/message'
import { useQuery } from '@tanstack/vue-query'
import { isGroupSessionType, isIndividualSessionType, WL_IDbMsgDataType } from '@vois/weila-sdk-core'
import { WlChatPanel } from '@vois/weila-sdk-ui'
import { computed, reactive, shallowRef, watch } from 'vue'
import ChatLauncher from './components/ChatLauncher.vue'
import ChatSessionPickerModal from './components/ChatSessionPickerModal.vue'

definePage({
  path: '/workbench/message',
  name: '/workbench/message',
  meta: {
    name: 'submenu.chat',
  },
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const weilaApi = useWeilaApi()

const weilaStore = useWeilaStore()
const { core: weilaCore, userInfo } = storeToRefs(weilaStore)

async function initSdk() {
  if (weilaCore.value && userInfo.value)
    return weilaCore.value

  const loggedIn = await weilaStore.autoLogin()
  return loggedIn ? weilaCore.value : null
}

onMounted(() => {
  void initSdk()
})

const currentUserId = computed(() => userInfo.value?.userId ?? 0)
const selfInfoStore = useSelfInfoStore()
const selfUserId = computed(() => Number(selfInfoStore.selfInfo?.user_id) || currentUserId.value || 0)

function parseSessionType(value: unknown) {
  if (typeof value !== 'string')
    return undefined

  const sessionType = Number(value)
  return Number.isFinite(sessionType)
    ? sessionType
    : undefined
}

const selectedSessionId = shallowRef(typeof route.query.sessionId === 'string'
  ? route.query.sessionId
  : '')
const selectedSessionType = shallowRef<number | undefined>(parseSessionType(route.query.sessionType))
const chatPanelRef = shallowRef<InstanceType<typeof WlChatPanel>>()
const mapPickerRef = shallowRef<{ captureImage: () => Promise<File> }>()
const pendingDeleteSession = shallowRef<WL_IDbSession>()
const isDeleteSessionModalOpen = shallowRef(false)
const isDeletingSession = shallowRef(false)
const isLocationPickerOpen = shallowRef(false)
const isSendingLocation = shallowRef(false)
const isLocationModalOpen = shallowRef(false)
const displayedLocation = shallowRef<{ latitude: number, longitude: number, name: string, address: string }>()
const showLocationPanel = shallowRef(false)
const showGroupSettingsPanel = shallowRef(false)
const groupSettingsPanelWidth = shallowRef(420)
const isForwardPickerOpen = shallowRef(false)
const forwardingMsg = shallowRef<WL_IDbMsgData>()
const isForwarding = shallowRef(false)
const realtimeLocationPanelId = computed(() => {
  const id = Number(selectedSessionId.value)
  return Number.isFinite(id) && id > 0
    ? id
    : undefined
})
const realtimeLocationPanelType = computed(() => {
  const sessionType = selectedSessionType.value
  if (sessionType === undefined)
    return 'group'
  return isIndividualSessionType(sessionType)
    ? 'individual'
    : 'group'
})
const selectedGroupId = computed(() => {
  if (selectedSessionType.value === undefined || !isGroupSessionType(selectedSessionType.value))
    return undefined
  const id = Number(selectedSessionId.value)
  return Number.isFinite(id) && id > 0
    ? id
    : undefined
})
const panelWidth = shallowRef(384)

interface CorpSessionItem {
  id: number
  type: number
  name: string
  avatar: string
  user_count: number
}

function isResolvableSessionType(sessionType: number): boolean {
  return isIndividualSessionType(sessionType) || isGroupSessionType(sessionType)
}

const invalidSessionKeys = reactive(new Set<string>())

const selectedSessionKey = computed(() => {
  if (!selectedSessionId.value || selectedSessionType.value === undefined)
    return null
  return `${selectedSessionId.value}_${selectedSessionType.value}`
})

const isSelectedSessionUnavailable = computed(() => {
  const key = selectedSessionKey.value
  return key
    ? invalidSessionKeys.has(key)
    : false
})

const batchResolveSessionProfiles: BatchSessionProfileResolver = async (sessions) => {
  const profileMap = new Map<string, { sessionName?: string, sessionAvatar?: string, memberCount?: number, invalid?: boolean }>()

  const requestSessions = sessions
    .filter(s => isResolvableSessionType(s.sessionType))
    .map((s) => {
      const id = Number(s.sessionId)
      return { id, type: s.sessionType }
    })
    .filter(s => Number.isFinite(s.id) && s.id > 0)

  if (requestSessions.length === 0)
    return profileMap

  try {
    const res = await weilaApi.value.v2.fetch<CorpSessionItem[] | { sessions?: CorpSessionItem[] }>('corp/session/get-sessions', {
      body: { sessions: requestSessions },
      method: 'POST',
    })

    if (!Array.isArray(res) && (!res || !('sessions' in res))) {
      console.warn('[workbench/message] get-sessions returned unexpected response:', res)
      return profileMap
    }

    const returnedItems = Array.isArray(res)
      ? res
      : res.sessions ?? []

    const returnedMap = new Map<string, CorpSessionItem>()
    for (const item of returnedItems)
      returnedMap.set(`${item.id}_${item.type}`, item)

    for (const session of sessions) {
      if (!isResolvableSessionType(session.sessionType))
        continue

      const key = `${session.sessionId}_${session.sessionType}`
      const item = returnedMap.get(key)
      if (!item) {
        profileMap.set(key, { invalid: true })
      }
      else {
        profileMap.set(key, {
          sessionName: item.name,
          sessionAvatar: item.avatar,
          memberCount: item.user_count,
        })
      }
    }
  }
  catch (error) {
    console.warn('[workbench/message] batch resolve session profiles failed:', error)
  }

  return profileMap
}

function handleInvalidSessionsChange(keys: Set<string>) {
  invalidSessionKeys.clear()
  for (const key of keys)
    invalidSessionKeys.add(key)
}

const { data: isInSelectedGroup } = useQuery<boolean>({
  enabled: computed(() => Boolean(selfUserId.value && selectedGroupId.value && !isSelectedSessionUnavailable.value)),
  queryKey: [
    'corp/group/get-group-all-member/self-membership',
    selectedGroupId,
    selfUserId,
    isSelectedSessionUnavailable,
  ],
  queryFn: async () => {
    const groupId = selectedGroupId.value
    if (!groupId || isSelectedSessionUnavailable.value)
      return false

    const members = await weilaApi.value.v2.fetch<Member[]>('corp/group/get-group-all-member', {
      body: { group_id: groupId },
      method: 'POST',
    })

    return members.some(member => Number(member.user_id) === selfUserId.value)
  },
  refetchOnWindowFocus: false,
})

async function beforeSend(session: WL_IDbSession): Promise<boolean> {
  if (isSelectedSessionUnavailable.value)
    return false
  if (!isGroupSessionType(session.sessionType) || !selectedGroupId.value)
    return true
  return isInSelectedGroup.value !== false
}

function handleSendBlocked() {
  if (isSelectedSessionUnavailable.value) {
    Message.warning(t('chat.session-unavailable'))
    return
  }
  Message.warning(t('chat.not-in-group'))
}

interface MapPickerValue {
  lon: number
  lat: number
  Address?: string
  province?: string
  city?: string
  district?: string
  township?: string
}

const pendingDeleteSessionName = computed(() => {
  return pendingDeleteSession.value?.sessionName || pendingDeleteSession.value?.sessionId || ''
})

watch(
  () => route.query.sessionId,
  (sessionId) => {
    selectedSessionId.value = typeof sessionId === 'string'
      ? sessionId
      : ''
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
  if (!userInfo.value)
    return

  if (core.weila_getSession(sessionId, sessionType))
    return

  await core.weila_startNewSession(sessionId, sessionType, {
    sessionName: typeof route.query.sessionName === 'string'
      ? route.query.sessionName
      : undefined,
    sessionAvatar: typeof route.query.sessionAvatar === 'string'
      ? route.query.sessionAvatar
      : undefined,
  })
}

watch([selectedSessionId, selectedSessionType], ([sessionId, sessionType]) => {
  showLocationPanel.value = false
  showGroupSettingsPanel.value = false

  if (route.query.sessionId === sessionId && parseSessionType(route.query.sessionType) === sessionType)
    return

  void router.replace({
    query: {
      ...route.query,
      sessionId: sessionId || undefined,
      sessionType: sessionId && sessionType !== undefined
        ? String(sessionType)
        : undefined,
    },
  })
})

watch(
  [
    weilaCore,
    userInfo,
    selectedSessionId,
    selectedSessionType,
  ],
  () => {
    void ensureSelectedSession()
  },
  { immediate: true },
)

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

function openLocationPicker() {
  isLocationPickerOpen.value = true
}

function canvasToPngFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('生成位置图片失败'))
        return
      }

      resolve(new File([blob], fileName, { type: 'image/png' }))
    }, 'image/png')
  })
}

async function createFallbackLocationImageFile() {
  const width = 400
  const height = 200
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx)
    throw new Error('当前浏览器不支持 Canvas')

  ctx.fillStyle = '#e8f1ef'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#d6e3df'
  ctx.lineWidth = 1
  for (let x = -40; x < width + 40; x += 48) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 70, height)
    ctx.stroke()
  }
  for (let y = 20; y < height; y += 42) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y - 34)
    ctx.stroke()
  }

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 14
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-20, 148)
  ctx.bezierCurveTo(80, 118, 150, 170, 250, 116)
  ctx.bezierCurveTo(305, 86, 342, 104, 420, 68)
  ctx.stroke()

  ctx.strokeStyle = '#cfdcd8'
  ctx.lineWidth = 2
  ctx.stroke()

  const pinX = width / 2
  const pinY = 80
  ctx.fillStyle = '#1677ff'
  ctx.beginPath()
  ctx.arc(pinX, pinY - 18, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(pinX - 12, pinY - 4)
  ctx.lineTo(pinX, pinY + 24)
  ctx.lineTo(pinX + 12, pinY - 4)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(pinX, pinY - 18, 7, 0, Math.PI * 2)
  ctx.fill()

  return canvasToPngFile(canvas, `location-${Date.now()}.png`)
}

async function createLocationImageFile() {
  try {
    if (!mapPickerRef.value)
      throw new Error('Missing map picker ref')

    return await mapPickerRef.value.captureImage()
  }
  catch (err) {
    console.warn('[WorkbenchChat] Failed to capture map DOM, fallback to canvas:', err)
    return createFallbackLocationImageFile()
  }
}

async function handleLocationPicked(value: MapPickerValue) {
  if (isSendingLocation.value)
    return

  const core = weilaCore.value
  const sessionId = selectedSessionId.value
  const sessionType = selectedSessionType.value
  if (!core || !sessionId || sessionType === undefined) {
    Message.error('请先选择频道')
    return
  }

  isSendingLocation.value = true

  const address = value.Address || [
    value.province,
    value.city,
    value.district,
    value.township,
  ].filter(Boolean).join('')
  const locationName = address || '位置'

  try {
    const imageFile = await createLocationImageFile()
    const mapUrl = await core.weila_uploadImageCache(sessionId, sessionType, imageFile)
    const location: WL_IDbLocationShared = {
      locationType: 'gcj02',
      latitude: value.lat,
      longitude: value.lon,
      name: locationName,
      address: address || '位置',
      mapUrl,
    }

    const success = await chatPanelRef.value?.sendLocation(location)
    if (!success)
      return

    Message.success('位置已发送')
    isLocationPickerOpen.value = false
  }
  catch (err) {
    console.error('[WorkbenchChat] Failed to upload location image:', err)
    Message.error('位置图片上传失败')
  }
  finally {
    isSendingLocation.value = false
  }
}

function handleShowLocation(location: { latitude: number, longitude: number, name: string, address: string }) {
  displayedLocation.value = location
  isLocationModalOpen.value = true
}

function handleGroupSettingsSuccess() {
  weilaCore.value?.weila_refreshSessionList()
}

function handlePttError(payload: { session: WL_IDbSession, error?: unknown }) {
  console.warn('[WorkbenchChat] Failed to start PTT:', payload)
  Message.error('无法开始语音对讲，请稍后重试')
}

async function urlToFile(url: string, fileName?: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`下载文件失败: ${response.status} ${response.statusText}`)

  const blob = await response.blob()
  const finalFileName = fileName || url.split('/').pop() || 'file'
  return new File([blob], finalFileName, { type: blob.type || 'application/octet-stream' })
}

async function forwardMessageContent(msg: WL_IDbMsgData, target: SessionSelectPayload) {
  const core = weilaCore.value
  if (!core)
    throw new Error('SDK 未初始化')

  const { sessionId, sessionType } = target
  const fileName = msg.fileInfo?.fileName

  switch (msg.msgType) {
    case WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE:
      return core.weila_sendTextMsg(sessionId, sessionType, msg.textData || '')

    case WL_IDbMsgDataType.WL_DB_MSG_DATA_AUDIO_TYPE: {
      if (!msg.audioData)
        throw new Error('该音频不支持转发')
      if (msg.audioData.data && msg.audioData.data.length > 0) {
        return core.weila_sendAudioMsgByData(sessionId, sessionType, msg.audioData)
      }
      if (!msg.audioData.audioUrl)
        throw new Error('该音频不支持转发')
      return core.weila_sendAudioMsg(sessionId, sessionType, msg.audioData.audioUrl, msg.audioData.frameCount)
    }

    case WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE: {
      const url = msg.fileInfo?.fileUrl
      if (!url)
        throw new Error('图片链接不存在')
      const file = await urlToFile(url, fileName)
      return core.weila_sendImage(sessionId, sessionType, file.name, file)
    }

    case WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE: {
      const url = msg.fileInfo?.fileUrl
      if (!url)
        throw new Error('视频链接不存在')
      const file = await urlToFile(url, fileName)
      return core.weila_sendVideo(sessionId, sessionType, file.name, file)
    }

    case WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE: {
      const url = msg.fileInfo?.fileUrl
      if (!url)
        throw new Error('文件链接不存在')
      const file = await urlToFile(url, fileName)
      return core.weila_sendFile(sessionId, sessionType, file.name, file)
    }

    case WL_IDbMsgDataType.WL_DB_MSG_DATA_LOCATION_TYPE:
      if (!msg.location)
        throw new Error('位置信息不存在')
      return core.weila_sendPosition(sessionId, sessionType, msg.location)

    default:
      throw new Error(`不支持转发的消息类型: ${msg.msgType}`)
  }
}

async function handleWithdraw(msg: WL_IDbMsgData) {
  const core = weilaCore.value
  if (!core)
    return

  try {
    await core.weila_withdrawMsg(msg.sessionId, msg.sessionType, msg.msgId)
    Message.success('撤回成功')
  }
  catch (err) {
    console.error('[WorkbenchChat] Withdraw failed:', err)
    Message.error('撤回失败')
  }
}

const ONE_HOUR_SECONDS = 3600
const ONE_DAY_SECONDS = 86400

function canForward(msg: WL_IDbMsgData) {
  if (msg.msgType !== WL_IDbMsgDataType.WL_DB_MSG_DATA_AUDIO_TYPE)
    return true
  return (Date.now() / 1000 - msg.created) <= ONE_DAY_SECONDS
}

function canWithdraw(msg: WL_IDbMsgData) {
  return (Date.now() / 1000 - msg.created) <= ONE_HOUR_SECONDS
}

function handleForward(msg: WL_IDbMsgData) {
  forwardingMsg.value = msg
  isForwardPickerOpen.value = true
}

async function handleForwardTargetSelect(target: SessionSelectPayload) {
  if (isForwarding.value || !forwardingMsg.value)
    return

  const core = weilaCore.value
  if (!core)
    return

  isForwarding.value = true

  try {
    await core.weila_startNewSession(target.sessionId, target.sessionType, {
      sessionName: target.sessionName,
      sessionAvatar: target.sessionAvatar,
      memberCount: target.memberCount,
    })

    await forwardMessageContent(forwardingMsg.value, target)

    isForwardPickerOpen.value = false
    forwardingMsg.value = undefined

    Message.success({
      content: () => h('div', { class: 'flex items-center gap-1' }, [
        h('span', '转发成功，'),
        h('a', {
          class: 'text-blue-600 hover:text-blue-700 hover:underline cursor-pointer',
          href: 'javascript:;',
          onClick: (e: Event) => {
            e.preventDefault()
            void router.push({
              path: '/workbench/message',
              query: {
                sessionId: target.sessionId,
                sessionType: String(target.sessionType),
                sessionName: target.sessionName,
                sessionAvatar: target.sessionAvatar,
              },
            })
          },
        }, '点击前往'),
      ]),
    })
  }
  catch (err) {
    console.error('[WorkbenchChat] Forward failed:', err)
    Message.error('转发失败')
  }
  finally {
    isForwarding.value = false
  }
}
</script>

<template>
  <div h-full>
    <div v-if="!weilaCore" class="flex items-center justify-center h-full text-neutral-400">
      {{ t('chat.sdk-loading') }}
    </div>
    <div v-else class="flex h-full">
      <WlChatPanel
        ref="chatPanelRef" v-model:selected-session-id="selectedSessionId"
        v-model:selected-session-type="selectedSessionType" :core="weilaCore" :current-user-id="currentUserId"
        :before-send="beforeSend" :batch-resolve-session-profiles="batchResolveSessionProfiles"
        class="flex-1 min-w-0" message-list-height="calc(100vh - 220px)" show-forward show-withdraw
        :can-forward="canForward" :can-withdraw="canWithdraw"
        @delete-session="handleDeleteSessionRequest" @trigger-map-picker="openLocationPicker"
        @location-click="handleShowLocation" @ptt-error="handlePttError" @send-blocked="handleSendBlocked"
        @invalid-sessions-change="handleInvalidSessionsChange" @forward="handleForward" @withdraw="handleWithdraw"
      >
        <template #session-footer>
          <ChatLauncher :core="weilaCore" />
        </template>
        <template #session-actions>
          <a-button
            v-if="selectedSessionType !== undefined && (isGroupSessionType(selectedSessionType) || isIndividualSessionType(selectedSessionType))"
            type="text"
            @click="showLocationPanel = !showLocationPanel"
          >
            <template #icon>
              <icon-location />
            </template>
            {{ $t('chat.member-location') }}
          </a-button>
          <a-button
            v-if="selectedGroupId !== undefined && !isSelectedSessionUnavailable"
            type="text"
            @click="showGroupSettingsPanel = !showGroupSettingsPanel"
          >
            <template #icon>
              <icon-more-vertical />
            </template>
            {{ t('group.settings.title') }}
          </a-button>
        </template>
      </WlChatPanel>
      <a-resize-box
        v-if="showLocationPanel"
        v-model:width="panelWidth"
        :directions="['left']"
        :min-width="320"
        :max-width="600"
        class="h-full border-l border-neutral-200 bg-white of-visible"
      >
        <div h-full flex flex-col>
          <div class="flex justify-between items-center p-3 border-b">
            <span font-medium>{{ $t('chat.member-location') }}</span>
            <a-button status="danger" type="text" @click="showLocationPanel = false">
              <template #icon>
                <icon-close />
              </template>
            </a-button>
          </div>
          <RealtimeLocationPanel :id="realtimeLocationPanelId" :type="realtimeLocationPanelType" class="flex-1 min-h-0" />
        </div>
      </a-resize-box>
      <a-resize-box
        v-if="showGroupSettingsPanel && selectedGroupId !== undefined"
        v-model:width="groupSettingsPanelWidth"
        :directions="['left']"
        :min-width="320"
        :max-width="600"
        class="h-full border-l border-neutral-200 bg-white"
      >
        <GroupSettings
          :group-id="selectedGroupId"
          @close="showGroupSettingsPanel = false"
          @success="handleGroupSettingsSuccess"
        />
      </a-resize-box>
    </div>
    <a-modal
      v-model:visible="isLocationPickerOpen" title="发送位置" :footer="false" width="min(960px, 92vw)"
      :mask-closable="!isSendingLocation" :esc-to-close="!isSendingLocation" :closable="!isSendingLocation"
      body-style="position: relative; height: min(680px, 78vh); padding: 0; overflow: hidden;"
    >
      <MapPicker v-if="isLocationPickerOpen" ref="mapPickerRef" @update:value="handleLocationPicked" />
      <div v-if="isSendingLocation" absolute inset-0 z-10 flex items-center justify-center bg-white:70 backdrop-blur-sm>
        <a-spin tip="正在上传位置图片..." />
      </div>
    </a-modal>
    <a-modal
      v-model:visible="isLocationModalOpen" title="查看位置" :footer="false" width="min(960px, 92vw)"
      body-style="position: relative; height: min(680px, 78vh); padding: 0; overflow: hidden;"
    >
      <LocationViewer
        v-if="isLocationModalOpen && displayedLocation" :latitude="displayedLocation.latitude"
        :longitude="displayedLocation.longitude" :name="displayedLocation.name" :address="displayedLocation.address"
      />
    </a-modal>
    <a-modal
      v-model:visible="isDeleteSessionModalOpen" :title="t('chat.delete-session.title')" :footer="false"
      :mask-closable="!isDeletingSession" :esc-to-close="!isDeletingSession" :closable="!isDeletingSession"
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
    <ChatSessionPickerModal
      v-model:visible="isForwardPickerOpen"
      :core="weilaCore"
      title="转发到"
      :loading="isForwarding"
      :disabled-user-ids="[selfUserId]"
      @select="handleForwardTargetSelect"
    />
  </div>
</template>
