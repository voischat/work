import type { UseMutationOptions } from '@tanstack/vue-query'
import type { MaybeRef, Reactive } from 'vue'
import { toArray } from '@antfu/utils'
import { useMutation } from '@tanstack/vue-query'
import { computed, ref as deepRef, reactive } from 'vue'
import { useWeilaApi } from '../composables/useWeilaApi'
import { useWeilaFetch } from '../composables/useWeilaFetch'

export type UploadFileWarpper = Reactive<{
  id: string
  url: string | undefined
  dataUrl: string
  state: 'pending' | 'success' | 'error'
  error?: string
  raw?: File
}>

export function toFileWrapper(url: string) {
  return <UploadFileWarpper>{
    id: url,
    url,
    state: 'success',
    dataUrl: url,
  }
}

export function useUploadFile(options?: Omit<UseMutationOptions<string[], Error, File | File[]>, 'mutationFn'>) {
  const filelist = deepRef<UploadFileWarpper[]>([])

  const hasPending = computed(() => filelist.value.some(f => f.state === 'pending'))
  const pendingFilelist = computed(() => filelist.value.filter(f => f.state === 'pending'))
  const validFilelist = computed(() => filelist.value.filter(f => f.state === 'success'))

  const api = useWeilaApi()

  const mutation = useMutation<string[], Error, File | File[]>({
    mutationFn: async (file: File | File[]) => {
      const files = toArray(file)
      const urls: string[] = []

      for (const f of files) {
        const wrapper: UploadFileWarpper = reactive({
          id: f.name,
          url: undefined,
          state: 'pending',
          dataUrl: URL.createObjectURL(f),
          raw: f,
        })
        filelist.value.push(wrapper)

        const formData = new FormData()
        formData.append('file', f)

        try {
          const url = await api.value.v2.request.post<string>('common/upload-file', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            timeout: 120_000,
          })

          wrapper.url = url || ''
          wrapper.state = 'success'
          urls.push(url || '')
        }
        catch (error) {
          wrapper.state = 'error'
          wrapper.error = error as string
          throw new Error('文件上传失败')
        }
      }

      return urls
    },
    ...options,
  })

  return {
    filelist,
    pendingFilelist,
    validFilelist,
    hasPending,
    ...mutation,
  }
}

/**
 * @description 应用下载链接类型
 *
 * corp-demo 企业测试版
 * corp-normal 企业正式版
 * weila-demo 微喇个人版测试版
 * weila-normal 微喇个人正式版
 */
export enum AppDownloadLinkType {
  CorpDemo = 'corp-demo',
  CorpNormal = 'corp-normal',
  WeilaDemo = 'weila-demo',
  WeilaNormal = 'weila-normal',
}

export interface AppDownloadLinkPayload {
  type: AppDownloadLinkType
}

export interface AppDownloadLinkModel {
  url: string
  avatar: string
}

export function useAppDownloadLink(body: MaybeRef<AppDownloadLinkPayload>) {
  return useWeilaFetch<AppDownloadLinkModel>('web/app-download', {
    body,
  })
}
