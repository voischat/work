<script setup lang="ts">
import { computed } from 'vue'
import type { WL_AudioMsgData } from '@vois/weila-sdk-core'
import { calculateAudioDuration } from '@vois/weila-sdk-core'

export interface WlAudioBubbleProps {
  msg: WL_AudioMsgData
  isSelf?: boolean
  playing?: boolean
  paused?: boolean
  progressMs?: number | null
}

const props = withDefaults(defineProps<WlAudioBubbleProps>(), {
  isSelf: false,
  playing: false,
  paused: false,
  progressMs: null,
})

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
}>()

const duration = computed(() => calculateAudioDuration(props.msg.audioData.frameCount))

const handleClick = () => {
  if (props.playing && !props.paused) {
    emit('pause')
  } else {
    emit('play')
  }
}

const hasDuration = computed(() => duration.value > 0)
const formattedDuration = computed(() => `${Math.floor(duration.value)}"`)

function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatElapsed(ms: number, totalMs: number): string {
  if (totalMs >= 60_000) return formatClock(ms)

  const tenths = Math.floor((ms % 1000) / 100)
  const totalSeconds = Math.floor(ms / 1000)

  return `${formatClock(totalSeconds * 1000)}.${tenths}`
}

const timeLabel = computed(() => {
  if (props.playing || props.paused) {
    if (props.progressMs === null || !hasDuration.value) return ''

    const totalMs = duration.value * 1000

    return `${formatElapsed(props.progressMs, totalMs)} / ${formatClock(totalMs)}`
  }

  return hasDuration.value ? formattedDuration.value : ''
})

const animating = computed(() => props.playing && !props.paused)
</script>

<template>
  <div
    class="rounded-xl overflow-hidden cursor-pointer"
    :class="isSelf ? 'bg-blue-500' : 'bg-white'"
    @click="handleClick"
  >
    <div
      class="flex items-center gap-2 px-3 py-2 text-sm select-none transition-colors group w-fit"
      :class="isSelf ? 'text-white flex-row-reverse' : 'text-neutral-900 flex-row'"
    >
      <div class="shrink-0 flex items-center justify-center">
        <span v-if="animating" class="icon-[carbon--pause-filled] size-5"></span>
        <span v-else class="icon-[carbon--play-filled] size-5"></span>
      </div>

      <div
        class="flex items-center gap-0.75 grow h-4"
        :class="isSelf ? 'justify-end' : 'justify-start'"
      >
        <div
          class="wl-audio-bar"
          :class="{
            'wl-audio-bar-playing': animating,
            'bg-white': isSelf,
            'bg-neutral-900': !isSelf,
          }"
          style="--wl-delay: 0s"
        ></div>
        <div
          class="wl-audio-bar"
          :class="{
            'wl-audio-bar-playing': animating,
            'bg-white': isSelf,
            'bg-neutral-900': !isSelf,
          }"
          style="--wl-delay: -0.2s"
        ></div>
        <div
          class="wl-audio-bar"
          :class="{
            'wl-audio-bar-playing': animating,
            'bg-white': isSelf,
            'bg-neutral-900': !isSelf,
          }"
          style="--wl-delay: -0.4s"
        ></div>
        <div
          class="wl-audio-bar"
          :class="{
            'wl-audio-bar-playing': animating,
            'bg-white': isSelf,
            'bg-neutral-900': !isSelf,
          }"
          style="--wl-delay: -0.6s"
        ></div>
      </div>

      <div v-if="timeLabel" class="shrink-0 font-medium pl-1">
        {{ timeLabel }}
      </div>
    </div>
  </div>
</template>

<style>
.wl-audio-bar {
  width: 2px;
  height: 4px;
  border-radius: 2px;
  transition: height 0.2s ease;
}

.wl-audio-bar-playing {
  animation: wl-audio-wave 0.8s ease-in-out infinite;
  animation-delay: var(--wl-delay);
}

@keyframes wl-audio-wave {
  0%,
  100% {
    height: 4px;
  }

  50% {
    height: 14px;
  }
}
</style>
