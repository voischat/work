<script setup lang="ts">
import type { AvatarUploaderExpose } from '~/types'
import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'
import * as v from 'valibot'
import { useTemplateRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'zod-arco-rules/valibot'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useWeilaMutation } from '~/composables/useWeilaMutation'
import { isRemoteImage } from '~/utils/is'

const props = defineProps<{
  deptId?: number
}>()

const emit = defineEmits<{
  success: []
}>()

const { t } = useI18n()
const qc = useQueryClient()
const avatarUploaderRef = useTemplateRef<AvatarUploaderExpose>('avatarUploaderRef')

const { data: depts } = useWeilaFetch<any[]>('corp/address/get-my-manage-all-dept')

const { form, rules, handleSubmit, reset } = useForm(v.object({
  name: v.pipe(v.string(() => t('form.error.name-nonempty'))),
  dept_id: v.optional(v.number(), () => depts.value?.[0]?.id || 0),
  burst_mode: v.optional(v.number(), 0),
  avatar: v.optional(v.string(), ''),
}))

const { mutate, isPending } = useWeilaMutation('corp/group/create-group', {
  onSuccess() {
    reset()
    Message.success(t('message.success'))
    qc.invalidateQueries({
      queryKey: ['corp/group/get-group-list'],
    })
    qc.invalidateQueries({
      queryKey: ['corp/group/get-my-manage-group-list'],
    })
    emit('success')
  },
})

watchEffect(() => {
  if (props.deptId !== undefined)
    form.value.dept_id = props.deptId
})

const submit = handleSubmit(async (values) => {
  try {
    if (form.value.avatar && !isRemoteImage(form.value.avatar)) {
      if (!(await avatarUploaderRef.value?.upload()))
        return
    }

    mutate(values)
  }
  catch (error) {
    console.error('error', error)
  }
})
</script>

<template>
  <a-form :rules :model="form" auto-label-width @submit="submit">
    <a-form-item field="name" :label="t('org-form.name.label')">
      <a-input v-model="form.name" :max-length="20" show-word-limit />
    </a-form-item>
    <a-form-item field="dept_id" :label="t('member.form.dept.label')">
      <a-select
        v-if="props.deptId === undefined"
        allow-search :empty="t('no-data')"
        :model-value="form.dept_id"
        @change="value => form.dept_id = Number(value)"
      >
        <a-option v-for="{ name, id }, key in depts" :key :value="id" :label="name" />
      </a-select>
      <a-input
        v-else
        :model-value="depts?.find(d => d.id === props.deptId)?.name || ''"
        readonly
      />
    </a-form-item>
    <a-form-item field="avatar" :label="t('avatar')">
      <AvatarUploader ref="avatarUploaderRef" v-model:src="form.avatar" />
    </a-form-item>
    <a-form-item field="burst_mode" :label="t('burst-mode')">
      <a-radio-group v-model="form.burst_mode" direction="vertical">
        <a-radio :value="0">
          {{ t('burst-mode-0') }}
        </a-radio>
        <a-radio :value="1">
          {{ t('burst-mode-1') }}
        </a-radio>
      </a-radio-group>
    </a-form-item>

    <a-form-item>
      <a-button mla html-type="submit" type="primary" :loading="isPending">
        {{ t('button.submit') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>
