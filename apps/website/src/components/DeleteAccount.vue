<script setup lang="ts">
import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'
import * as v from 'valibot'
import { shallowRef, useTemplateRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'zod-arco-rules/valibot'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useWeilaMutation } from '~/composables/useWeilaMutation'
import { useAuthStore } from '~/stores/auth'

const { t } = useI18n()

const open = defineModel('open', { default: false })

const formRef = useTemplateRef('formRef')

const { form, rules, handleSubmit, reset } = useForm(v.object({
  phone: v.pipe(v.string(() => t('form.error.phone-nonempty'))),
  country_code: v.optional(v.string(), '86'),
  verifycode: v.string(() => t('form.error.verify-code-nonempty')),
}))

watchEffect(() => open.value && reset())

const qc = useQueryClient()

const authStore = useAuthStore()

const { mutate, isPending } = useWeilaMutation('corp/user/unregist', {
  async onSuccess() {
    open.value = false
    Message.success(t('message.success'))
    reset()
    qc.invalidateQueries({
      queryKey: ['corp/user/get-selfinfo'],
    })

    await authStore.logout()
  },
})

const submit = handleSubmit((values: any) => {
  mutate(values)
})

const confirmSubmit = () => formRef.value?.handleSubmit(new Event('submit'))

const verifyImageAnswer = shallowRef('')
const { data: verifyImageData, refetch: refreshImageCode } = useWeilaFetch<{ id: string, image: string }>(
  'common/get-image-verifycode?width=160&height=80',
  {},
  {
    enabled: open,
  },
)
</script>

<template>
  <a-modal v-model:visible="open" :footer="false">
    <template #title>
      <div>{{ t('delete-account-form.title') }}</div>
    </template>

    <a-form ref="formRef" style="margin: 0 auto; width: fit-content;" :model="form" :rules layout="vertical" @submit="submit">
      <a-form-item field="phone" hide-label>
        <a-input-group>
          <a-select v-model="form.country_code" style="width: 100px">
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

      <a-form-item field="country_code">
        <div flex gap2>
          <a-input
            v-model="verifyImageAnswer"
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
            :placeholder="t('sms-verify-code')"
            allow-clear
          />
          <SendSmsButton
            :opts="{
              phone: form.phone,
              countrycode: form.country_code || '86',
              verify_id: verifyImageData?.id || '',
              verify_answer: verifyImageAnswer,
              smstype: 'work-unregist',
            }"
          />
        </div>
      </a-form-item>

      <a-form-item>
        <a-popconfirm
          :content="t('delete-account-form.confirm-content')"
          type="warning"
          @ok="confirmSubmit"
        >
          <a-button mla type="primary" :loading="isPending">
            {{ t('button.submit') }}
          </a-button>
        </a-popconfirm>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
