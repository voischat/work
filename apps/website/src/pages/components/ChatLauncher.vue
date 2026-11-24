<script setup lang="ts">
import type { WeilaCore } from '@vois/weila-sdk-core'
import IconMessage from '@arco-design/web-vue/es/icon/icon-message'
import Message from '@arco-design/web-vue/es/message'
import { WL_IDbSessionType } from '@vois/weila-sdk-core'
import { computed, shallowRef } from 'vue'
import ChatSessionPickerModal from './ChatSessionPickerModal.vue'

interface Props {
  core: WeilaCore | null
}

const props = defineProps<Props>()

const router = useRouter()
const weilaStore = useWeilaStore()
const { userInfo } = storeToRefs(weilaStore)

const currentUserId = computed(() => userInfo.value?.userId ?? 0)

const modalVisible = shallowRef(false)

function openModal() {
  modalVisible.value = true
}

async function handleSelect(payload: {
  sessionId: string
  sessionType: number
  sessionName?: string
  sessionAvatar?: string
  memberCount?: number
}) {
  if (!props.core)
    return

  if (
    payload.sessionType === WL_IDbSessionType.SESSION_CORP_INDIVIDUAL_TYPE
    && Number(payload.sessionId) === currentUserId.value
  ) {
    Message.warning('不能和自己发起个人对话')
    return
  }

  try {
    await props.core.weila_startNewSession(
      payload.sessionId,
      payload.sessionType,
      {
        sessionName: payload.sessionName,
        sessionAvatar: payload.sessionAvatar,
        memberCount: payload.memberCount,
      },
    )

    await router.replace({
      path: '/workbench/message',
      query: {
        sessionId: payload.sessionId,
        sessionType: String(payload.sessionType),
        sessionName: payload.sessionName,
        sessionAvatar: payload.sessionAvatar,
      },
    })

    modalVisible.value = false
  }
  catch (err) {
    console.error('[ChatLauncher] Failed to start session:', err)
    Message.error('发起会话失败')
  }
}
</script>

<template>
  <div class="w-full">
    <a-button
      type="primary"
      long
      size="large"
      class="justify-center flex items-center gap-2 text-base"
      @click="openModal"
    >
      <template #icon>
        <IconMessage />
      </template>
      <span>发起对话</span>
    </a-button>
  </div>

  <ChatSessionPickerModal
    v-model:visible="modalVisible"
    :core="core"
    @select="handleSelect"
  />
</template>
