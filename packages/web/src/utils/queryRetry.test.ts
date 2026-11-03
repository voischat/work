import { describe, expect, it } from 'vitest'
import { shouldRetryQuery } from './queryRetry'

function businessError(errcode: number, errmsg = '参数错误') {
  return new Error(JSON.stringify({ errcode, errmsg }))
}

describe('shouldRetryQuery', () => {
  it('does not retry a business error, whose result is deterministic', () => {
    expect(shouldRetryQuery(0, businessError(20))).toBe(false)
    expect(shouldRetryQuery(0, businessError(32))).toBe(false)
  })

  it('reads the errcode from a plain object carrying the JSON message', () => {
    expect(shouldRetryQuery(0, { message: JSON.stringify({ errcode: 20 }) })).toBe(false)
  })

  it('retries a transport error until the attempt budget runs out', () => {
    const error = new TypeError('Failed to fetch')
    expect(shouldRetryQuery(0, error)).toBe(true)
    expect(shouldRetryQuery(3, error)).toBe(true)
    expect(shouldRetryQuery(4, error)).toBe(false)
  })

  it('retries when the message is not the business-error JSON', () => {
    expect(shouldRetryQuery(0, new Error('{"errcode":'))).toBe(true)
    expect(shouldRetryQuery(0, new Error(JSON.stringify({ errmsg: '参数错误' })))).toBe(true)
  })
})
