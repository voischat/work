<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { useSound } from '@vueuse/sound'

import { useSpeakerIcon } from '~/composables/useSpeakerIcon'

const props = defineProps<{
  content: {
    url: string
    duration: number
  }
  classes?: string | string[]
}>()

const voiceUrl = computed(() => props.content.url)
const displayDuration = computed(() => props.content.duration || 0)
const displayDurationText = computed(() => displayDuration.value ? `${displayDuration.value}"` : '')

const { data: mp3Url } = useQuery({
  queryKey: computed(() => ['/corp/web/ptturl-to-mp3url', voiceUrl.value]),
  enabled: computed(() => Boolean(voiceUrl.value)),
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  queryFn: () => weilaFetch('/corp/web/ptturl-to-mp3url', {
    body: {
      ptturl: voiceUrl.value,
    },
  }).then((i: any) => i.url as string),
})

const { play: playVoice, isPlaying: isVoicePlaying, pause: pauseVoice } = useSound(computed(() => mp3Url.value || ''))

const { counter, reset: resetCounter, pause: pauseCounter, resume: resumeCounter } = useInterval(100, {
  controls: true,
  immediate: false,
})

watch(counter, (val) => {
  if (props.content.duration && val > props.content.duration * 10)
    stop()
})

watch(voiceUrl, () => {
  pause()
  resetCounter()
})

const { icon, play: playIcon, stop: stopIcon, pause: pauseIcon } = useSpeakerIcon()

function play() {
  playVoice()
  playIcon()
  resumeCounter()
}

function pause() {
  pauseVoice()
  pauseIcon()
  pauseCounter()
}

function stop() {
  pauseCounter()
  resetCounter()
  stopIcon()
}

function click() {
  if (!isVoicePlaying.value)
    play()
  else
    pause()
}
</script>

<template>
  <button
    :class="classes" :color="isVoicePlaying ? 'primary' : ''" flex items-center w="30" gap3 rounded p4 text-lg
    @click="click"
  >
    <template v-if="displayDuration">
      {{ displayDurationText }}
    </template>
    <i :class="icon" inline-block />
  </button>
</template>
