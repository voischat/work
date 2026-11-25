<script setup lang="ts">
import type { WL_IDbMsgData, WL_IDbServicePayload, WL_IDbUserInfo } from '@vois/weila-sdk-core'
import { computed, shallowRef, watch } from 'vue'
import { useWeilaUiI18n } from '../../i18n'
import { getMessageThumbnailUrl, isValidLocation } from '../../utils'

export interface WlServiceBubbleProps {
  msg: WL_IDbMsgData
  isSelf?: boolean
  sender?: WL_IDbUserInfo
}

type AlarmPayload = Extract<
  WL_IDbServicePayload,
  { type: 'alarm-power' | 'alarm-geofence' | 'alarm-sos' }
>

const props = withDefaults(defineProps<WlServiceBubbleProps>(), {
  isSelf: false,
})

const { t, locale } = useWeilaUiI18n()

const emit = defineEmits<{
  (e: 'image-click', url: string): void
  (
    e: 'location-click',
    location: { latitude: number; longitude: number; name: string; address: string },
  ): void
}>()

const GEOFENCE_TRANSITION_KEYS: Record<number, string> = {
  1: 'message.geofenceEnter',
  2: 'message.geofenceExit',
  3: 'message.geofenceStay',
}

const payload = computed(() => props.msg.servicePayload)

const qrcode = computed(() => {
  const current = payload.value

  return current?.type === 'qrcode' ? current : undefined
})

const memberChange = computed(() => {
  const current = payload.value

  return current?.type === 'session-member-change' ? current : undefined
})

const alarmPayload = computed<AlarmPayload | undefined>(() => {
  const current = payload.value

  return current?.type === 'alarm-power' ||
    current?.type === 'alarm-geofence' ||
    current?.type === 'alarm-sos'
    ? current
    : undefined
})

const qrcodeThumbnailUrl = computed(() => getMessageThumbnailUrl(qrcode.value?.url, 'image'))
const qrcodeLoadFailed = shallowRef(false)

watch(qrcodeThumbnailUrl, () => {
  qrcodeLoadFailed.value = false
})

function handleQrcodeClick() {
  if (qrcode.value?.url) emit('image-click', qrcode.value.url)
}

const memberNames = computed(() => {
  const current = memberChange.value

  if (!current) return ''

  const separator = locale.value === 'zh-CN' ? '、' : ', '

  return current.members.map((member) => member.nick || String(member.userId)).join(separator)
})

const memberChangeText = computed(() => {
  const current = memberChange.value

  if (!current) return ''

  return current.action === 'join'
    ? t('message.memberJoined', { names: memberNames.value })
    : t('message.memberExited', { names: memberNames.value })
})

const alarmTitle = computed(() => {
  switch (alarmPayload.value?.type) {
    case 'alarm-power':
      return t('message.alarmPower')
    case 'alarm-geofence':
      return t('message.alarmGeofence')
    case 'alarm-sos':
      return t('message.alarmSos')
    default:
      return ''
  }
})

const alarmUser = computed(() => {
  const current = alarmPayload.value

  if (!current) return ''
  if (current.userNick && current.userNumber) {
    return `${current.userNick} (${current.userNumber})`
  }

  return current.userNick ?? current.userNumber ?? ''
})

function joinDetailParts(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => !!part).join(' · ')
}

const alarmDetail = computed(() => {
  const current = alarmPayload.value

  if (!current) return ''
  if (current.type === 'alarm-power') return current.info ?? ''
  if (current.type === 'alarm-sos') return joinDetailParts([current.info, current.address])

  const transitionKey = current.transitionType
    ? GEOFENCE_TRANSITION_KEYS[current.transitionType]
    : undefined

  return joinDetailParts([transitionKey ? t(transitionKey) : undefined, current.address])
})

const alarmLocation = computed(() => {
  const current = alarmPayload.value

  if (!current || current.type === 'alarm-power') return undefined
  if (current.latitude === undefined || current.longitude === undefined) return undefined

  const location = { latitude: current.latitude, longitude: current.longitude }

  if (!isValidLocation(location)) return undefined

  return {
    ...location,
    name: current.address ?? '',
    address: current.address ?? '',
  }
})

function handleLocationClick() {
  if (alarmLocation.value) emit('location-click', alarmLocation.value)
}
</script>

<template>
  <div
    class="rounded-xl px-3 py-2 text-sm overflow-hidden break-all"
    :class="isSelf ? 'bg-blue-500 text-blue-100' : 'bg-white text-neutral-400'"
  >
    <div v-if="qrcode" class="flex flex-col gap-1.5">
      <img
        v-if="qrcodeThumbnailUrl && !qrcodeLoadFailed"
        :src="qrcodeThumbnailUrl"
        class="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer"
        :alt="t('message.qrcode')"
        @error="qrcodeLoadFailed = true"
        @click="handleQrcodeClick"
      />
      <div
        v-else
        class="w-[160px] h-[120px] flex flex-col items-center justify-center gap-2 cursor-pointer"
        @click="handleQrcodeClick"
      >
        <span
          class="icon-[carbon--image] size-8"
          :class="isSelf ? 'text-blue-100' : 'text-neutral-400'"
        />
        <span class="text-xs" :class="isSelf ? 'text-blue-100' : 'text-neutral-500'">
          {{ t('message.imageLoadFailed') }}
        </span>
      </div>
      <div
        v-if="qrcode.name"
        class="font-medium"
        :class="isSelf ? 'text-white' : 'text-neutral-900'"
      >
        {{ qrcode.name }}
      </div>
      <div v-if="qrcode.desc" :class="isSelf ? 'text-blue-100' : 'text-neutral-500'">
        {{ qrcode.desc }}
      </div>
    </div>

    <div v-else-if="memberChange">{{ memberChangeText }}</div>

    <div v-else-if="payload?.type === 'group-destroy'">{{ t('message.groupDestroyed') }}</div>

    <div v-else-if="alarmPayload" class="flex flex-col gap-1">
      <div class="font-medium" :class="isSelf ? 'text-white' : 'text-neutral-900'">
        {{ alarmTitle }}
      </div>
      <div v-if="alarmUser" :class="isSelf ? 'text-blue-100' : 'text-neutral-500'">
        {{ alarmUser }}
      </div>
      <div v-if="alarmDetail" :class="isSelf ? 'text-blue-100' : 'text-neutral-500'">
        {{ alarmDetail }}
      </div>
      <button
        v-if="alarmLocation"
        type="button"
        class="mt-1 self-start text-xs font-medium underline"
        :class="isSelf ? 'text-white' : 'text-blue-500'"
        @click="handleLocationClick"
      >
        {{ t('message.viewLocation') }}
      </button>
    </div>
  </div>
</template>
