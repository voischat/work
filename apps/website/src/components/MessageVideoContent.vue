<script setup lang="ts">
import { VideoPlayer } from '@videojs-player/vue'
import { shallowRef } from 'vue'

defineProps<{
  content: {
    image: string
    video_url: string
    video_size: number
    video_name: string
  }
}>()

const visible = shallowRef(false)
</script>

<template>
  <TheModal v-model:open="visible" :title="content.video_name" classes="container">
    <div relative of-hidden rounded>
      <img max-size-80 min-size-60 :src="`${content.video_url}?x-oss-process=video/snapshot,t_0,f_jpg,m_fast,w_160`" alt="cover">
      <i i-ph-play-circle-duotone absolute position-center ma block size-16 />
    </div>
    <template #content>
      <VideoPlayer
        autoplay
        :src="content.video_url" class="video-player vjs-big-play-centered h75vh rounded"
        :poster="content.image" crossorigin="anonymous" controls playsinline :volume="0.6" :height="320"
        :playback-rates="[0.7, 1.0, 1.5, 2.0]" :prefer-full-window="true"
      />
    </template>
  </TheModal>
</template>

<style scoped>
.video-player {
  background-color: black;
  width: 100%;
}
</style>
