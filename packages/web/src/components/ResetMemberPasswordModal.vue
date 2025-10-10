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
  <a-modal v-model:visible="open" :title="t('reset-password.button')" :footer="false">
    <a-descriptions
      v-if="member"
      :column="1"
      :data="[
        { label: t('name'), value: member.name },
        { label: t('weila-number'), value: member.user_num },
        { label: t('job-number'), value: member.job_num },
        { label: t('phone-number'), value: member.phone },
      ].filter(i => i.value)"
      bordered
      mb4
    />
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
  </a-modal>
</template>
