<script setup lang="ts">
interface Message {
  role: 'user' | 'agent'
  text: string
}

const { t } = useI18n()

const input = shallowRef('')
const messages = shallowRef<Message[]>([])
const loading = shallowRef(false)
const errorMsg = shallowRef('')

const agentHost = (typeof window !== 'undefined' && (window as any).electronAPI?.agentHost) || ''
const baseUrl = agentHost.replace(/\/$/, '')

function appendAgentText(delta: string) {
  const last = messages.value[messages.value.length - 1]
  if (last && last.role === 'agent') {
    last.text += delta
  }
  else {
    messages.value.push({ role: 'agent', text: delta })
  }
}

function setAgentText(text: string) {
  const last = messages.value[messages.value.length - 1]
  if (last && last.role === 'agent') {
    last.text = text
  }
  else {
    messages.value.push({ role: 'agent', text })
  }
}

async function startStream(sessionId: string) {
  const streamRes = await fetch(`${baseUrl}/eve/v1/session/${sessionId}/stream`)
  if (!streamRes.ok || !streamRes.body) {
    errorMsg.value = `Stream failed: ${streamRes.status}`
    return
  }

  const reader = streamRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const read = async () => {
    const { value, done } = await reader.read()
    if (done) return

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines.filter(Boolean)) {
      try {
        const event = JSON.parse(line) as any
        if (event.type === 'message.appended' && event.messageDelta) {
          appendAgentText(event.messageDelta)
        }
        else if (event.type === 'message.completed' && event.message?.content) {
          setAgentText(event.message.content)
        }
        else if (event.type === 'tool.result' && event.result) {
          appendAgentText(`\n\n[tool result] ${JSON.stringify(event.result)}`)
        }
      }
      catch {
        // ignore malformed NDJSON lines
      }
    }

    await read()
  }

  await read()
}

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', text })
  input.value = ''
  loading.value = true
  errorMsg.value = ''

  try {
    const sessionRes = await fetch(`${baseUrl}/eve/v1/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })
    if (!sessionRes.ok)
      throw new Error(`Session failed: ${sessionRes.status}`)

    const { sessionId } = await sessionRes.json() as { sessionId: string }

    // start streaming without awaiting; the Eve stream stays open for follow-ups
    startStream(sessionId).catch((err: any) => {
      errorMsg.value = err.message || t('agent.request-failed')
    })
  }
  catch (err: any) {
    errorMsg.value = err.message || t('agent.request-failed')
  }
  finally {
    // keep send button usable; the agent response streams in asynchronously
    loading.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col p4">
    <div class="flex-1 overflow-auto space-y-3">
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

    <div class="mt-4 flex gap-2">
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
