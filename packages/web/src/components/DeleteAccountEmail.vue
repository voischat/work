<script setup lang="ts">
import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'
import * as v from 'valibot'
import { shallowRef } from 'vue'
import { useForm } from 'zod-arco-rules/valibot'
import { useCountDown } from '~/composables/useCountDown'

const emit = defineEmits<{
  (e: 'success'): void
}>()

const { t } = useI18n()

const { form, rules, handleSubmit, reset } = useForm(v.object({
  email: v.pipe(
    v.string(() => t('form.error.email-nonempty')),
    v.email(() => t('form.error.email-format')),
  ),
  verifycode: v.string(() => t('form.error.verify-code-nonempty')),
}))

const qc = useQueryClient()

const { mutate, isPending } = useWeilaMutation('corp/user/unregist-by-email', {
  onSuccess() {
    Message.success(t('message.success'))
    reset()
    qc.invalidateQueries({ queryKey: ['corp/user/get-selfinfo'] })
    emit('success')
  },
})

const submit = handleSubmit((values: any) => {
  mutate(values)
})

const imageAnswer = shallowRef('')
const { data: verifyImageData, refetch: refreshImageCode } = useWeilaFetch<{ id: string, image: string }>(
  'common/get-image-verifycode?width=160&height=80',
  {},
  {
    enabled: true,
  },
)

const { countdown: emailCountdown, isCounting: isEmailActive, updateSendTime: updateEmailSendTime } = useCountDown('email-unregist')

const { mutate: sendEmailVerifyCode, isPending: isSendingEmail } = useWeilaMutation('common/send-email-verifycode', {
  onSuccess() {
    Message.success(t('message.success'))
    updateEmailSendTime()
  },
})

function handleSendEmailCode() {
  if (!form.value.email) {
    Message.warning(t('message.please-enter-email'))
    return
  }

  if (!imageAnswer.value.trim()) {
    Message.warning(t('binding-phone-form.placeholder.image-verifycode'))
    return
  }

  sendEmailVerifyCode({
    email: form.value.email,
    verify_id: verifyImageData.value?.id || '',
    verify_answer: imageAnswer.value.trim(),
    smstype: 'work-unregist',
  })
}

defineExpose({
  reset,
})
</script>

<template>
  <a-form style="margin: 0 auto; width: fit-content;" :model="form" :rules="rules" layout="vertical" @submit="submit">
    <a-form-item field="email" hide-label>
      <a-input
        v-model="form.email"
        :placeholder="t('form.placeholder.email')"
        allow-clear
      >
        <template #prefix>
          <icon-email />
        </template>
      </a-input>
    </a-form-item>

    <a-form-item>
      <div flex gap2>
        <a-input
          v-model="imageAnswer"
          :placeholder="t('img-verify-code')"
          allow-clear
          :max-length="6"
        />
        <img v-if="verifyImageData?.image" :src="verifyImageData.image" w-30 @click="() => refreshImageCode()">
      </div>
    </a-form-item>

    <a-form-item field="verifycode">
      <div flex gap2>
        <a-input
          v-model="form.verifycode"
          :placeholder="t('verify-code')"
          allow-clear
        />
        <a-button
          type="primary"
          :loading="isSendingEmail"
          :disabled="!(form.email && imageAnswer) || isEmailActive"
          min-w-30
          @click="handleSendEmailCode"
        >
          {{ isEmailActive ? `${emailCountdown}s` : $t('get-email-code') }}
        </a-button>
      </div>
    </a-form-item>

    <a-form-item>
      <div w-full>
        <ConfirmButtonGroup mr0 :loading="isPending" />
      </div>
    </a-form-item>
  </a-form>
</template>
