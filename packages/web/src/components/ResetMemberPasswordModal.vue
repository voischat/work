<script setup lang="ts">
import type { Member } from '~/types/api'
import Message from '@arco-design/web-vue/es/message'
import md5 from 'md5'
import * as v from 'valibot'
import { useForm } from 'zod-arco-rules/valibot'

const props = defineProps<{
  member?: Member
}>()

const { t } = useI18n()

const open = defineModel('open', { default: false })

const { form, handleSubmit, rules, reset } = useForm(v.object({
  password: v.pipe(v.string(() => t('form.error.password-nonempty'))),
  user_id: v.optional(v.number(), () => props.member?.user_id),
}))

watchEffect(() => open.value && reset())

const { mutate, isPending } = useWeilaMutation('corp/address/reset-member-password', {
  onSuccess() {
    Message.success(t('message.success'))
    reset()
    open.value = false
  },
})

const submit = handleSubmit((values: any) => {
  mutate({
    ...values,
    password: md5(values.password),
  })
})
</script>

<template>
  <ModalTrigger v-model:open="open" :title=" t('reset-password.button') ">
    <slot />
    <template #content>
      <a-form :model="form" :rules @submit="submit">
        <a-form-item field="password" :label="t('password')">
          <a-input v-model="form.password" :max-length="20" show-word-limit type="password" />
        </a-form-item>
        <a-form-item>
          <a-button mla type="primary" :loading="isPending" html-type="submit">
            {{ t('button.submit') }}
          </a-button>
        </a-form-item>
      </a-form>
    </template>
  </ModalTrigger>
</template>
