<script setup lang="ts">
import type { AvatarUploaderExpose } from '~/types'
import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'
import md5 from 'md5'
import * as v from 'valibot'
import { computed, useTemplateRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'zod-arco-rules/valibot'
import { TrackType } from '~/api/contact'
import { useLocShareGate } from '~/composables/useLocShareGate'
import { useWeilaFetch } from '~/composables/useWeilaFetch'
import { useWeilaMutation } from '~/composables/useWeilaMutation'
import { useAppStore } from '~/stores/app'
import { useAuthStore } from '~/stores/auth'
import { isRemoteImage } from '~/utils/is'

const props = defineProps<{
  deptId?: number
}>()

const { t } = useI18n()
const { themeColor } = useAppStore()
const avatarUploaderRef = useTemplateRef<AvatarUploaderExpose>('avatarUploaderRef')
const authStore = useAuthStore()

const open = defineModel('open', { default: false })

const { data: depts } = useWeilaFetch<any[]>('corp/address/get-my-manage-all-dept', {}, {
  enabled: open,
})

const { form, rules, handleSubmit, reset } = useForm(v.object({
  name: v.string(() => t('form.error.name-nonempty')),
  phone: v.optional(v.string(() => t('form.error.phone-nonempty'))),
  password: v.string(() => t('form.error.password-nonempty')),
  job_num: v.optional(v.string(), ''),
  dept_id: v.optional(v.number(), 0),
  sex: v.optional(v.number(), 0),
  avatar: v.optional(v.string(), ''),
  is_dept_admin: v.optional(v.number(), 0),
  loc_share: v.optional(v.number(), 1),
  track: v.optional(v.number(), 0),
}))

const { isLocked: isLocShareLocked } = useLocShareGate(form)

watchEffect(() => {
  if (open.value) {
    reset()

    if (props.deptId !== undefined)
      form.value.dept_id = props.deptId
  }
})

const qc = useQueryClient()

const { mutate: createMember, isPending } = useWeilaMutation('corp/address/create-member', {
  onSuccess() {
    qc.invalidateQueries({
      queryKey: ['corp/address/get-member-list'],
    })
    qc.invalidateQueries({
      queryKey: ['corp/address/get-dept-member-list'],
    })
    reset()
    Message.success(t('message.success'))
    open.value = false
  },
})

const submit = handleSubmit(async (values: any) => {
  const upload = avatarUploaderRef.value?.upload
  if (!upload)
    return
  if (form.value.avatar && !isRemoteImage(form.value.avatar)) {
    if (!(await upload()))
      return
  }

  createMember({
    ...values,
    password: values.password
      ? md5(values?.password)
      : undefined,
  })
})

const isFastTrackDisabled = computed(() =>
  !authStore.vip?.supports.track_quick,
)

const getPowerWarningTooltip = () => t('tooltips.track.power-warning')
const getFlagshipFeatureTooltip = () => t('tooltips.track.flagship-feature')

const getFastTrackTooltip = computed(() => () =>
  isFastTrackDisabled.value
    ? getFlagshipFeatureTooltip()
    : getPowerWarningTooltip(),
)

const getLocShareTooltip = computed(() => () =>
  isLocShareLocked.value
    ? t('tooltips.loc-share.pro-feature')
    : '',
)
</script>

<template>
  <ModalTrigger v-model:open="open" :trigger="{ type: 'primary' }" :title=" t('create-member') ">
    <template #content>
      <a-form :rules :model="form" @submit="submit">
        <a-form-item field="name">
          <template #label>
            <RequiredLabel>
              {{ t('name') }}
            </RequiredLabel>
          </template>
          <a-input v-model="form.name" :max-length="20" show-word-limit />
        </a-form-item>
        <a-form-item field="dept_id" :label="t('member.form.dept.label')">
          <a-select
            v-if="props.deptId === undefined"
            allow-search :empty="t('no-data')"
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
        <a-form-item field="job_num" :label="t('member.form.job-num.label')">
          <a-input v-model="form.job_num" :max-length="12" show-word-limit />
        </a-form-item>
        <a-form-item field="phone" :label=" t('phone-number') ">
          <a-input v-model="form.phone" :max-length="11" show-word-limit />
        </a-form-item>
        <a-form-item field="password">
          <template #label>
            <RequiredLabel>
              {{ t('password') }}
            </RequiredLabel>
          </template>
          <a-input v-model="form.password" />
        </a-form-item>
        <a-form-item field="sex" :label="t('member.form.gender.label')">
          <a-radio-group v-model="form.sex">
            <a-radio :value="0">
              {{ t('male') }}
            </a-radio>
            <a-radio :value="1">
              {{ t('female') }}
            </a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item field="avatar" :label="t('member.form.avatar.label')">
          <AvatarUploader ref="avatarUploaderRef" v-model:src="form.avatar" />
        </a-form-item>
        <a-form-item
          field="loc_share" :label="t('member.form.loc_share.label')"
        >
          <a-switch
            v-model="form.loc_share" v-tips="getLocShareTooltip"
            :checked-value="1" :unchecked-value="0" :checked-color="themeColor"
            :disabled="isLocShareLocked" unchecked-color="#ddd"
          />
        </a-form-item>

        <a-form-item field="is_dept_admin" :label="t('dept-manager')">
          <a-switch v-model="form.is_dept_admin" :checked-value="1" :unchecked-value="0" :checked-color="themeColor" unchecked-color="#ddd" />
        </a-form-item>
        <a-form-item v-if="authStore.vip?.supports.track" field="track" :label="t('change-member.form.track.label')">
          <a-radio-group v-model="form.track" type="button">
            <a-radio :value="TrackType.Close">
              {{ t('track-type.close') }}
            </a-radio>
            <a-radio :value="TrackType.Low">
              {{ t('track-type.low') }}
            </a-radio>
            <a-radio :value="TrackType.Medium">
              {{ t('track-type.medium') }}
            </a-radio>
            <a-radio
              v-tips="getPowerWarningTooltip"
              :value="TrackType.High"
            >
              {{ t('track-type.high') }}
            </a-radio>
            <a-radio
              v-disabled="isFastTrackDisabled"
              v-tips="getFastTrackTooltip"
              :value="TrackType.Fast"
            >
              {{ t('track-type.fast') }}
            </a-radio>

            <div id="test" popover="auto">
              <button>{{ t('option.a') }}</button><br><button>{{ t('option.b') }}</button>
            </div>
          </a-radio-group>
        </a-form-item>

        <a-form-item>
          <a-button mla type="primary" html-type="submit" :loading="isPending">
            {{ t('button.submit') }}
          </a-button>
        </a-form-item>
      </a-form>
    </template>
  </ModalTrigger>
</template>

<style scoped>
.a-radio-group[type="button"] .a-radio-button,
.a-radio-group[type="button"] .a-radio-button .a-radio-button-label {
  white-space: nowrap;
  word-break: keep-all;
}
</style>
