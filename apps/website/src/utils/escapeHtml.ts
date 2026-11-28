const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '\"': '&quot;',
  '\'': '&#39;',
}

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const SAFE_IMAGE_URL = /^[\w./:%@!$&*+,;=?#[\]~-]+$/

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => HTML_ESCAPES[char] ?? char)
}

export function safeImageUrl(url: string | undefined): string {
  if (!url)
    return ''

  const stripped = url.replace(/^https?:/i, '')

  if (URL_SCHEME.test(stripped) || !SAFE_IMAGE_URL.test(stripped))
    return ''

  return stripped
}
