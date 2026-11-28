<script setup lang="ts">
import type { AvatarUploaderExpose } from '~/types'
import type { Member } from '~/types/api'

import Message from '@arco-design/web-vue/es/message'
import { useQueryClient } from '@tanstack/vue-query'
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
import { useSelfInfoStore } from '~/stores/selfInfo'
import { useWeilaStore } from '~/stores/weila'
import { isRemoteImage } from '~/utils/is'

interface Props {
  member?: Member
  deptId?: number
}

const props = defineProps<Props>()
const emits = defineEmits(['success'])

const { t } = useI18n()
const { themeColor } = useAppStore()
const avatarUploaderRef = useTemplateRef<AvatarUploaderExpose>('avatarUploaderRef')

const open = defineModel('open', { default: false })
const authStore = useAuthStore()
const selfInfoStore = useSelfInfoStore()
const weilaStore = useWeilaStore()

const { form, rules, handleSubmit, reset } = useForm(v.object({
  user_id: v.optional(v.number(), () => props.member?.user_id),
  name: v.optional(v.pipe(v.string()), () => props.member?.name),
  job_num: v.optional(v.string(), () => props.member?.job_num),
  dept_id: v.optional(v.number(), () => props.member?.dept_id),
  sex: v.optional(v.number(), () => props.member?.sex),
  avatar: v.optional(v.string(), () => props.member?.avatar),
  phone: v.optional(v.string(), () => props.member?.phone),
  is_dept_admin: v.optional(v.number(), () => props.member?.is_dept_admin),
  loc_share: v.optional(v.number(), () => props.member?.loc_share),
  track: v.optional(v.number(), () => props.member?.track),
}), {
  watch: [
    () => props.member,
  ],
})

const { isLocked: isLocShareLocked } = useLocShareGate(form)

const { data: depts } = useWeilaFetch<{
  id: number
  name: string
  user_count: number
}[]>('corp/address/get-my-manage-all-dept', {}, {
  enabled: open,
})

const qc = useQueryClient()

watchEffect(() => open.value && reset())

const { mutate: edit, isPending } = useWeilaMutation('corp/address/change-member', {
  onSuccess() {
    open.value = false
    Message.success(t('message.success'))

    qc.invalidateQueries({
      queryKey: ['corp/address/get-member-list'],
    })
    qc.invalidateQueries({
      queryKey: ['corp/address/get-dept-member-list'],
    })
    qc.invalidateQueries({
      queryKey: ['corp/address/get-my-manage-dept-list'],
    })
    qc.invalidateQueries({
      queryKey: ['corp/group/get-group-all-member'],
    })
    if (selfInfoStore.isCurrentUser(Number(form.value.user_id))) {
      qc.invalidateQueries({
        queryKey: ['corp/user/get-selfinfo'],
      })
    }

    emits('success')
    weilaStore.core?.weila_refreshSessionList()
  },
})

const submit = handleSubmit(async (values) => {
  const upload = avatarUploaderRef.value?.upload
  if (!upload)
    return
  if (form.value.avatar !== props.member?.avatar && !isRemoteImage(form.value.avatar || '')) {
    if (!(await upload()))
      return
  }
  edit(values)
})

const isFastTrackDisabled = computed(() =>
  !authStore?.vip?.supports?.track_quick,
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
  <a-modal v-model:visible="open" :title="t('edit')" :footer="false">
    <a-form :rules :model="form" @submit="submit">
      <a-form-item field="name" :label="t('member.form.name.label')">
        <a-input v-model="form.name" :max-length="20" show-word-limit />
      </a-form-item>
      <a-form-item v-if="member?.product" :label="t('member.form.product.label')">
        <a-input disabled :default-value="member.product" :max-length="20" show-word-limit />
      </a-form-item>
      <a-form-item v-if="member?.imei" label="IMEI">
        <a-input disabled :default-value="member.imei" :max-length="20" show-word-limit />
      </a-form-item>
      <a-form-item field="dept_id" :label="t('member.form.dept.label')">
        <a-select
          v-if="!props.deptId && selfInfoStore.isOwner"
          v-model:model-value="form.dept_id"
          allow-search
          :empty="t('no-data')"
        >
          <a-option v-for="{ name, id }, key in depts" :key :value="id" :label="name" />
        </a-select>
        <a-input
          v-else
          :model-value="depts?.find(d => d.id === (props.deptId || form.dept_id))?.name || ''"
          readonly
        />
      </a-form-item>
      <a-form-item :label="$t('weila-number')">
        <a-input :model-value="member?.user_num" disabled />
      </a-form-item>
      <a-form-item field="job_num" :label="t('member.form.job-num.label')">
        <a-input v-model="form.job_num" :max-length="12" show-word-limit />
      </a-form-item>
      <a-form-item field="phone" :label="t('phone-number')">
        <a-input v-model="form.phone" :max-length="11" show-word-limit />
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
      <a-form-item v-if="member?.type !== 1" field="is_dept_admin" :label="t('dept-manager')">
        <a-switch
          v-model="form.is_dept_admin" :checked-value="1" :unchecked-value="0" :checked-color="themeColor"
          unchecked-color="#ddd"
          :disabled="!selfInfoStore.isOwner"
        />
      </a-form-item>
      <a-form-item v-if="authStore?.vip?.supports?.track" field="track" :label="t('change-member.form.track.label')">
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
        </a-radio-group>
      </a-form-item>
      <a-form-item>
        <a-button mla type="primary" html-type="submit" :loading="isPending">
          {{ t('button.submit') }}
        </a-button>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
