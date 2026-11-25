export function toChatSafeUploadUrl(raw: unknown, baseUrl: string): string {
  const value = typeof raw === 'string'
    ? raw
    : raw && typeof raw === 'object' && typeof (raw as { url?: unknown }).url === 'string'
      ? (raw as { url: string }).url
      : ''

  if (!value) {
    throw new Error('上传接口未返回文件地址')
  }

  const url = new URL(value, baseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('上传接口返回了不支持的地址')
  }

  url.protocol = 'https:'
  url.hash = ''
  url.search = ''
  return url.href
}
