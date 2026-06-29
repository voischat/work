import type { WeilaApi } from '@wl/network'
import type { AuthModel, Corp, SelfInfo, VipInfo } from './types.js'

export interface LoginByPasswordPayload {
  account: string
  password: string
}

export interface LoginByPasswordResponse extends AuthModel {
  org?: Corp
  account: {
    user_number: string
    password: string
    country_code: string
  }
}

export async function loginByPassword(api: WeilaApi, payload: LoginByPasswordPayload): Promise<LoginByPasswordResponse> {
  return api.v2.fetch('/corp/auth/login', { body: payload })
}

export interface LoginBySmsPayload {
  phone: string
  country_code: string
  verifycode: string
}

export async function loginBySms(api: WeilaApi, payload: LoginBySmsPayload): Promise<AuthModel> {
  return api.v2.fetch('/corp/auth/login-by-sms', { body: payload })
}

export interface RegisterPayload {
  phone: string
  country_code: string
  verifycode: string
  password: string
}

export interface RegisterResponse {
  phone: string
  country_code: string
  password: string
}

export async function register(api: WeilaApi, payload: RegisterPayload): Promise<RegisterResponse> {
  return api.v2.fetch('/corp/auth/regist', { body: payload })
}

export interface ResetPasswordPayload {
  phone: string
  country_code: string
  verifycode: string
  password: string
}

export async function resetPassword(api: WeilaApi, payload: ResetPasswordPayload): Promise<void> {
  await api.v2.fetch('/corp/auth/reset-password', { body: payload })
}

export interface SendVerifySmsPayload {
  phone: string
  countrycode: string
  verify_id: string
  verify_answer: string
  smstype: 'work-login' | 'work-regist' | 'work-bind-phone' | 'work-reset-password' | 'work-add-device' | 'work-unregist'
}

export async function sendVerifySms(api: WeilaApi, payload: SendVerifySmsPayload): Promise<void> {
  await api.v2.fetch('/corp/web/send-sms-verifycode', { body: payload })
}

export interface ImageVerifyCode {
  id: string
  image: string
}

export async function getImageVerifyCode(api: WeilaApi, width = 160, height = 80): Promise<ImageVerifyCode> {
  return api.v2.fetch(`common/get-image-verifycode?width=${width}&height=${height}`, {})
}

export async function getSelfInfo(api: WeilaApi): Promise<SelfInfo> {
  return api.v2.fetch('corp/user/get-selfinfo', {})
}

export interface ChangePasswordPayload {
  old_password: string
  new_password: string
}

export async function changePassword(api: WeilaApi, payload: ChangePasswordPayload): Promise<void> {
  await api.v2.fetch('corp/user/change-password', { body: payload })
}
