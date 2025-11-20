<script setup lang="ts">
import { shallowRef } from 'vue'

defineProps<{
  loading?: boolean
}>()

const { t } = useI18n()

const showConfirm = shallowRef(false)

function handleConfirm() {
  showConfirm.value = true
}

function handleCancel() {
  showConfirm.value = false
}
</script>

<template>
  <div v-if="!showConfirm" flex gap2>
    <a-button mla type="primary" @click="handleConfirm">
      {{ t('button.submit') }}
    </a-button>
  </div>
  <div v-else flex gap2>
    <a-button mla @click="handleCancel">
      {{ t('button.cancel') }}
    </a-button>
    <a-button type="primary" status="danger" :loading="loading" html-type="submit">
      {{ t('delete-account-form.confirm-submit') }}
    </a-button>
  </div>
</template>
