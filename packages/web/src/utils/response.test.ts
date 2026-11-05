import { describe, expect, it } from 'vitest'
import { pickFromResponse } from './response'

describe('pickFromResponse', () => {
  it('returns a value that the network layer already unwrapped', () => {
    const business = { sid: 1, name: 'shop' }
    expect(pickFromResponse(business, ['business'])).toBe(business)
  })

  it('picks a key from a multi-key payload', () => {
    const payload = { count: 1, tracks: [{ lat: 1 }] }
    expect(pickFromResponse(payload, ['tracks'])).toEqual([{ lat: 1 }])
  })

  it('returns arrays that the network layer already unwrapped', () => {
    const points = [{ id: 1 }]
    expect(pickFromResponse(points, ['points'])).toBe(points)
  })

  it('returns null and primitives unchanged', () => {
    expect(pickFromResponse(null, ['business'])).toBeNull()
    expect(pickFromResponse(undefined, ['business'])).toBeUndefined()
    expect(pickFromResponse(0, ['business'])).toBe(0)
  })

  it('picks every present key when several are requested', () => {
    const payload = { a: 1, b: 2, c: 3 }
    expect(pickFromResponse(payload, ['a', 'c', 'missing'])).toEqual({ a: 1, c: 3 })
  })

  it('returns the original value when no requested key exists', () => {
    const payload = { business: { sid: 1 } }
    expect(pickFromResponse(payload, ['legal'])).toBe(payload)
  })
})
