<script setup lang="ts">
import type { Legal } from '~/types/api'

interface Props {
  /** 是否显示完整状态（包含企业/个人类型） */
  showFullStatus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showFullStatus: false,
})

const { t } = useI18n()

const { data: legal } = useWeilaFetch<Legal>('corp/legal/get-legal')
</script>

<template>
  <!-- 显示完整状态（用于 org.vue） -->
  <template v-if="showFullStatus">
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

  <!-- 显示简化状态（用于 SideBar.vue） -->
  <template v-else>
    <a-tag v-if="legal?.state === 8" color="orangered">
      <template #icon>
        <icon-check-circle-fill />
      </template>
      {{ t('auth.certified') }}
    </a-tag>
    <a-tag v-else>
      {{ t('org.unauth') }}
    </a-tag>
  </template>
</template>