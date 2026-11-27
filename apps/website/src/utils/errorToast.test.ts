import Message from '@arco-design/web-vue/es/message'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_TOAST_DURATION_MS, toastError } from './errorToast'

vi.mock('@arco-design/web-vue/es/message', () => ({
  default: {
    error: vi.fn(),
  },
}))

const error = vi.mocked(Message.error)

describe('toastError', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    error.mockClear()
  })

  it('collapses repeats while the toast is on screen and toasts again once it closes', () => {
    const message = '重复提交失败，稍后重试 A'

    toastError(message)
    expect(error).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(ERROR_TOAST_DURATION_MS - 1)
    toastError(message)
    expect(error).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    toastError(message)
    expect(error).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenLastCalledWith({ content: message, duration: ERROR_TOAST_DURATION_MS })
  })

  it('toasts two distinct messages immediately', () => {
    const first = '重复提交失败，稍后重试 B'
    const second = '重复提交失败，稍后重试 C'

    toastError(first)
    toastError(second)

    expect(error).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenNthCalledWith(1, { content: first, duration: ERROR_TOAST_DURATION_MS })
    expect(error).toHaveBeenNthCalledWith(2, { content: second, duration: ERROR_TOAST_DURATION_MS })
  })
})
