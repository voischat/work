export interface MockSimCard {
  iccid: string
  expiry_date: string
  product: string
  imei: string
  user_num: string
  user_nick: string
}

export interface MockOrder {
  amount: number
  status: number
  charge_status: number
  order_no: string
  order_desc: string
  iccid: string
  created: string
}

export interface RenewSummary {
  expiring_in_30d: number
  renewable: number
}

const DAY_MS = 86_400_000

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function today(): Date {
  return startOfDay(new Date())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  const day = result.getDate()
  result.setMonth(result.getMonth() + months)
  if (result.getDate() < day) result.setDate(0)
  return result
}

function formatDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDateTime(date: Date): string {
  return `${formatDay(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

function parseDay(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function isExpiringIn30Days(expiry: string, now = today()): boolean {
  const day = parseDay(expiry)
  if (!day) return false
  return day.getTime() >= now.getTime() && day.getTime() <= addDays(now, 30).getTime()
}

function isRenewable(expiry: string, now = today()): boolean {
  const day = parseDay(expiry)
  if (!day) return false
  return day.getTime() <= addMonths(now, 6).getTime()
}

function card(seq: number, expiryOffsetDays: number, product: string, nick: string): MockSimCard {
  return {
    iccid: `89861121240084625${String(seq).padStart(2, '0')}`,
    expiry_date: formatDay(addDays(today(), expiryOffsetDays)),
    product,
    imei: `86650707104530${seq}`,
    user_num: `30000001053${seq}`,
    user_nick: nick,
  }
}

const cards: MockSimCard[] = [
  card(1, 3, 'CF02S', '张三'),
  card(2, 20, 'CF02S', '李四'),
  card(3, 100, 'CF03S', '王五'),
  card(4, 300, 'CF03S', '赵六'),
  card(5, -10, 'CF02S', '钱七'),
]

function seedOrder(
  orderNo: string,
  iccid: string,
  daysAgo: number,
  amount: number,
  status: number,
  chargeStatus: number,
): MockOrder {
  const created = addDays(today(), -daysAgo)
  return {
    amount,
    status,
    charge_status: chargeStatus,
    order_no: orderNo,
    order_desc: '流量卡续费一年',
    iccid,
    created: formatDateTime(created),
  }
}

const orders: MockOrder[] = [
  seedOrder('WSM2026112010000000001', '8986112124008462501', 5, 3600, 1, 1),
  seedOrder('WSM2026112111000000002', '8986112124008462502', 4, 2900, 1, 0),
  seedOrder('WSM2026112212000000003', '8986112124008462503', 3, 3600, 0, 0),
  seedOrder('WSM2026112313000000004', '8986112124008462501', 2, 3600, 1, 1),
]

export function summarize(now = today()): RenewSummary {
  return {
    expiring_in_30d: cards.filter((item) => isExpiringIn30Days(item.expiry_date, now)).length,
    renewable: cards.filter((item) => isRenewable(item.expiry_date, now)).length,
  }
}

export function listCards(type: 'expiring_in_30d' | 'renewable', now = today()): MockSimCard[] {
  const match = type === 'expiring_in_30d' ? isExpiringIn30Days : isRenewable
  return cards
    .filter((item) => match(item.expiry_date, now))
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
}

export function paidOrders(): MockOrder[] {
  return orders
    .filter((item) => item.status === 1)
    .sort((a, b) => b.created.localeCompare(a.created))
}
