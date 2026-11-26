<script setup lang="ts">
import { EMOJI_TOKENS } from '@weila/shared'
import { Dropdown } from 'floating-vue'
import WLEmoji from './WLEmoji.vue'

const emit = defineEmits<{
  select: [emoji: string]
}>()

function selectAndHide(emoji: string, hide: () => void) {
  handleSelect(emoji)
  hide()
}

function handleSelect(emoji: string) {
  emit('select', emoji)
}
</script>

<template>
  <Dropdown class="emoji-picker-dropdown" :distance="8" placement="top-start">
    <button class="emoji-trigger" type="button">
      <span class="icon-[carbon--face-neutral] text-xl"></span>
    </button>

    <template #popper="{ hide }">
      <div class="emoji-grid">
        <button
          v-for="token in EMOJI_TOKENS"
          :key="token"
          class="emoji-item"
          type="button"
          @click="selectAndHide(token, hide)"
        >
          <WLEmoji :name="token" :size="28" />
        </button>
      </div>
    </template>
  </Dropdown>
</template>

<style scoped>
.emoji-trigger {
  padding: 0.5rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  transition: background-color 0.2s;
}

.emoji-trigger:hover {
  background-color: rgb(243 244 246);
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 36px);
  gap: 4px;
  padding: 8px;
  width: 344px;
  box-sizing: border-box;
}

.emoji-item {
  padding: 0.25rem;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.emoji-item:hover {
  background-color: rgb(243 244 246);
}
</style>

<style>
.emoji-picker-dropdown .v-popper__arrow-inner,
.emoji-picker-dropdown .v-popper__arrow-outer {
  display: none;
}
</style>
