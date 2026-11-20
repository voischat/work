<script setup lang="ts">
import Message from '@arco-design/web-vue/es/message'
import * as v from 'valibot'

import { shallowRef } from 'vue'
import { useForm } from 'zod-arco-rules/valibot'

const emit = defineEmits<{
  success: []
}>()

const { t } = useI18n()

const open = shallowRef(false)

const { form, rules, handleSubmit, reset } = useForm(v.object({
  name: v.pipe(v.string(() => t('form.error.name-nonempty'))),
}))

const { mutate: createApp, isPending } = useWeilaMutation<unknown, { name: string }>('corp/api/manage/create-app', {
  onSuccess() {
    reset()
    Message.success(t('message.success'))
    emit('success')
    open.value = false
  },
})

watch(open, (visible) => {
  if (visible)
    reset()
})

const submit = handleSubmit(() => {
  createApp({ name: form.value.name })
})
</script>

<template>
  <a-button type="primary" @click="open = true">
    {{ t('application.create') }}
  </a-button>
  <a-modal v-model:visible="open" :title="t('application.create')" :footer="false">
    <a-form :rules :model="form" auto-label-width @submit="submit">
      <a-form-item field="name" :label="t('application.name-label')">
        <a-input v-model="form.name" :max-length="20" show-word-limit />
      </a-form-item>
      <a-form-item>
        <a-button mla html-type="submit" type="primary" :loading="isPending">
          {{ t('button.submit') }}
        </a-button>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
