<script setup lang="ts">
interface Message {
  role: 'user' | 'agent'
  text: string
}

const { t } = useI18n()
const authStore = useAuthStore()

const input = shallowRef('')
const messages = shallowRef<Message[]>([])
const loading = shallowRef(false)
const errorMsg = shallowRef('')

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
    errorMsg.value = `Stream failed: ${streamRes.status}`
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

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return

  messages.value = [...messages.value, { role: 'user', text }]
  input.value = ''
  loading.value = true
  errorMsg.value = ''

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
      errorMsg.value = err.message || t('agent.request-failed')
    })
  }
  catch (err: any) {
    errorMsg.value = err.message || t('agent.request-failed')
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
      <div v-if="errorMsg" class="text-red-500 text-sm">
        {{ errorMsg }}
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
      <a-button type="primary" :loading="loading" @click="send">
        {{ t('agent.send') }}
      </a-button>
    </div>
  </div>
</template>
