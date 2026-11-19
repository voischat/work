<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
import { useQueryClient } from '@tanstack/vue-query'
import * as v from 'valibot'
import { computed } from 'vue'
import { useForm } from 'zod-arco-rules/valibot'
import { TrackType } from '~/api/contact'

interface Props {
  deptId?: number
}

const props = defineProps<Props>()

const { t } = useI18n()
const { themeColor } = useAppStore()
const formRef = useTemplateRef('formRef')

const open = defineModel('open', { default: false })
const authStore = useAuthStore()

const avatarUploaderRef = useTemplateRef('avatarUploaderRef')

const { data: depts } = useWeilaFetch<any>('corp/address/get-my-manage-all-dept', {}, {
  enabled: open,
})

const { form, rules, handleSubmit, reset } = useForm(v.object({
  verifycode: v.optional(v.pipe(v.string(), v.minLength(1, () => t('form.error.verify-code-nonempty'))), ''),
  name: v.pipe(v.string(() => t('form.error.name-nonempty'))),
  job_num: v.optional(v.string(), ''),
  dept_id: v.optional(v.number(), 0),
  sex: v.optional(v.number(), 0),
  avatar: v.optional(v.string(), ''),
  phone: v.optional(v.string(), ''),
  loc_share: v.optional(v.number(), 1),
  track: v.optional(v.number(), 0),
}))

watchEffect(() => {
  if (open.value) {
    reset()

    if (props.deptId !== undefined)
      form.value.dept_id = props.deptId
  }
})

const qc = useQueryClient()

const { mutate, isPending } = useWeilaMutation('corp/address/add-device', {
  onSuccess() {
    Message.success(t('message.success'))
    qc.invalidateQueries({ queryKey: ['corp/address/get-member-list'] })
    qc.invalidateQueries({ queryKey: ['corp/address/get-dept-member-list'] })
    open.value = false
    reset()
  },
})

const submit = handleSubmit(async (values: any) => {
  // @ts-expect-error type error: `defineExpose` no type declare find
  const { upload } = avatarUploaderRef.value
  if (form.value.avatar && !isRemoteImage(form.value.avatar)) {
    if (!(await upload()))
      return
  }

  mutate(values)
})

// Computed property for fast radio disabled state
const isFastTrackDisabled = computed(() =>
  !authStore.vip?.vip_supports.find(i => i.name === 'track')?.quick_support,
)

// Computed functions for tooltips
const getPowerWarningTooltip = () => t('tooltips.track.power-warning')
const getFlagshipFeatureTooltip = () => t('tooltips.track.flagship-feature')

// Conditional tooltip for fast radio
const getFastTrackTooltip = computed(() => () =>
  isFastTrackDisabled.value ? getFlagshipFeatureTooltip() : getPowerWarningTooltip(),
)

const isLocShareLocked = computed(() =>
  authStore.vip?.vip_supports.find(i => i.name === 'location')?.support === false,
)

const getLocShareTooltip = computed(() => () =>
  isLocShareLocked.value ? t('tooltips.loc-share.pro-feature') : '',
)
</script>

<template>
  <ModalTrigger v-model:open="open" :trigger="{ type: 'primary' }" :title=" t('add-device') ">
    <template #content>
      <a-form ref="formRef" :model="form" :rules auto-label-width @submit="submit">
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
            @change="(value: string) => form.dept_id = Number(value)"
          >
            <a-option v-for="{ name, id }, key in depts" :key :value="id" :label="name" />
          </a-select>
          <a-input
            v-else
            :model-value="depts?.find((d: any) => d?.id === props.deptId)?.name || ''"
            readonly
          />
        </a-form-item>
        <a-form-item field="job_num" :label="t('member.form.job-num.label')">
          <a-input v-model="form.job_num" :max-length="12" show-word-limit />
        </a-form-item>
        <a-form-item field="verifycode">
          <template #label>
            <RequiredLabel>
              {{ t('verify-code') }}
            </RequiredLabel>
          </template>
          <a-input v-model="form.verifycode" :max-length="20" show-word-limit />
        </a-form-item>
        <a-form-item :label="t('phone-number')" field="phone">
          <a-input v-model="form.phone" :max-length="11" show-word-limit />
        </a-form-item>

        <a-form-item field="sex" :label="t('gender')">
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
        <!-- <a-form-item field="tts" label="TTS" >
            <a-switch
              v-model="form.tts" :checked-value="1" :unchecked-value="0" :checked-color="themeColor"
              unchecked-color="#ddd"
            />
          </a-form-item> -->
        <a-form-item
          field="loc_share" :label="t('member.form.loc_share.label')"
        >
          <a-switch
            v-model="form.loc_share" v-tips="getLocShareTooltip"
            :checked-value="1" :unchecked-value="0" :checked-color="themeColor"
            :disabled="isLocShareLocked" unchecked-color="#ddd"
          />
        </a-form-item>
        <a-form-item v-if="authStore.vip?.vip_supports.find((i) => i.name === 'track')?.support" field="track" :label="t('change-member.form.track.label')">
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
          <a-button :loading="isPending" mla type="primary" @click="(e) => formRef?.handleSubmit(e)">
            {{ t('button.submit') }}
          </a-button>
        </a-form-item>
      </a-form>
    </template>
  </ModalTrigger>
</template>
