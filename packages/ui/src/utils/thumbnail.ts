export type ThumbnailMediaKind = 'image' | 'video'

const THUMBNAIL_PROCESS: Record<ThumbnailMediaKind, string> = {
  image: 'style/hw320',
  video: 'video/snapshot,t_0,f_jpg,m_fast,w_320,ar_auto',
}

export function getMessageThumbnailUrl(
  fileUrl: string | undefined,
  kind: ThumbnailMediaKind,
): string {
  if (!fileUrl) return ''

  const separator = fileUrl.includes('?') ? '&' : '?'
  return `${fileUrl}${separator}x-oss-process=${THUMBNAIL_PROCESS[kind]}`
}
