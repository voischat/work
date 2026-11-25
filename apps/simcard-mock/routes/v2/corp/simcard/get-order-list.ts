import { defineHandler } from 'void'
import { ok } from '../../../../src/http'
import { paidOrders } from '../../../../src/data'

export const POST = defineHandler(() => ok({ orders: paidOrders() }))
