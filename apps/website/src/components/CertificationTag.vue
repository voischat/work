<script setup lang="ts">
import type { Legal } from '~/types/api'

const { t } = useI18n()

const isOwner = computed(() => storeToRefs(useSelfInfoStore()).isOwner.value)

const { data: legal } = useWeilaFetch<Legal>('corp/legal/get-legal', {}, {
  enabled: isOwner,
})
</script>

<template>
  <a-tag v-if="legal?.state === 8" color="orangered">
    <template #icon>
      <icon-check-circle-fill />
    </template>
    {{ $t('adt', [legal.category === 0 ? t('org.enterprise') : t('org.personal')]) }}
  </a-tag>
  <a-tag v-else-if="legal?.state === 9">
    {{ $t('org.auth-failed') }}
  </a-tag>
  <a-tag v-else>
    {{ $t('org.unauth') }}
  </a-tag>
</template>
