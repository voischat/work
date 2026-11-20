import { describe, expect, it, vi } from 'vitest'
import { isHttpResponseContext, rethrowAxiosErrors } from './networkErrors'

describe('isHttpResponseContext', () => {
  it('recognizes the ofetch context thrown for an HTTP error', () => {
    expect(isHttpResponseContext({
      request: 'url',
      response: { status: 500 },
    })).toBe(true)
    expect(isHttpResponseContext({
      response: { status: 404 },
    })).toBe(true)
  })

  it('does not treat business or transport errors as HTTP contexts', () => {
    expect(isHttpResponseContext(new Error(JSON.stringify({ errcode: 20 })))).toBe(false)
    expect(isHttpResponseContext(new TypeError('Failed to fetch'))).toBe(false)
    expect(isHttpResponseContext(undefined)).toBe(false)
  })
})

describe('rethrowAxiosErrors', () => {
  it('reports the error and rejects instead of resolving undefined', async () => {
    const report = vi.fn(async (_error: unknown) => {})
    const request = {
      interceptors: {
        response: {
          handlers: [
            { rejected: report },
          ],
        },
      },
    }

    rethrowAxiosErrors(request)

    const error = new Error('HTTP 500')
    await expect(request.interceptors.response.handlers[0]!.rejected!(error)).rejects.toBe(error)
    expect(report).toHaveBeenCalledWith(error)
  })

  it('leaves handlers without a rejection callback alone', () => {
    const request = {
      interceptors: {
        response: {
          handlers: [
            { rejected: undefined },
          ],
        },
      },
    }
    expect(() => rethrowAxiosErrors(request)).not.toThrow()
  })
})
