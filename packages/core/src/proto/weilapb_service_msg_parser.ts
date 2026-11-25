import { WL_IDbMsgDataType } from 'db/weila_db_data'
import type { WL_IDbFileData, WL_IDbLocationShared } from 'db/weila_db_data'

interface ParsedServiceMsgData {
  msgType: WL_IDbMsgDataType
  fileInfo?: WL_IDbFileData
  location?: WL_IDbLocationShared
}

type ParsedServiceContent = Pick<ParsedServiceMsgData, 'msgType' | 'fileInfo' | 'location'>

function parseHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  try {
    const parsed = new URL(value)

    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}

function parseImageContent(content: unknown): ParsedServiceContent | undefined {
  if (typeof content !== 'object' || content === null) {
    return undefined
  }

  const url = parseHttpUrl((content as { url?: unknown }).url)

  if (url === undefined) {
    return undefined
  }

  return {
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE,
    fileInfo: { fileSize: 0, fileName: '', fileUrl: url },
  }
}

const SERVICE_CONTENT_PARSERS = new Map<
  string,
  (content: unknown) => ParsedServiceContent | undefined
>([['image', parseImageContent]])

export function parseSessionServiceMsg(serviceData: string): ParsedServiceMsgData | undefined {
  let raw: unknown

  try {
    raw = JSON.parse(serviceData)
  } catch {
    return undefined
  }

  if (typeof raw !== 'object' || raw === null) {
    return undefined
  }

  const record = raw as { service_type?: unknown; content?: unknown }

  if (typeof record.service_type !== 'string') {
    return undefined
  }

  return SERVICE_CONTENT_PARSERS.get(record.service_type)?.(record.content)
}
