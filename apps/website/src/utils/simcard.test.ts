import { describe, expect, it } from 'vitest'
import {
  exportFileName,
  formatFen,
  isExpired,
  readErrorMessage,
  toCardExportRow,
  toCreatedOrder,
  toOrderExportRow,
  toOrderRecord,
  toSimCard,
} from './simcard'

const simCardDto = {
  iccid: '8986112124008462501',
  expiry_date: '2026-12-24',
  product: 'CF02S',
  imei: '866507071045301',
  user_num: '300000010531',
  user_nick: '张三',
}

const orderDto = {
  amount: 3600,
  status: 1,
  charge_status: 0,
  order_no: 'WSM2026112010000000001',
  order_desc: '流量卡续费一年',
  iccid: '8986112124008462501',
  created: '2026-11-20 10:00:00',
}

const createdDto = {
  amount: 3600,
  currency: 'CNY',
  order_no: 'WSM2026112510000000009',
  product_desc: '流量卡续费一年',
  product_id: 'pkg-1',
  product_name: 'CF02S 续费包',
}

describe('toSimCard', () => {
  it('maps every documented snake_case field to the domain model', () => {
    expect(toSimCard(simCardDto)).toEqual({
      iccid: '8986112124008462501',
      expiryDate: '2026-12-24',
      product: 'CF02S',
      imei: '866507071045301',
      userNum: '300000010531',
      userNick: '张三',
    })
  })
})

describe('toOrderRecord', () => {
  it('maps the order fields', () => {
    expect(toOrderRecord(orderDto)).toEqual({
      amount: 3600,
      status: 1,
      chargeStatus: 0,
      orderNo: 'WSM2026112010000000001',
      orderDesc: '流量卡续费一年',
      iccid: '8986112124008462501',
      created: '2026-11-20 10:00:00',
    })
  })
})

describe('toCreatedOrder', () => {
  it('maps the created order fields', () => {
    expect(toCreatedOrder(createdDto)).toEqual({
      amount: 3600,
      currency: 'CNY',
      orderNo: 'WSM2026112510000000009',
      productDesc: '流量卡续费一年',
      productId: 'pkg-1',
      productName: 'CF02S 续费包',
    })
  })
})

describe('formatFen', () => {
  it('converts fen to a two-decimal yuan string', () => {
    expect(formatFen(3600)).toBe('36.00')
    expect(formatFen(2900)).toBe('29.00')
    expect(formatFen(1)).toBe('0.01')
    expect(formatFen(0)).toBe('0.00')
  })
})

describe('isExpired', () => {
  const today = new Date(2026, 10, 25)

  it('is true only when the expiry date is before today', () => {
    expect(isExpired('2026-11-24', today)).toBe(true)
    expect(isExpired('2026-11-25', today)).toBe(false)
    expect(isExpired('2026-11-26', today)).toBe(false)
  })

  it('treats a malformed expiry date as not expired', () => {
    expect(isExpired('', today)).toBe(false)
    expect(isExpired('2026/11/24', today)).toBe(false)
  })
})

describe('readErrorMessage', () => {
  it('reads errmsg from the JSON message of a business error', () => {
    const error = new Error(JSON.stringify({ errcode: 20, errmsg: '参数错误' }))
    expect(readErrorMessage(error)).toBe('参数错误')
  })

  it('reads errmsg from a plain error payload', () => {
    expect(readErrorMessage({ errcode: 20, errmsg: '卡号不存在' })).toBe('卡号不存在')
  })

  it('reads errmsg from an HTTP response context payload', () => {
    expect(readErrorMessage({
      response: { status: 500 },
      data: { errmsg: '服务异常' },
    })).toBe('服务异常')
  })

  it('returns an empty string when no errmsg exists', () => {
    expect(readErrorMessage(new Error('Failed to fetch'))).toBe('')
    expect(readErrorMessage(undefined)).toBe('')
  })
})

describe('toCardExportRow', () => {
  it('keeps ICCID and IMEI as text in column order', () => {
    expect(toCardExportRow(toSimCard(simCardDto))).toEqual([
      '8986112124008462501',
      '2026-12-24',
      'CF02S',
      '866507071045301',
      '300000010531',
      '张三',
    ])
  })
})

describe('toOrderExportRow', () => {
  const labels = {
    paid: '已支付',
    unpaid: '未支付',
    charged: '已到账',
    uncharged: '未到账',
  }

  it('renders a paid and charged order in yuan', () => {
    expect(toOrderExportRow({
      amount: 3600,
      status: 1,
      chargeStatus: 1,
      orderNo: 'WSM2026112010000000001',
      orderDesc: '流量卡续费一年',
      iccid: '8986112124008462501',
      created: '2026-11-20 10:00:00',
    }, labels)).toEqual([
      'WSM2026112010000000001',
      '8986112124008462501',
      36,
      '已支付',
      '已到账',
      '流量卡续费一年',
      '2026-11-20 10:00:00',
    ])
  })

  it('renders unpaid and uncharged states', () => {
    expect(toOrderExportRow(toOrderRecord({ ...orderDto, status: 0 }), labels)).toEqual([
      'WSM2026112010000000001',
      '8986112124008462501',
      36,
      '未支付',
      '未到账',
      '流量卡续费一年',
      '2026-11-20 10:00:00',
    ])
  })
})

describe('exportFileName', () => {
  it('appends the local date and the xlsx extension', () => {
    expect(exportFileName('流量卡-1个月内到期', new Date(2026, 10, 25))).toBe('流量卡-1个月内到期-2026-11-25.xlsx')
    expect(exportFileName('续费订单', new Date(2026, 0, 2))).toBe('续费订单-2026-01-02.xlsx')
  })
})
