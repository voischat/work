<script setup lang="ts">
import type { Corp } from '~/types'
import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'
import * as v from 'valibot'
import { useTemplateRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useForm } from 'zod-arco-rules/valibot'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useWeilaMutation } from '~/composables/useWeilaMutation'
import { isRemoteImage } from '~/utils/is'

definePage({
  meta: {
    layout: 'plain',
  },
})

const router = useRouter()

const { t } = useI18n()

const { data: corp, isSuccess } = useWeilaFetch<Corp>('corp/org/get-my-org')

watchEffect(() => {
  if (isSuccess.value && corp.value)
    router.push('/contact/org')
})

const avatarUploaderRef = useTemplateRef('avatarUploaderRef')

const open = defineModel('open', { default: false })

const { rules, form, reset, handleSubmit } = useForm(v.object({
  name: v.pipe(v.string(() => t('form.error.name-nonempty'))),
  avatar: v.optional(v.string(), ''),
}))

const qc = useQueryClient()

const { mutateAsync, isPending } = useWeilaMutation<{
  name: string
  avatar: string
}>('corp/org/create-org', {
  onSuccess() {
    reset()
    open.value = false
    Message.success(t('message.success'))
    qc.invalidateQueries({
      queryKey: ['corp/org/get-my-org'],
    })
  },
})

const submit = handleSubmit(async (values: any) => {
  // @ts-expect-error type error: `defineExpose` no type declare find
  const { upload } = avatarUploaderRef.value
  if (form.value.avatar && !isRemoteImage(form.value.avatar)) {
    if (!(await upload()))
      return
  }

  await mutateAsync(values)
})
</script>

<template>
  <div pt8>
    <a-form :rules layout="vertical" mxa w500px border p8 rounded-lg :model="form" @submit="submit">
      <h1 text-2xl text-center leading-loose font-semibold>
        {{ $t('org.create-org') }}
      </h1>
      <a-form-item field="name" label="企业名">
        <a-input v-model="form.name" :max-length="20" show-word-limit />
      </a-form-item>
      <a-form-item field="avatar" :label="t('member.form.avatar.label')" :validate-trigger="['change', 'blur']">
        <AvatarUploader ref="avatarUploaderRef" v-model:src="form.avatar" />
      </a-form-item>
      <a-form-item>
        <a-button mla type="primary" :loading="isPending" html-type="submit">
          {{ t('button.submit') }}
        </a-button>
      </a-form-item>
    </a-form>
  </div>
</template>
