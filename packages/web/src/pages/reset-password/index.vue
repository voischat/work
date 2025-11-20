<script setup lang="ts">
import type { SendVerifySmsBody } from '~/api/verify-sms'
import { Message } from '@arco-design/web-vue'
import md5 from 'md5'
import * as v from 'valibot'
import { shallowRef } from 'vue'
import { useForm } from 'zod-arco-rules/valibot'
import { useCountDown } from '~/composables/useCountDown'

definePage({
  meta: {
    layout: 'first',
    requiresAuth: false,
  },
})

const { t } = useI18n()
const router = useRouter()

const activeTab = shallowRef<'phone' | 'email'>('email')

const { form, rules, handleSubmit } = useForm(v.object({
  phone: v.pipe(
    v.string(() => t('form-error.phone-required')),
    v.minLength(11, () => t('form-error.phone-min-length')),
    v.maxLength(11, () => t('form-error.phone-max-length')),
  ),
  country_code: v.optional(v.string(), '86'),
  verifycode: v.pipe(v.string(() => t('form-error.verifycode-required'))),
  password: v.string(() => t('form-error.password-required')),
}))

const { form: emailForm, rules: emailRules, handleSubmit: handleEmailSubmit } = useForm(v.object({
  email: v.pipe(
    v.string(() => t('form.error.email-nonempty')),
    v.email(() => t('form.error.email-format')),
  ),
  verifycode: v.pipe(v.string(() => t('form-error.verifycode-required'))),
  password: v.string(() => t('form-error.password-required')),
}))
const { data, refetch: refreshImageCode } = useWeilaFetch<{ id: string, image: string }>('common/get-image-verifycode?width=160&height=80')

const { mutate: sendSmsVerifyCode, isPending: isSendingSms } = useWeilaMutation<never, SendVerifySmsBody>('common/send-sms-verifycode')
const { mutateAsync: sendEmailVerifyCode, isPending: isSendingEmail } = useWeilaMutation<never, {
  email: string
  verify_id: string
  verify_answer: string
  smstype: string
}>('common/send-email-verifycode')

const imageCode = shallowRef('')

const { mutate: resetPassword, isPending: isSubmiting } = useWeilaMutation('/corp/auth/reset-password', {
  onSuccess() {
    Message.success(t('message.success'))
    router.push('/login')
  },
})

const { mutate: resetPasswordByEmail, isPending: isEmailSubmiting } = useWeilaMutation('/corp/auth/reset-password-by-email', {
  onSuccess() {
    Message.success(t('message.success'))
    router.push('/login')
  },
})

const { countdown, isCounting: isActive, updateSendTime } = useCountDown('sms-reset-password')
const { countdown: emailCountdown, isCounting: isEmailActive, updateSendTime: updateEmailSendTime } = useCountDown('email-reset-password')

const submit = handleSubmit((values: any) => {
  resetPassword({
    ...values,
    password: md5(values.password),
  })
})

function handleSendSmsCode() {
  if (!data.value?.id) {
    Message.error(t('message.verify-code-error'))
    return
  }

  if (!imageCode.value.trim()) {
    Message.warning(t('binding-phone-form.placeholder.image-verifycode'))
    return
  }

  if (!form.value.phone) {
    Message.error(t('message.get-phone-error'))
    return
  }

  sendSmsVerifyCode({
    phone: form.value.phone,
    countrycode: form.value.country_code || '86',
    verify_id: data.value.id,
    verify_answer: imageCode.value.trim(),
    smstype: 'work-reset-password',
  }, {
    onSuccess: () => {
      Message.success(t('message.success'))
      // 更新发送时间，启动倒计时
      updateSendTime()
    },
  })
}

const emailSubmit = handleEmailSubmit((values: any) => {
  resetPasswordByEmail({
    email: values.email,
    verifycode: values.verifycode,
    password: md5(values.password),
  })
})

function handleSendEmailCode() {
  if (!data.value?.id) {
    Message.error(t('message.verify-code-error'))
    return
  }

  if (!imageCode.value.trim()) {
    Message.warning(t('binding-phone-form.placeholder.image-verifycode'))
    return
  }

  if (!emailForm.value.email) {
    Message.warning(t('message.please-enter-email'))
    return
  }

  sendEmailVerifyCode({
    email: emailForm.value.email,
    verify_id: data.value.id,
    verify_answer: imageCode.value.trim(),
    smstype: 'work-reset-password',
  }, {
    onSuccess: () => {
      Message.success(t('message.success'))
      // 更新发送时间，启动倒计时
      updateEmailSendTime()
    },
  })
}
</script>

<template>
  <div class="reset-password-form-wrapper">
    <div class="reset-password-form-title" mb-4>
      {{ t('reset-password-form.title') }}
    </div>

    <a-tabs v-model:active-key="activeTab">
      <a-tab-pane v-if="false" key="phone" :title="t('reset-password-by-phone')">
        <a-form :model="form" :rules="rules" layout="vertical" @submit="submit">
          <a-form-item field="phone" hide-label>
            <a-input-group>
              <a-select v-model="form.country_code" style="width: 90px" :placeholder="t('binding-phone-form.placeholder.country-code')">
                <a-option value="86" label="+86" />
                <a-option value="852" label="+852" />
                <a-option value="853" label="+853" />
                <a-option value="886" label="+886" />
              </a-select>
              <a-input
                v-model="form.phone"
                :placeholder="t('phone')"
                allow-clear
              />
            </a-input-group>
          </a-form-item>

          <a-form-item>
            <a-space>
              <a-input
                v-model="imageCode"
                allow-clear
                :max-length="6"
                :placeholder="t('binding-phone-form.placeholder.image-verifycode')"
              />
              <img v-if="data?.image" :src="data.image" min-w-30 @click="() => refreshImageCode()">
            </a-space>
          </a-form-item>

          <a-form-item field="verifycode" hide-label>
            <a-input
              v-model="form.verifycode"
              :placeholder="$t('verify-code')"
              allow-clear
              pr0
            >
              <template #suffix>
                <a-button
                  type="text"
                  :loading="isSendingSms"
                  :disabled="!(form.phone && imageCode) || isActive"
                  @click="handleSendSmsCode"
                >
                  {{ isActive ? `${countdown}s` : $t('get-sms-code') }}
                </a-button>
              </template>
            </a-input>
          </a-form-item>

          <a-form-item field="password" hide-label>
            <a-input-password
              v-model="form.password"
              :placeholder="t('form-placeholder.please-enter-new-password')"
              allow-clear
            />
          </a-form-item>

          <a-button type="primary" html-type="submit" :loading="isSubmiting" long>
            {{ t('button.submit') }}
          </a-button>
          <a-button type="text" long mt-4 @click="() => router.go(-1)">
            {{ t('button.login') }}
          </a-button>
        </a-form>
      </a-tab-pane>
      <a-tab-pane key="email" :title="t('reset-password-by-email')">
        <a-form :model="emailForm" :rules="emailRules" layout="vertical" @submit="emailSubmit">
          <a-form-item field="email" hide-label>
            <a-input
              v-model="emailForm.email"
              :placeholder="t('form.placeholder.email')"
              allow-clear
            >
              <template #prefix>
                <icon-email />
              </template>
            </a-input>
          </a-form-item>

          <a-form-item>
            <a-space>
              <a-input
                v-model="imageCode"
                allow-clear
                :max-length="6"
                :placeholder="t('binding-phone-form.placeholder.image-verifycode')"
              />
              <img v-if="data?.image" :src="data.image" min-w-30 @click="() => refreshImageCode()">
            </a-space>
          </a-form-item>

          <a-form-item field="verifycode" hide-label>
            <a-input
              v-model="emailForm.verifycode"
              :placeholder="$t('verify-code')"
              allow-clear
              pr0
            >
              <template #suffix>
                <a-button
                  type="text"
                  :loading="isSendingEmail"
                  :disabled="!(emailForm.email && imageCode) || isEmailActive"
                  @click="handleSendEmailCode"
                >
                  {{ isEmailActive ? `${emailCountdown}s` : $t('get-email-code') }}
                </a-button>
              </template>
            </a-input>
          </a-form-item>

          <a-form-item field="password" hide-label>
            <a-input-password
              v-model="emailForm.password"
              :placeholder="t('form-placeholder.please-enter-new-password')"
              allow-clear
            />
          </a-form-item>

          <a-button type="primary" html-type="submit" :loading="isEmailSubmiting" long>
            {{ t('button.submit') }}
          </a-button>
          <a-button type="text" long mt-4 @click="() => router.go(-1)">
            {{ t('button.login') }}
          </a-button>
        </a-form>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style lang="less" scoped>
.reset-password-form {
  &-wrapper {
    width: 320px;
  }

  &-title {
    color: var(--color-text-1);
    font-weight: 500;
    font-size: 24px;
    line-height: 32px;
  }
}
</style>
