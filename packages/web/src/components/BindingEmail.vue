<script setup lang="ts">
import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'
import * as v from 'valibot'
import { shallowRef } from 'vue'
import { useForm } from 'zod-arco-rules/valibot'
import { useCountDown } from '~/composables/useCountDown'

const { t } = useI18n()

const open = defineModel('open', { default: false })

const { form, rules, handleSubmit, reset } = useForm(v.object({
  email: v.pipe(
    v.string(() => t('binding-email-form.err-msg.email-required')),
    v.email(() => t('binding-email-form.err-msg.email-format')),
  ),
  verifycode: v.pipe(
    v.string(() => t('binding-email-form.err-msg.verifycode-required')),
    v.minLength(4, () => t('binding-email-form.err-msg.verifycode-min')),
    v.maxLength(6, () => t('binding-email-form.err-msg.verifycode-max')),
  ),
}))

watchEffect(() => open.value && reset())

const qc = useQueryClient()

const { mutate, isPending } = useWeilaMutation('corp/user/bind-email', {
  onSuccess() {
    open.value = false
    Message.success(t('message.success'))
    reset()
    qc.invalidateQueries({ queryKey: ['corp/user/get-selfinfo'] })
  },
})

const submit = handleSubmit((values: any) => {
  mutate(values)
})

const verifyImageAnswer = shallowRef('')
const { data: verifyImageData, refetch: refreshImageCode } = useWeilaFetch<{ id: string, image: string }>(
  'common/get-image-verifycode?width=160&height=80',
  {},
  {
    enabled: open,
  },
)

const { countdown: emailCountdown, isCounting: isEmailActive, updateSendTime: updateEmailSendTime } = useCountDown('email-bind')

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

  if (!verifyImageAnswer.value) {
    Message.warning(t('message.please-enter-image-verifycode'))
    return
  }

  sendEmailVerifyCode({
    email: form.value.email,
    verify_id: verifyImageData.value?.id || '',
    verify_answer: verifyImageAnswer.value,
    smstype: 'work-bind-email',
  })
}
</script>

<template>
  <a-modal v-model:visible="open" :footer="false">
    <template #title>
      <div>{{ t('binding-email-form.title') }}</div>
    </template>

    <p mx4 mb8 text-neutral>
      {{ $t('binding-email-hint') }}
    </p>

    <a-form style="margin: 0 auto; width: fit-content;" :model="form" :rules="rules" layout="vertical" @submit="submit">
      <a-form-item field="email" hide-label>
        <a-input
          v-model="form.email"
          :placeholder="t('binding-email-form.placeholder.email')"
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
            v-model="verifyImageAnswer"
            :placeholder="t('binding-email-form.placeholder.image-verifycode')"
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
            :placeholder="t('binding-email-form.placeholder.verifycode')"
            allow-clear
          />
          <a-button
            type="primary"
            :loading="isSendingEmail"
            :disabled="!form.email || !verifyImageAnswer || isEmailActive"
            min-w-30
            @click="handleSendEmailCode"
          >
            {{ isEmailActive ? `${emailCountdown}s` : $t('get-email-code') }}
          </a-button>
        </div>
      </a-form-item>

      <a-form-item>
        <a-button mla type="primary" html-type="submit" :loading="isPending">
          {{ t('button.submit') }}
        </a-button>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
