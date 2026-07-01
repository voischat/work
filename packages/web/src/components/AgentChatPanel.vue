<script setup lang="ts">
import { Message } from '@arco-design/web-vue'

interface ChatMessage {
  role: 'user' | 'agent'
  text: string
}

const { t } = useI18n()
const authStore = useAuthStore()

const input = shallowRef('')
const messages = shallowRef<ChatMessage[]>([])
const loading = shallowRef(false)

const agentHost = (typeof window !== 'undefined' && window.electronAPI?.agentHost) || ''
const baseUrl = agentHost.replace(/\/$/, '')

function getAccessToken(): string {
  // token 来自 web 登录会话；agent 端会用它作为 CLI --token 调用
  return authStore.token
}

function appendAgentText(delta: string) {
  const list = messages.value
  const last = list[list.length - 1]
  if (last && last.role === 'agent') {
    last.text += delta
    messages.value = [...list]
  }
  else {
    messages.value = [...list, { role: 'agent', text: delta }]
  }
}

function setAgentText(text: string) {
  const list = messages.value
  const last = list[list.length - 1]
  if (last && last.role === 'agent') {
    last.text = text
    messages.value = [...list]
  }
  else {
    messages.value = [...list, { role: 'agent', text }]
  }
}

async function startStream(sessionId: string) {
  console.log('[agent-chat] starting stream', sessionId, 'baseUrl', baseUrl)
  const streamRes = await fetch(`${baseUrl}/eve/v1/session/${sessionId}/stream`)
  console.log('[agent-chat] stream response', streamRes.status, streamRes.ok, 'body?', !!streamRes.body)
  if (!streamRes.ok || !streamRes.body) {
    Message.error(`Stream failed: ${streamRes.status}`)
    return
  }

  const reader = streamRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const read = async () => {
    const { value, done } = await reader.read()
    console.log('[agent-chat] read chunk', { done, size: value?.length })
    if (done) return

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines.filter(Boolean)) {
      console.log('[agent-chat] event line', line.slice(0, 200))
      try {
        const event = JSON.parse(line) as any
        if (event.type === 'message.appended' && event.data?.messageDelta) {
          appendAgentText(event.data.messageDelta)
        }
        else if (event.type === 'message.completed' && event.data?.message) {
          setAgentText(event.data.message)
        }
        else if (event.type === 'tool.result' && event.data?.result) {
          appendAgentText(`\n\n[tool result] ${JSON.stringify(event.data.result)}`)
        }
        else if (event.type === 'session.failed' || event.type === 'turn.failed' || event.type === 'step.failed') {
          const err = event.data?.code || event.data?.error || JSON.stringify(event.data)
          appendAgentText(`\n\n[error: ${event.type}] ${err}`)
        }
      }
      catch {
        // ignore malformed NDJSON lines
      }
    }

    await read()
  }

  await read()
  console.log('[agent-chat] stream ended')
}

const { isRecording, isProcessing: voiceProcessing, start: startVoice, stopAndRecognize } = useBaiduSpeech()

// 把 getUserMedia 的错误类型映射为可读提示：
// NotFoundError    → 没有麦克风设备
// NotReadableError → 设备被其他程序占用/驱动异常
// 其余（NotAllowedError/SecurityError…）→ 权限被拒
function micErrorMessage(err: any): string {
  switch (err?.name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return t('agent.mic-not-found')
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return t('agent.mic-in-use')
    default:
      return t('agent.mic-denied')
  }
}

async function toggleVoice() {
  if (voiceProcessing.value)
    return

  if (!isRecording.value) {
    try {
      await startVoice()
    }
    catch (err: any) {
      console.error(`[voice] startVoice failed name=${err?.name} message=${err?.message}`)
      Message.error(micErrorMessage(err))
    }
    return
  }

  try {
    const text = await stopAndRecognize()
    if (text)
      input.value = text
    else
      Message.warning(t('agent.voice-empty'))
  }
  catch (err: any) {
    console.error(`[voice] stopAndRecognize failed name=${err?.name} message=${err?.message}`)
    Message.error(err?.message || t('agent.voice-failed'))
  }
}

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return

  messages.value = [...messages.value, { role: 'user', text }]
  input.value = ''
  loading.value = true

  try {
    const token = getAccessToken()
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (token) headers['x-weila-token'] = token

    const sessionRes = await fetch(`${baseUrl}/eve/v1/session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: text }),
    })
    if (!sessionRes.ok)
      throw new Error(`Session failed: ${sessionRes.status}`)

    const { sessionId } = await sessionRes.json() as { sessionId: string }

    startStream(sessionId).catch((err: any) => {
      Message.error(err.message || t('agent.request-failed'))
    })
  }
  catch (err: any) {
    Message.error(err.message || t('agent.request-failed'))
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700">
    <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
      <div class="flex items-center gap-2">
        <i class="i-carbon-bot text-lg text-primary-600 dark:text-primary-400" />
        <span class="font-semibold">{{ t('agent.title') }}</span>
      </div>
    </div>

    <div class="flex-1 overflow-auto space-y-3 p-4">
      <div
        v-for="(msg, idx) in messages" :key="idx"
        :class="msg.role === 'user' ? 'text-right' : 'text-left'"
      >
        <div
          class="inline-block max-w-4/5 rounded-lg px-4 py-2 text-sm"
          :class="msg.role === 'user'
            ? 'bg-primary-600 text-white'
            : 'bg-neutral-100 dark:bg-neutral-800'"
        >
          <pre class="whitespace-pre-wrap font-sans">{{ msg.text }}</pre>
        </div>
      </div>
    </div>

    <div class="p-3 border-t border-neutral-200 dark:border-neutral-700 flex gap-2">
      <a-textarea
        v-model="input"
        :placeholder="t('agent.input-placeholder')"
        :auto-size="{ minRows: 1, maxRows: 4 }"
        class="flex-1"
        @keydown.enter.prevent="send"
      />
      <a-button
        :type="isRecording ? 'primary' : 'outline'"
        :status="isRecording ? 'danger' : 'normal'"
        :loading="voiceProcessing"
        :disabled="loading"
        :title="isRecording ? t('agent.voice-stop') : t('agent.voice-input')"
        @click="toggleVoice"
      >
        <i v-if="!voiceProcessing" :class="isRecording ? 'i-ph-stop-fill' : 'i-ph-microphone'" class="text-base" />
      </a-button>
      <a-button type="primary" :loading="loading" @click="send">
        {{ t('agent.send') }}
      </a-button>
    </div>
  </div>
</template>
