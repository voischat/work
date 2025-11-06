<script setup lang="ts">
import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'
import { shallowRef, useTemplateRef } from 'vue'
import DeleteAccountEmail from './DeleteAccountEmail.vue'
import DeleteAccountPhone from './DeleteAccountPhone.vue'

const { t } = useI18n()

const open = defineModel('open', { default: false })

const activeTab = shallowRef<'phone' | 'email'>('phone')

const qc = useQueryClient()

const authStore = useAuthStore()

const phoneComponentRef = useTemplateRef('phoneComponent')
const emailComponentRef = useTemplateRef('emailComponent')

function handleSuccess() {
  open.value = false
  Message.success(t('message.success'))
  qc.invalidateQueries({ queryKey: ['corp/user/get-selfinfo'] })

  authStore.logout()
  window.location.reload()
}

watch(open, (value) => {
  if (value) {
    // Reset both components when modal opens
    phoneComponentRef.value?.reset?.()
    emailComponentRef.value?.reset?.()
  }
})
</script>

<template>
  <a-modal v-model:visible="open" :footer="false">
    <template #title>
      <div>{{ t('delete-account-form.title') }}</div>
    </template>

    <a-tabs v-model:active-key="activeTab">
      <a-tab-pane key="phone" :title="t('login-by-phone')">
        <DeleteAccountPhone
          ref="phoneComponent"
          @success="handleSuccess"
        />
      </a-tab-pane>

      <a-tab-pane key="email" :title="t('login-by-email')">
        <DeleteAccountEmail
          ref="emailComponent"
          @success="handleSuccess"
        />
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>
