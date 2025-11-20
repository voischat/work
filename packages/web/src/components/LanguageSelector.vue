<script lang="ts" setup>
import { loadLanguageAsync } from '~/modules/i18n'

const { locale } = useI18n()

const languages = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
]

async function handleLanguageChange(lang: string) {
  await loadLanguageAsync(lang)
  locale.value = lang
}
</script>

<template>
  <a-dropdown trigger="click" position="bl">
    <a-button class="nav-btn" type="outline" shape="circle">
      <template #icon>
        <icon-language />
      </template>
    </a-button>
    <template #content>
      <a-doption
        v-for="lang in languages"
        :key="lang.value"
        :selected="locale === lang.value"
        @click="handleLanguageChange(lang.value)"
      >
        <template #icon>
          <icon-check v-if="locale === lang.value" />
        </template>
        {{ lang.label }}
      </a-doption>
    </template>
  </a-dropdown>
</template>

<style scoped>
.nav-btn {
  cursor: pointer;
}
</style>
