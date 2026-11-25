import { WL_IDbMsgDataType } from 'db/weila_db_data'
import type { WL_IDbFileData } from 'db/weila_db_data'

interface ParsedServiceMsgData {
  msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE
  fileInfo: WL_IDbFileData
}

interface ServiceMsgContent {
  url?: string
}

interface ServiceMsgPayload {
  service_type?: string
  content?: ServiceMsgContent
}

function parseHttpUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  try {
    const parsed = new URL(value)

    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}

function parseImageContent(
  content: ServiceMsgContent | undefined,
): ParsedServiceMsgData | undefined {
  const url = parseHttpUrl(content?.url)

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
  (content: ServiceMsgContent | undefined) => ParsedServiceMsgData | undefined
>([['image', parseImageContent]])

function isServiceMsgPayload(value: unknown): value is ServiceMsgPayload {
  return typeof value === 'object' && value !== null
}

export function parseSessionServiceMsg(serviceData: string): ParsedServiceMsgData | undefined {
  let payload: unknown

  try {
    payload = JSON.parse(serviceData)
  } catch {
    return undefined
  }

  if (!isServiceMsgPayload(payload)) {
    return undefined
  }

  return SERVICE_CONTENT_PARSERS.get(payload.service_type ?? '')?.(payload.content)
}
