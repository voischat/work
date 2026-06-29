import type { WeilaApi } from '@wl/network'
import type { Corp, VipInfo } from './types.js'

export async function getMyOrg(api: WeilaApi): Promise<Corp | undefined> {
  return api.v2.fetch('corp/org/get-my-org', {})
}

export async function getMyVip(api: WeilaApi): Promise<VipInfo | undefined> {
  return api.v2.fetch('corp/org/get-my-vip', {})
}

export interface CreateOrgPayload {
  name: string
  avatar?: string
}

export interface CreateOrgResponse {
  name: string
  avatar: string
}

export async function createOrg(api: WeilaApi, payload: CreateOrgPayload): Promise<CreateOrgResponse> {
  return api.v2.fetch('corp/org/create-org', { body: payload })
}

export interface ChangeOrgPayload {
  name?: string
  avatar?: string
}

export async function changeOrg(api: WeilaApi, payload: ChangeOrgPayload): Promise<void> {
  await api.v2.fetch('corp/org/change-org', { body: payload })
}
