export interface SimCardDto {
  iccid: string
  expiry_date: string
  product: string
  imei: string
  user_num: string
  user_nick: string
}

export interface RenewOrderRecordDto {
  amount: number
  status: number
  charge_status: number
  order_no: string
  order_desc: string
  iccid: string
  created: string
}

export interface CreatedRenewOrderDto {
  amount: number
  currency: string
  order_no: string
  product_desc: string
  product_id: string
  product_name: string
}

export interface RenewSummaryDto {
  expiring_in_30d: number
  renewable: number
}

export interface CardListDto {
  cards: SimCardDto[]
}

export interface OrderListDto {
  orders: RenewOrderRecordDto[]
}

export type SimCardWindow = 'expiring_in_30d' | 'renewable'

export const SIMCARD_RENEW_SUMMARY_ENDPOINT = 'corp/simcard/get-renew-summary'
export const SIMCARD_CARD_LIST_ENDPOINT = 'corp/simcard/get-card-list'
export const SIMCARD_ORDER_LIST_ENDPOINT = 'corp/simcard/get-order-list'
export const SIMCARD_CREATE_RENEW_ORDER_ENDPOINT = 'subuser/simcard-create-renew-order'
export const SIMCARD_PKG_NAME = 'com.voistech.weila'
