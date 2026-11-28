<script setup lang="ts">
import type { WL_VideoMsgData, WL_IDbUserInfo } from '@vois/weila-sdk-core'
import { WL_IDbMsgDataStatus } from '@vois/weila-sdk-core'
import { computed, shallowRef, watch } from 'vue'
import { useWeilaUiI18n } from '../../i18n'
import { getMessageThumbnailUrl } from '../../utils'

export interface WlVideoBubbleProps {
  msg: WL_VideoMsgData
  isSelf?: boolean
  sender?: WL_IDbUserInfo
}

const props = withDefaults(defineProps<WlVideoBubbleProps>(), {
  isSelf: false,
})

const { t } = useWeilaUiI18n()

const emit = defineEmits<{
  (e: 'click', url: string): void
}>()

const thumbnailUrl = computed(() => getMessageThumbnailUrl(props.msg.fileInfo.fileUrl, 'video'))
const loadFailed = shallowRef(false)

watch(thumbnailUrl, () => {
  loadFailed.value = false
})

function isUploadFailed() {
  return (
    props.msg.status === WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_UNSENT ||
    props.msg.status === WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_ERR
  )
}
</script>

<template>
  <div
    class="rounded-xl overflow-hidden"
    :class="isSelf ? 'bg-blue-500' : 'bg-white'"
    @click="msg.fileInfo.fileUrl && emit('click', msg.fileInfo.fileUrl)"
  >
    <div
      class="relative max-w-[200px]"
      :class="msg.fileInfo.fileUrl ? 'cursor-pointer' : 'opacity-60'"
    >
      <img
        v-if="thumbnailUrl && !loadFailed"
        :src="thumbnailUrl"
        class="w-full h-full object-cover"
        alt="video thumbnail"
        @error="loadFailed = true"
      />
      <div v-else class="w-[200px] h-[150px] bg-neutral-300 flex items-center justify-center">
        <span class="icon-[carbon--video] size-12 text-neutral-500" />
      </div>

      <div
        v-if="msg.fileInfo.fileUrl"
        class="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
      >
        <div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
          <span class="icon-[carbon--play-filled] size-6 text-neutral-800 ml-1" />
        </div>
      </div>
      <div v-else class="absolute inset-0 flex items-center justify-center bg-black/20">
        <div class="flex flex-col items-center gap-2 text-white">
          <span v-if="isUploadFailed()" class="icon-[carbon--warning] size-6" />
          <span
            v-else
            class="icon-[carbon--rotate] size-6 animate-spin [animation-direction:reverse]"
          />
          <span class="text-xs">{{
            isUploadFailed() ? t('message.uploadFailed') : t('message.uploading')
          }}</span>
        </div>
      </div>

      <div
        v-if="msg.fileInfo.fileName"
        class="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/60 to-transparent"
      >
        <div class="text-xs text-white truncate">
          {{ msg.fileInfo.fileName }}
        </div>
      </div>
    </div>
  </div>
</template>
