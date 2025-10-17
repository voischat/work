import type { DefaultError, UseMutationOptions } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { createSharedComposable } from '@vueuse/core'
import { computed } from 'vue'
import * as z from 'zod'
import { useWeilaFetch } from '../composables/useWeilaFetch'
import { useWeilaMutation } from '../composables/useWeilaMutation'

export enum ServiceState {
  Uncreated = '未创建',
  Unverified = '未认证',
  Verified = '已开通',
}

export type GetMyBusinessParams = never

export interface GetMyBusinessModel {
  business: {
    id: number
    sid: number
    type: number
    merchant: {
      type: number
      name: string
      avatar: string
      intro: string
      phone: string
      album: string[]
      citycode: string
      adcode: string
      lat: number
      lon: number
      township: string
      address: string
    }
    state: number
  }
}

export function useMyBusiness() {
  return useWeilaFetch<GetMyBusinessModel['business']>('corp/busi/get-my-business', {
    pick: ['business'],
  })
}

interface ServiceLegal {
  id: number
  category: number
  type: number
  merchant: {
    business_license: string
  }
  state: 0 | 8 | 9 // 0 ~ 7 待审核 8 成功 9 失败
}

export const useServiceLegal = createSharedComposable(() => {
  return useWeilaFetch<ServiceLegal>('corp/busi/legal/get-my-legal', {
    pick: ['legal'],
  })
})

export interface ChangeLegalPayload {
  legal: {
    id: number
    type: number
    merchant: {
      business_license: string
    }
  }
}

export type ChangeLegalModel = never

export function useChangeLegal(options?: UseMutationOptions<ChangeLegalModel, DefaultError, ChangeLegalPayload>) {
  return useWeilaMutation<ChangeLegalModel, ChangeLegalPayload>('corp/busi/legal/change-legal', options)
}

export const useService = createSharedComposable(() => {
  const myBusinessQuery = useMyBusiness()
  const serviceLegalQuery = useServiceLegal()

  const hasBusiness = computed(() => !!myBusinessQuery.data.value)
  const hasLicense = computed(() => !!serviceLegalQuery.data.value)
  const isVerified = computed(() => serviceLegalQuery.data.value?.state === 8)

  const serviceState = computed(() => {
    if (hasBusiness.value && isVerified.value)
      return ServiceState.Verified

    if (!hasBusiness.value)
      return ServiceState.Uncreated

    return ServiceState.Unverified
  })

  const isPending = computed(() => {
    return myBusinessQuery.isPending.value || serviceLegalQuery.isPending.value
  })

  const isSuccess = computed(() => {
    return myBusinessQuery.isSuccess.value && serviceLegalQuery.isSuccess.value
  })

  const data = computed(() => {
    return {
      business: myBusinessQuery.data.value,
      legal: serviceLegalQuery.data.value,
    }
  })

  return {
    hasBusiness,
    hasLicense,
    isVerified,
    serviceState,
    myBusinessQuery,
    serviceLegalQuery,
    refetch: () => {
      myBusinessQuery.refetch()
      serviceLegalQuery.refetch()
    },
    data,
    isPending,
    isSuccess,
  }
})

export interface ChangeBusinessPayload {
  business: {
    id: number
    merchant: {
      type?: number
      name?: string
      avatar?: string
      intro?: string
      phone?: string
      album?: string[]
      citycode?: string
      adcode?: string
      lat?: number
      lon?: number
      township?: string
      address?: string
    }
  }
}

export type ChangeBusinessModel = never

export const useMutateBusiness = createSharedComposable((options?: UseMutationOptions<ChangeBusinessModel, DefaultError, ChangeBusinessPayload>) => {
  return useWeilaMutation<ChangeBusinessModel, ChangeBusinessPayload>('corp/busi/change-business', options)
})

export interface GetBusinessPointListPayload {
  sid: number
}

export interface GetBusinessPointListModel {
  points: {
    id: number
    sid: number
    name: string
    avatar: string
    intro: string
    phone: string
    album: string[]
    adcode: string
    lat: number
    lon: number
    address: string
    staff_count: number
  }[]
}

export const useBusinessPointList = createSharedComposable((payload: MaybeRefOrGetter<GetBusinessPointListPayload>) => {
  return useWeilaFetch<GetBusinessPointListModel['points']>('corp/busi/get-business-point-list', {
    body: payload,
    pick: ['points'],
  })
})

export const useBusinessPoint = createSharedComposable((sid: number, pid: number) => {
  const query = useBusinessPointList({ sid })

  return {
    ...query,
    data: computed(() => query.data.value?.find(i => i.id === pid)),
  }
})

export const changeBusinessPointSchema = z.object({
  id: z.number().optional(),
  name: z.string().max(50, '名称最长50个字符'),
  phone: z.string().length(11, '手机号必须为11位'),
  avatar: z.string().default('').optional(),
  intro: z.string().max(200, '简介最长200个字符').default('').optional(),
  album: z.array(z.string()).default([]).optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  adcode: z.string().optional(),
  address: z.string().optional(),
})

export type ChangeBusinessPointPayload = z.infer<typeof changeBusinessPointSchema>
export type ChangeBusinessPointModel = never

export function changeBusinessPoint(options?: UseMutationOptions<ChangeBusinessPointModel, DefaultError, ChangeBusinessPointPayload>) {
  return useWeilaMutation<ChangeBusinessPointModel, { point: ChangeBusinessPointPayload }>('corp/busi/change-business-point', options)
}

export const delBusinessPointSchema = z.object({
  pid: z.number(),
})

export type DelBusinessPoint = z.infer<typeof delBusinessPointSchema>

export type DelBusinessPointModel = never

export function delBusinessPoint(options?: UseMutationOptions<DelBusinessPointModel, DefaultError, DelBusinessPoint>) {
  return useWeilaMutation<DelBusinessPointModel, DelBusinessPoint>('corp/busi/del-business-point', options)
}

export const createBusinessPointSchema = z.object({
  sid: z.number().optional(),
  name: z.string().max(50, '名称最长50个字符'),
  phone: z.string().length(11, '手机号必须为11位'),
  avatar: z.string().default('').optional(),
  intro: z.string().max(200, '简介最长200个字符').default('').optional(),
  album: z.array(z.string()).default([
    'http://download.weila.hk/tmp/2025-03-28/1743147275_8551e1fd.png',
  ]).optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  adcode: z.string().optional(),
  address: z.string().optional(),
})

export type CreateBusinessPointPayload = z.infer<typeof createBusinessPointSchema>

export type CreateBusinessPointModel = never

export function createBusinessPoint(options?: UseMutationOptions<CreateBusinessPointModel, DefaultError, CreateBusinessPointPayload>) {
  return useWeilaMutation<CreateBusinessPointModel, { point: CreateBusinessPointPayload }>('corp/busi/create-business-point', options)
}

export const addBusinessStaffsSchema = z.object({
  sid: z.number(),
  uids: z.array(z.number()),
})

export type AddBusinessStaffs = z.infer<typeof addBusinessStaffsSchema>

export type AddBusinessStaffsModel = never

export const useAddBusinessStaffs = createSharedComposable((options?: UseMutationOptions<AddBusinessStaffsModel, DefaultError, AddBusinessStaffs>) => {
  return useWeilaMutation<AddBusinessStaffsModel, AddBusinessStaffs>('corp/busi/add-business-staffs', options)
})

export interface GetBusinessStaffListPayload {
  sid: number
}

export interface GetBusinessStaffListModel {
  staffs: {
    uid: number
    num: string
    job_num: string
    sex: number
    name: string
    avatar: string
    state: number
  }[]
}

export const useBusinessStaffList = createSharedComposable((body: MaybeRefOrGetter<GetBusinessStaffListPayload>) => {
  return useWeilaFetch<GetBusinessStaffListModel['staffs']>('corp/busi/get-business-staff-list', {
    body,
    pick: ['staffs'],
  })
})

export const delBusinessStaffSchema = z.object({
  sid: z.number(),
  uid: z.number(),
})

export type DelBusinessStaffPayload = z.infer<typeof delBusinessStaffSchema>
export type DelBusinessStaffModel = never

export const useDelBusinessStaff = createSharedComposable((options?: UseMutationOptions<DelBusinessStaffModel, DefaultError, DelBusinessStaffPayload>) => {
  return useWeilaMutation<DelBusinessStaffModel, DelBusinessStaffPayload>('corp/busi/del-business-staff', options)
})

export interface GetBusinessPointStaffListPayload {
  pid: number
}

export interface Staff {
  uid: number
  num: string
  job_num: string
  sex: number
  name: string
  avatar: string
  state: number
  type: number
}

export interface GetBusinessPointStaffListModel {
  staffs: Staff[]
}

export const useGetBusinessPointStaffList = createSharedComposable((body: MaybeRefOrGetter<GetBusinessPointStaffListPayload>) => {
  return useWeilaFetch<GetBusinessPointStaffListModel['staffs']>('corp/busi/get-business-point-staff-list', {
    body,
    pick: ['staffs'],
  })
})

export interface AddBusinessPointStaffsPayload {
  pid: number
  uids: number[]
}

export type AddBusinessPointStaffsModel = never

export const useAddBusinessPointStaffs = createSharedComposable((options?: UseMutationOptions<AddBusinessPointStaffsModel, DefaultError, AddBusinessPointStaffsPayload>) => {
  return useWeilaMutation<AddBusinessPointStaffsModel, AddBusinessPointStaffsPayload>('corp/busi/add-business-point-staffs', options)
})

export interface DelBusinessPointStaffPayload {
  pid: number
  uid: number
}

export type DelBusinessPointStaffModel = never

export const useDelBusinessPointStaff = createSharedComposable((options?: UseMutationOptions<DelBusinessPointStaffModel, DefaultError, DelBusinessPointStaffPayload>) => {
  return useWeilaMutation<DelBusinessPointStaffModel, DelBusinessPointStaffPayload>('corp/busi/del-business-point-staff', options)
})

export const createBusinessSchema = z.object({
  merchant: z.object({
    type: z.number(),
    name: z.string().max(50, '名称最长50个字符'),
    avatar: z.string(),
    intro: z.string().max(200, '简介最长200个字符'),
    phone: z.string().length(11, '手机号必须为11位'),
    album: z.array(z.string()),
    citycode: z.string(),
    adcode: z.string(),
    lat: z.number(),
    lon: z.number(),
    township: z.string(),
    address: z.string(),
  }),
  type: z.number().default(0).optional(),
})

export type CreateBusinessPayload = z.infer<typeof createBusinessSchema>

export type CreateBusinessModel = never

export function createBusiness(options?: UseMutationOptions<CreateBusinessModel, DefaultError, CreateBusinessPayload>) {
  return useWeilaMutation<CreateBusinessModel, { business: CreateBusinessPayload }>('corp/busi/create-business', options)
}
