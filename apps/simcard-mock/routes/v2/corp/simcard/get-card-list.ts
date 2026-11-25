import { defineHandler } from 'void'
import { fail, ok, readJson } from '../../../../src/http'
import { listCards } from '../../../../src/data'

export const POST = defineHandler(async (c) => {
  const body = await readJson(c.req.raw)
  const type = body.type
  if (type !== 'expiring_in_30d' && type !== 'renewable') return fail(20, '参数错误')
  return ok({ cards: listCards(type) })
})
