import type {
  CreatedRenewOrderDto,
  RenewOrderRecordDto,
  SimCardDto,
} from '~/api/simcard'

export interface SimCard {
  iccid: string
  expiryDate: string
  product: string
  imei: string
  userNum: string
  userNick: string
}

export interface RenewOrderRecord {
  amount: number
  status: number
  chargeStatus: number
  orderNo: string
  orderDesc: string
  iccid: string
  created: string
}

export interface CreatedRenewOrder {
  amount: number
  currency: string
  orderNo: string
  productDesc: string
  productId: string
  productName: string
}

export interface RenewOrderStatusLabels {
  paid: string
  unpaid: string
  charged: string
  uncharged: string
}

export function toSimCard(dto: SimCardDto): SimCard {
  return {
    iccid: dto.iccid,
    expiryDate: dto.expiry_date,
    product: dto.product,
    imei: dto.imei,
    userNum: dto.user_num,
    userNick: dto.user_nick,
  }
}

export function toOrderRecord(dto: RenewOrderRecordDto): RenewOrderRecord {
  return {
    amount: dto.amount,
    status: dto.status,
    chargeStatus: dto.charge_status,
    orderNo: dto.order_no,
    orderDesc: dto.order_desc,
    iccid: dto.iccid,
    created: dto.created,
  }
}

export function toCreatedOrder(dto: CreatedRenewOrderDto): CreatedRenewOrder {
  return {
    amount: dto.amount,
    currency: dto.currency,
    orderNo: dto.order_no,
    productDesc: dto.product_desc,
    productId: dto.product_id,
    productName: dto.product_name,
  }
}

export function formatFen(amount: number): string {
  return (amount / 100).toFixed(2)
}

export function isExpired(expiryDate: string, today: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate))
    return false
  return expiryDate < formatDay(today)
}

export function readErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object')
    return ''

  const record = error as { message?: unknown, errmsg?: unknown, data?: unknown }
  const payload = parseJsonMessage(record.message)
  if (typeof payload?.errmsg === 'string')
    return payload.errmsg

  if (typeof record.errmsg === 'string')
    return record.errmsg

  const data = record.data
  if (data && typeof data === 'object') {
    const { errmsg } = data as { errmsg?: unknown }
    if (typeof errmsg === 'string')
      return errmsg
  }

  return ''
}

export function toCardExportRow(card: SimCard): (string | number)[] {
  return [
    card.iccid,
    card.expiryDate,
    card.product,
    card.imei,
    card.userNum,
    card.userNick,
  ]
}

export function toOrderExportRow(
  order: RenewOrderRecord,
  labels: RenewOrderStatusLabels,
): (string | number)[] {
  return [
    order.orderNo,
    order.iccid,
    Number(formatFen(order.amount)),
    order.status === 1
      ? labels.paid
      : labels.unpaid,
    order.chargeStatus === 1
      ? labels.charged
      : labels.uncharged,
    order.orderDesc,
    order.created,
  ]
}

export function exportFileName(label: string, today: Date): string {
  return `${label}-${formatDay(today)}.xlsx`
}

function formatDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseJsonMessage(message: unknown): { errmsg?: unknown } | undefined {
  if (typeof message !== 'string')
    return undefined

  try {
    const parsed: unknown = JSON.parse(message)
    return parsed && typeof parsed === 'object'
      ? parsed as { errmsg?: unknown }
      : undefined
  }
  catch {
    return undefined
  }
}
