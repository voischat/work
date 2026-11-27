import Message from '@arco-design/web-vue/es/message'

export const ERROR_TOAST_DURATION_MS = 3_000

const lastShownAt = new Map<string, number>()

export function toastError(message: string) {
  const now = Date.now()
  if (now - (lastShownAt.get(message) ?? 0) < ERROR_TOAST_DURATION_MS)
    return

  lastShownAt.set(message, now)
  Message.error({ content: message, duration: ERROR_TOAST_DURATION_MS })
  setTimeout(() => {
    if (lastShownAt.get(message) === now)
      lastShownAt.delete(message)
  }, ERROR_TOAST_DURATION_MS)
}
