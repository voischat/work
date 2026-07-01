import { shallowRef } from 'vue'
import { baiduSpeechKeys } from '~/shared/const'

// Baidu short-speech recognition (REST): OAuth token -> POST /server_api.
// Audio must be 16k / 16-bit / mono PCM, base64-encoded in the `speech` field.
// Docs: https://cloud.baidu.com/doc/SPEECH/s/Jlbxdezuf

const TARGET_SAMPLE_RATE = 16000
// Mandarin, near-field model, punctuation. See dev_pid table in the docs.
const DEV_PID = 1537

// In the packaged Electron app webSecurity is off, so we can hit Baidu directly.
// In the browser (dev / web) we go through the Vite dev proxy to dodge CORS.
const isElectron = typeof window !== 'undefined' && !!window.electronAPI
const OAUTH_BASE = isElectron ? 'https://aip.baidubce.com' : '/baidu-oauth'
const ASR_BASE = isElectron ? 'https://vop.baidu.com' : '/baidu-asr'

// Access token is valid ~30 days; cache it across component instances.
let cachedToken = ''
let tokenExpireAt = 0

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < tokenExpireAt)
    return cachedToken

  const { apiKey, secretKey } = baiduSpeechKeys
  const url = `${OAUTH_BASE}/oauth/2.0/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(apiKey)}`
    + `&client_secret=${encodeURIComponent(secretKey)}`

  const res = await fetch(url, { method: 'POST' })
  const data = await res.json() as { access_token?: string, expires_in?: number, error_description?: string }
  if (!data.access_token)
    throw new Error(data.error_description || 'Failed to get Baidu access token')

  cachedToken = data.access_token
  // refresh a minute early to be safe
  tokenExpireAt = now + ((data.expires_in ?? 2592000) - 60) * 1000
  return cachedToken
}

// Stable per-device id required by Baidu for UV counting.
function getCuid(): string {
  const key = 'baidu-speech-cuid'
  let cuid = ''
  try {
    cuid = localStorage.getItem(key) || ''
    if (!cuid) {
      cuid = `weila-work-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(key, cuid)
    }
  }
  catch {
    cuid = `weila-work-${Math.random().toString(36).slice(2)}`
  }
  return cuid
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  let length = 0
  for (const c of chunks) length += c.length
  const merged = new Float32Array(length)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.length
  }
  return merged
}

// Average-based downsample; only used if the AudioContext ignores our 16k request.
function downsample(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (outputRate >= inputRate)
    return buffer

  const ratio = inputRate / outputRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)
  let offsetResult = 0
  let offsetBuffer = 0
  while (offsetResult < newLength) {
    const nextOffset = Math.round((offsetResult + 1) * ratio)
    let accum = 0
    let count = 0
    for (let i = offsetBuffer; i < nextOffset && i < buffer.length; i++) {
      accum += buffer[i]
      count++
    }
    result[offsetResult] = count ? accum / count : 0
    offsetResult++
    offsetBuffer = nextOffset
  }
  return result
}

function floatTo16BitPCM(samples: Float32Array): ArrayBuffer {
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return pcm.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  return btoa(binary)
}

export function useBaiduSpeech() {
  const isRecording = shallowRef(false)
  const isProcessing = shallowRef(false)

  let audioContext: AudioContext | null = null
  let mediaStream: MediaStream | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let processor: ScriptProcessorNode | null = null
  let chunks: Float32Array[] = []

  function teardown() {
    processor?.disconnect()
    source?.disconnect()
    mediaStream?.getTracks().forEach(t => t.stop())
    audioContext?.close().catch(() => {})
    processor = null
    source = null
    mediaStream = null
    audioContext = null
    isRecording.value = false
  }

  async function start(): Promise<void> {
    if (isRecording.value || isProcessing.value)
      return

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })

    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    audioContext = new Ctor({ sampleRate: TARGET_SAMPLE_RATE })
    source = audioContext.createMediaStreamSource(mediaStream)
    processor = audioContext.createScriptProcessor(4096, 1, 1)
    chunks = []

    processor.onaudioprocess = (e) => {
      // copy: the underlying buffer is reused across callbacks
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    }

    source.connect(processor)
    // processor emits silence (we never write output), so no mic feedback
    processor.connect(audioContext.destination)
    isRecording.value = true
  }

  // Stop recording, run recognition, and return the recognized text ('' if none).
  async function stopAndRecognize(): Promise<string> {
    if (!isRecording.value || !audioContext)
      return ''

    const inputRate = audioContext.sampleRate
    const merged = mergeChunks(chunks)
    chunks = []
    teardown()

    if (merged.length === 0)
      return ''

    isProcessing.value = true
    try {
      const resampled = downsample(merged, inputRate, TARGET_SAMPLE_RATE)
      const pcm = floatTo16BitPCM(resampled)
      const token = await getAccessToken()

      const res = await fetch(`${ASR_BASE}/server_api`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          format: 'pcm',
          rate: TARGET_SAMPLE_RATE,
          channel: 1,
          cuid: getCuid(),
          token,
          dev_pid: DEV_PID,
          speech: arrayBufferToBase64(pcm),
          len: pcm.byteLength,
        }),
      })
      const data = await res.json() as { err_no?: number, err_msg?: string, result?: string[] }
      if (data.err_no !== 0)
        throw new Error(data.err_msg || `Baidu ASR error ${data.err_no}`)

      return data.result?.[0] ?? ''
    }
    finally {
      isProcessing.value = false
    }
  }

  function cancel() {
    chunks = []
    teardown()
  }

  tryOnScopeDispose(() => cancel())

  return {
    isRecording,
    isProcessing,
    start,
    stopAndRecognize,
    cancel,
  }
}
