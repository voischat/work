<script setup lang="ts">
import type { WL_IDbMsgData, WL_IDbUserInfo } from '@vois/weila-sdk-core'
import { WL_IDbMsgDataStatus } from '@vois/weila-sdk-core'
import { computed, shallowRef, watch } from 'vue'
import { useWeilaUiI18n } from '../../i18n'
import { getMessageThumbnailUrl } from '../../utils'

export interface WlImageBubbleProps {
  msg: WL_IDbMsgData
  isSelf?: boolean
  sender?: WL_IDbUserInfo
}

const props = withDefaults(defineProps<WlImageBubbleProps>(), {
  isSelf: false,
})

const { t } = useWeilaUiI18n()

const emit = defineEmits<{
  (e: 'click', url: string): void
}>()

const thumbnailUrl = computed(() => getMessageThumbnailUrl(props.msg.fileInfo?.fileUrl, 'image'))
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

function handleClick() {
  const url = props.msg.fileInfo?.fileUrl
  if (url) emit('click', url)
}
</script>

<template>
  <div
    class="max-w-[200px] rounded-xl overflow-hidden"
    :class="isSelf ? 'bg-blue-500' : 'bg-white'"
  >
    <img
      v-if="thumbnailUrl && !loadFailed"
      :src="thumbnailUrl"
      class="max-w-full max-h-[200px] rounded-xl object-cover cursor-pointer"
      alt="image"
      @error="loadFailed = true"
      @click="handleClick"
    />
    <div
      v-else-if="thumbnailUrl"
      class="w-[160px] h-[120px] flex flex-col items-center justify-center gap-2 cursor-pointer"
      @click="handleClick"
    >
      <span
        class="icon-[carbon--image] size-8"
        :class="isSelf ? 'text-blue-100' : 'text-neutral-400'"
      />
      <span class="text-xs" :class="isSelf ? 'text-blue-100' : 'text-neutral-500'">
        {{ t('message.imageLoadFailed') }}
      </span>
    </div>
    <div v-else class="w-[160px] h-[120px] flex flex-col items-center justify-center gap-2">
      <span
        class="size-8"
        :class="[
          isUploadFailed() ? 'icon-[carbon--warning]' : 'icon-[carbon--image]',
          isSelf ? 'text-blue-100' : 'text-neutral-400',
        ]"
      />
      <span class="text-xs" :class="isSelf ? 'text-blue-100' : 'text-neutral-500'">
        {{ isUploadFailed() ? t('message.uploadFailed') : t('message.uploading') }}
      </span>
    </div>
  </div>
</template>
