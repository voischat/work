<script setup lang="ts">
import type { WL_GroupProfileResolver, WL_IDbLocationShared, WL_IDbSession, WL_ProfileResolver } from '@weilasdk/core'
import Message from '@arco-design/web-vue/es/message'
import { isGroupSessionType } from '@weilasdk/core'
import { WlChatPanel } from '@weilasdk/ui'
import { computed, shallowRef, watch } from 'vue'
import ChatLauncher from './components/ChatLauncher.vue'

definePage({
  meta: {
    name: 'submenu.chat',
  },
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const weilaApi = useWeilaApi()

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
const mapPickerRef = shallowRef<{ captureImage: () => Promise<File> }>()
const pendingDeleteSession = shallowRef<WL_IDbSession>()
const isDeleteSessionModalOpen = shallowRef(false)
const isDeletingSession = shallowRef(false)
const isLocationPickerOpen = shallowRef(false)
const isSendingLocation = shallowRef(false)
const isLocationModalOpen = shallowRef(false)
const displayedLocation = shallowRef<{ latitude: number, longitude: number, name: string, address: string }>()
const showLocationPanel = shallowRef(false)
const realtimeLocationPanelId = computed(() => {
  const id = Number(selectedSessionId.value)
  return Number.isFinite(id) && id > 0 ? id : undefined
})
const panelWidth = shallowRef(384)

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

const resolveProfile: WL_ProfileResolver = async (userId) => {
  try {
    const member = await weilaApi.value.v2.fetch<{
      name?: string
      avatar?: string
      user_num?: number | string
    }>('corp/address/get-member', {
      body: { member_id: userId },
      method: 'POST',
    })

    return {
      name: member.name,
      avatar: member.avatar,
      weilaNum: member.user_num === undefined ? undefined : String(member.user_num),
    }
  }
  catch (error) {
    console.warn('[workbench/chat] resolve profile failed:', error)
    return null
  }
}

const resolveGroupProfile: WL_GroupProfileResolver = async (groupId) => {
  try {
    const group = await weilaApi.value.v2.fetch<{
      name?: string
      avatar?: string
    }>('corp/group/get-group', {
      body: { group_id: Number(groupId) },
      method: 'POST',
    })

    return {
      name: group.name,
      avatar: group.avatar,
    }
  }
  catch (error) {
    console.warn('[workbench/chat] resolve group profile failed:', error)
    return null
  }
}

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
  showLocationPanel.value = false

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

watch(
  weilaCore,
  (core, _oldCore, onCleanup) => {
    if (!core)
      return

    core.weila_setProfileResolver(resolveProfile)
    core.weila_setGroupProfileResolver(resolveGroupProfile)
    onCleanup(() => {
      if (weilaCore.value === core) {
        core.weila_setProfileResolver(undefined)
        core.weila_setGroupProfileResolver(undefined)
      }
    })
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

  // Keep this independent from map tile assets so location sending still works when
  // DOM capture is blocked by cross-origin images or transient tile load failures.
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

    // Prefer a real DOM capture of the visible map. If any map image asset cannot
    // be inlined, fall back to the locally drawn placeholder image below.
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

  const address = value.Address || [value.province, value.city, value.district, value.township].filter(Boolean).join('')
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

function handlePttError(payload: { session: WL_IDbSession, error?: unknown }) {
  console.warn('[WorkbenchChat] Failed to start PTT:', payload)
  Message.error('无法开始语音对讲，请稍后重试')
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
        class="flex-1 min-w-0" message-list-height="calc(100vh - 220px)" @delete-session="handleDeleteSessionRequest"
        @trigger-map-picker="openLocationPicker" @location-click="handleShowLocation" @ptt-error="handlePttError"
      >
        <template #session-footer>
          <ChatLauncher :core="weilaCore" />
        </template>
        <template #session-actions>
          <a-button
            v-if="selectedSessionType !== undefined && isGroupSessionType(selectedSessionType)" type="text"
            @click="showLocationPanel = !showLocationPanel"
          >
            <template #icon>
              <icon-location />
            </template>
            群成员位置
          </a-button>
        </template>
      </WlChatPanel>
      <a-resize-box
        v-if="showLocationPanel"
        v-model:width="panelWidth"
        :directions="['left']"
        :min-width="320"
        :max-width="600"
        class="h-full border-l border-neutral-200 bg-white"
      >
        <div h-full flex flex-col>
          <div class="flex justify-between items-center p-3 border-b">
            <span font-medium>群成员位置</span>
            <a-button type="text" @click="showLocationPanel = false">
              <template #icon>
                <icon-close />
              </template>
            </a-button>
          </div>
          <RealtimeLocationPanel :id="realtimeLocationPanelId" type="group" class="flex-1 min-h-0" />
        </div>
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
  </div>
</template>
