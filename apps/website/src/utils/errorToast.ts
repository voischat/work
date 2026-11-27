import Message from '@arco-design/web-vue/es/message'

const ERROR_TOAST_WINDOW_MS = 10_000

const recentErrorToasts = new Map<string, number>()

export function toastError(message: string) {
  const now = Date.now()
  if (now - (recentErrorToasts.get(message) ?? 0) < ERROR_TOAST_WINDOW_MS)
    return

  recentErrorToasts.set(message, now)
  Message.error(message)
  setTimeout(() => {
    if (recentErrorToasts.get(message) === now)
      recentErrorToasts.delete(message)
  }, ERROR_TOAST_WINDOW_MS)
}
