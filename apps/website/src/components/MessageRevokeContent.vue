<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <p mt1 max-w-40vw w-fit break-words rounded p4 color-neutral>
    [{{ t('message.revoke') }}]
  </p>
</template>
