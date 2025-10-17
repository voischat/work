<script setup lang="ts">
import Message from '@arco-design/web-vue/es/message'
import { reactive, shallowRef } from 'vue'
import { useChangeLegal, useServiceLegal } from '~/api'
import FileUploader from '~/components/FileUploader.vue'

const router = useRouter()

const isEditLegalModalOpen = shallowRef(false)

const isUploadingFile = shallowRef(false)

const { data: legalData, refetch: refetchLegalData } = useServiceLegal()
const { mutateAsync: changeLegal, isPending } = useChangeLegal({
  onSuccess() {
    isEditLegalModalOpen.value = false
    Message.success('修改成功')
    refetchLegalData()
    router.push('/workbench')
  },
})

const form = reactive({
  business_license: legalData?.value?.merchant?.business_license || '',
})
</script>

<template>
  <TheModal
    v-model:open="isEditLegalModalOpen"
    title="编辑资质信息"
  >
    <a-button type="primary">
      编辑资质
    </a-button>
    <template #content>
      <a-form :model="form">
        <a-form-item field="business_license" label="营业执照">
          <div w-80>
            <FileUploader
              v-model:is-uploading="isUploadingFile"
              :limit="1"
              classes="bg-neutral-200 dark:bg-neutral-800" w-full
              :initial-files="form.business_license"
              @update:files="(files) => form.business_license = files[0]"
            />
          </div>
        </a-form-item>
      </a-form>
    </template>
    <template #footer>
      <a-button
        :disabled="isPending"
        :loading="isPending"
        type="primary"
        @click="() => changeLegal({
          legal: {
            id: legalData?.id || 0,
            type: legalData?.type || 0,
            merchant: {
              business_license: form.business_license,
            },
          },
        })"
      >
        保存
      </a-button>
    </template>
  </TheModal>
</template>
