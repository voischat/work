import { defineHandler } from 'void'
import { add } from '../add.ts'

export const GET = defineHandler((c) => {
  const a = Number(c.req.query('a') ?? 0)
  const b = Number(c.req.query('b') ?? 0)

  return { sum: add(a, b) }
})
