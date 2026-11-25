<script lang="ts" setup>
import { useRouter } from 'vue-router'

definePage({
  meta: {
    requiresAuth: false,
  },
})

const { t } = useI18n()

const router = useRouter()
function back() {
  router.push('/contact/org')
}
</script>

<template>
  <div class="content">
    <a-result class="result" status="404" subtitle="not found" />
    <div class="operation-row">
      <a-button key="back" type="primary" @click="back">
        {{ t('button.back') }}
      </a-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.content {
  position: absolute;
  top: 50%;
  left: 50%;
  margin-left: -95px;
  margin-top: -121px;
  text-align: center;
}
</style>
