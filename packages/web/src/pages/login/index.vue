<script lang="ts" setup>
import type { SendVerifySmsBody } from '~/api/verify-sms'
import type { AuthModel } from '~/stores/auth'
import type { Corp } from '~/types'
import { Message } from '@arco-design/web-vue'
import md5 from 'md5'
import * as v from 'valibot'
import { shallowRef } from 'vue'
import { useForm } from 'zod-arco-rules/valibot'
import { useCountDown } from '~/composables/useCountDown'
import { useLocalCrypto } from '~/composables/useLocalCrypto'
import { autoLogin } from '~/shared/states'

definePage({
  meta: {
    layout: 'first',
    requiresAuth: false,
  },
})

const authStore = useAuthStore()
const router = useRouter()
const accountHistoryRecord = useLocalCrypto('account-history-record')
const tempAccount = useLocalCrypto('temp-account')

const { t } = useI18n()
const activeTab = shallowRef<'password' | 'sms' | 'email'>('password')

const { form: loginForm, rules: loginRules, handleSubmit: handleLogin } = useForm(v.object({
  account: v.string(() => t('form.error.account-nonempty')),
  password: v.string(() => t('form.error.password-nonempty')),
}))

const { form: smsLoginForm, rules: smsLoginRules, handleSubmit: handleSmsLogin } = useForm(v.object({
  phone: v.string(() => t('form.error.phone-nonempty')),
  country_code: v.optional(v.string(), '86'),
  verifycode: v.string(() => t('form.error.verify-code-nonempty')),
}))

const { form: emailLoginForm, rules: emailLoginRules, handleSubmit: handleEmailLogin } = useForm(v.object({
  email: v.pipe(
    v.string(() => t('form.error.email-nonempty')),
    v.email(() => t('form.error.email-format')),
  ),
  verifycode: v.string(() => t('form.error.verify-code-nonempty')),
}))

$inspect(activeTab)

const { data, refetch: refreshImageCode } = useWeilaFetch<{ id: string, image: string }>(
  'common/get-image-verifycode?width=160&height=80',
  {},
  {
    enabled: () => activeTab.value === 'sms' || activeTab.value === 'email',
  },
)

const { mutateAsync: sendSmsVerifyCode, isPending: isSendingSms } = useWeilaMutation<never, SendVerifySmsBody>('common/send-sms-verifycode')
const { mutateAsync: sendEmailVerifyCode, isPending: isSendingEmail } = useWeilaMutation<never, {
  email: string
  verify_id: string
  verify_answer: string
  smstype: string
}>('common/send-email-verifycode')

const imageCodeModalVisible = shallowRef(false)
const imageCode = shallowRef('')
const { countdown: smsCountdown, isCounting: isSmsActive, updateSendTime: updateSmsSendTime } = useCountDown('sms-login')
const { countdown: emailCountdown, isCounting: isEmailActive, updateSendTime: updateEmailSendTime } = useCountDown('email-login')

watchEffect(() => imageCodeModalVisible.value && refreshImageCode())

const [isRememberPassword, toggleRememberPassword] = useToggle(false)
const privacyAgreed = shallowRef(false)

const { mutateAsync: passwordLogin, isPending: passwordPending } = useWeilaMutation('/corp/auth/login', {
  onSuccess,
  onError: () => {
    // 帐号密码登录失败后，清除自动登录相关缓存，防止无限重试
    autoLogin.value = false
    tempAccount.value.clear()
  },
})

const { mutateAsync: smsLogin, isPending: smsPending } = useWeilaMutation('/corp/auth/login-by-sms', {
  onSuccess,
})

const { mutateAsync: emailLogin, isPending: emailPending } = useWeilaMutation('/corp/auth/login-by-email', {
  onSuccess,
})

// 自动登录尝试标志，确保只尝试一次
const autoLoginAttempted = shallowRef(false)

if (autoLogin.value && tempAccount.value.size && !autoLoginAttempted.value) {
  autoLoginAttempted.value = true
  passwordLogin({
    account: tempAccount.value.get('account'),
    password: tempAccount.value.get('password'),
  })
}

function onSuccess({ access_token, expires_in, refresh_token, org, account }: AuthModel & {
  org?: Corp
  account: {
    user_number: string
    password: string
    country_code: string
  }
}) {
  authStore.$patch({
    token: access_token,
    expiresIn: expires_in,
    refreshToken: refresh_token,
    loginTime: Date.now(),
  })

  tempAccount.value.set('account', account.user_number)
  tempAccount.value.set('password', account.password)
  autoLogin.value = true

  if (activeTab.value === 'password' && isRememberPassword.value) {
    accountHistoryRecord.value.set(loginForm.value.account, loginForm.value.password)
  }

  nextTick(() => {
    if (!org)
      router.push('/create-org')
    else
      router.replace('/contact/org')
  })
}

function handleSendSmsCode() {
  if (!data.value?.id) {
    Message.error(t('message.verify-code-error'))
    return
  }

  if (!imageCode.value.trim()) {
    Message.warning(t('binding-phone-form.placeholder.image-verifycode'))
    return
  }

  if (!smsLoginForm.value.phone) {
    Message.error(t('message.get-phone-error'))
    return
  }

  if (!smsLoginForm.value.phone) {
    Message.warning(t('message.please-enter-phone-number'))
    return
  }

  sendSmsVerifyCode({
    phone: smsLoginForm.value.phone,
    countrycode: smsLoginForm.value.country_code || '86',
    verify_id: data.value.id,
    verify_answer: imageCode.value.trim(),
    smstype: 'work-login',
  }, {
    onSuccess: () => {
      Message.success(t('message.success'))
      // 更新发送时间，启动倒计时
      updateSmsSendTime()
    },
  })
}

function handleSendEmailCode() {
  if (!data.value?.id) {
    Message.error(t('message.verify-code-error'))
    return
  }

  if (!imageCode.value.trim()) {
    Message.warning(t('binding-phone-form.placeholder.image-verifycode'))
    return
  }

  if (!emailLoginForm.value.email) {
    Message.warning(t('message.please-enter-email'))
    return
  }

  sendEmailVerifyCode({
    email: emailLoginForm.value.email,
    verify_id: data.value.id,
    verify_answer: imageCode.value.trim(),
    smstype: 'work-login',
  }, {
    onSuccess: () => {
      Message.success(t('message.success'))
      // 更新发送时间，启动倒计时
      updateEmailSendTime()
    },
  })
}

const login = handleLogin((values: any) => {
  if (!privacyAgreed.value) {
    Message.error(t('form.error.privacy-agreement-required'))
    return
  }
  passwordLogin({ ...values, password: md5(values.password) })
})

const loginBySms = handleSmsLogin((values: any) => {
  if (!privacyAgreed.value) {
    Message.error(t('form.error.privacy-agreement-required'))
    return
  }
  smsLogin(values)
})

const loginByEmail = handleEmailLogin((values: any) => {
  if (!privacyAgreed.value) {
    Message.error(t('form.error.privacy-agreement-required'))
    return
  }
  emailLogin(values)
})

// onMounted(async () => {
//   const form = document.querySelector('form')
//   form?.setAttribute('autocomplete', 'on')
// })
</script>

<template>
  <div class="login-form-wrapper">
    <div text-10 text-center leading-loose my8 font-semibold>
      {{ $t('project-name') }}
    </div>
    <div class="login-form-title" mb-4 color-neutral-500>
      {{ t('login.form.title') }}
    </div>
    <a-tabs v-model:active-key="activeTab">
      <a-tab-pane key="password" :title="t('login-by-password')">
        <a-form :model="loginForm" :rules="loginRules" class="login-form" layout="vertical" @submit="login">
          <a-form-item field="account" hide-label>
            <a-auto-complete
              v-model="loginForm.account" :data="Array.from(accountHistoryRecord.keys())"
              :placeholder="t('login.form.account.placeholder')" allow-clear relative
              @select="(account: string) => loginForm.password = accountHistoryRecord.get(account) || loginForm.password"
            >
              <template #option="{ data: { label } }">
                <div w-full flex justify-between>
                  <span>
                    {{ label }}
                  </span>
                </div>
              </template>
            </a-auto-complete>
          </a-form-item>
          <a-form-item field="password" hide-label>
            <a-input-password
              v-model="loginForm.password"
              :input-attrs="{ password: 'password', autocomplete: 'current-password' }"
              :placeholder="t('login.form.password.placeholder')" allow-clear :invisible-button="false"
            >
              <template #prefix>
                <icon-lock />
              </template>
            </a-input-password>
          </a-form-item>
          <a-space :size="16" direction="vertical">
            <div class="login-form-password-actions">
              <a-checkbox
                checked="rememberPassword" :model-value="isRememberPassword"
                @change="() => toggleRememberPassword()"
              >
                {{ t('login.form.rememberPassword') }}
              </a-checkbox>
              <RouterLink to="/reset-password">
                <a-link>{{ t('login.form.forgetPassword') }}</a-link>
              </RouterLink>
            </div>
            <div flex="~ justify-between">
              <a-checkbox v-model="privacyAgreed">
                {{ $t('i-have-read-and-agree') }}
              </a-checkbox>

              <a-link href="https://www.voiswork.cn/common/corp-web/privacy-en">
                {{ t('privacy-agreement') }}
              </a-link>
            </div>
            <a-button type="primary" html-type="submit" long :loading="passwordPending" :disabled="!privacyAgreed">
              {{ t('login.form.login') }}
            </a-button>
          </a-space>
        </a-form>
      </a-tab-pane>
      <a-tab-pane v-if="false" key="sms" :title="t('login-by-phone')">
        <a-form :model="smsLoginForm" :rules="smsLoginRules" class="login-form" layout="vertical" @submit="loginBySms">
          <a-form-item field="phone" hide-label>
            <a-input-group flex w-full>
              <a-select v-model="smsLoginForm.country_code" w-fit>
                <a-option value="86" label="+86" />
                <!-- <a-option value="852" label="+852" />
                <a-option value="853" label="+853" />
                <a-option value="886" label="+886" /> -->
              </a-select>
              <a-input
                v-model="smsLoginForm.phone"
                flex-1
                :placeholder="t('binding-phone-form.placeholder.phone')"
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
            <a-input v-model="smsLoginForm.verifycode" allow-clear pr0>
              <template #suffix>
                <a-button
                  type="text"
                  :loading="isSendingSms"
                  :disabled="!(smsLoginForm.phone && imageCode) || isSmsActive"
                  @click="handleSendSmsCode"
                >
                  {{ isSmsActive ? `${smsCountdown}s` : $t('get-sms-code') }}
                </a-button>
              </template>
            </a-input>
          </a-form-item>
          <a-space :size="16" direction="vertical">
            <div flex="~ justify-between">
              <a-checkbox v-model="privacyAgreed">
                {{ $t('i-have-read-and-agree') }}
              </a-checkbox>

              <a-link href="https://www.voiswork.cn/common/corp-web/privacy-en">
                {{ t('privacy-agreement') }}
              </a-link>
            </div>
            <a-button type="primary" html-type="submit" long :loading="smsPending" :disabled="!privacyAgreed">
              {{ t('login.form.login') }}
            </a-button>
          </a-space>
        </a-form>
      </a-tab-pane>
      <a-tab-pane key="email" :title="t('login-by-email')">
        <a-form :model="emailLoginForm" :rules="emailLoginRules" class="login-form" layout="vertical" @submit="loginByEmail">
          <a-form-item field="email" hide-label>
            <a-input
              v-model="emailLoginForm.email"
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
            <a-input v-model="emailLoginForm.verifycode" allow-clear pr0>
              <template #suffix>
                <a-button
                  type="text"
                  :loading="isSendingEmail"
                  :disabled="!(emailLoginForm.email && imageCode) || isEmailActive"
                  @click="handleSendEmailCode"
                >
                  {{ isEmailActive ? `${emailCountdown}s` : $t('get-email-code') }}
                </a-button>
              </template>
            </a-input>
          </a-form-item>
          <a-space :size="16" direction="vertical">
            <div flex="~ justify-between">
              <a-checkbox v-model="privacyAgreed">
                {{ $t('i-have-read-and-agree') }}
              </a-checkbox>

              <a-link href="https://www.voiswork.cn/common/corp-web/privacy-en">
                {{ t('privacy-agreement') }}
              </a-link>
            </div>
            <a-button type="primary" html-type="submit" long :loading="emailPending" :disabled="!privacyAgreed">
              {{ t('login.form.login') }}
            </a-button>
          </a-space>
        </a-form>
      </a-tab-pane>
    </a-tabs>
    <a-space :size="16" w-full direction="vertical" style="margin-top: 16px;">
      <router-link to="/register">
        <a-button type="text" long class="login-form-register-btn">
          {{ $t('register.form.title') }}
        </a-button>
      </router-link>
      <a href="https://play.google.com/store/apps/details?id=com.voistech.work">
        <a-button type="text" long class="login-form-register-btn">
          {{ $t('download-android-app') }}
        </a-button>
      </a>
    </a-space>
  </div>
</template>

<style lang="less" scoped>
.login-form {
  &-wrapper {
    width: 320px;
  }

  &-title {
    font-weight: 500;
    font-size: 24px;
    line-height: 32px;
  }

  &-sub-title {
    color: var(--color-text-3);
    font-size: 16px;
    line-height: 24px;
  }

  &-error-msg {
    height: 32px;
    color: rgb(var(--red-6));
    line-height: 32px;
  }

  &-password-actions {
    display: flex;
    justify-content: space-between;
  }

  &-register-btn {
    color: var(--color-text-3) !important;
  }
}
</style>
