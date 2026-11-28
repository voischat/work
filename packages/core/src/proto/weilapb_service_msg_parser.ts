import { WL_IDbMsgDataType } from 'db/weila_db_data'
import type { WL_MsgContent } from 'db/weila_db_data'
import { isRecord, isString, type JsonValue } from 'main/weila_type_guards'

type ServiceMsgContent = Record<string, JsonValue>

interface ServiceMsgPayload {
  service_type: string
  content?: ServiceMsgContent
}

type ServiceContentParser = (content: ServiceMsgContent | undefined) => WL_MsgContent | undefined

const SERVICE_MSG_TYPE = WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE

function isNumberValue(value: JsonValue | undefined): value is number {
  return typeof value === 'number'
}

function readString(content: ServiceMsgContent | undefined, key: string): string | undefined {
  const value = content?.[key]

  return isString(value) ? value : undefined
}

function readNumber(content: ServiceMsgContent | undefined, key: string): number | undefined {
  const value = content?.[key]

  if (isNumberValue(value)) {
    return Number.isFinite(value) ? value : undefined
  }

  if (!isString(value) || value.trim() === '') {
    return undefined
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : undefined
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

function readHttpUrl(content: ServiceMsgContent | undefined, key: string): string | undefined {
  return parseHttpUrl(readString(content, key))
}

function parseImageContent(content: ServiceMsgContent | undefined): WL_MsgContent | undefined {
  const url = readHttpUrl(content, 'url')

  if (url === undefined) {
    return undefined
  }

  return {
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE,
    fileInfo: { fileSize: 0, fileName: '', fileUrl: url },
  }
}

function parseVideoContent(content: ServiceMsgContent | undefined): WL_MsgContent | undefined {
  const url = readHttpUrl(content, 'url')

  if (url === undefined) {
    return undefined
  }

  return {
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE,
    fileInfo: {
      fileUrl: url,
      fileThumbnail: readHttpUrl(content, 'thumb'),
      fileName: readString(content, 'name') ?? '',
      fileSize: readNumber(content, 'size') ?? 0,
    },
  }
}

function parseFileContent(content: ServiceMsgContent | undefined): WL_MsgContent | undefined {
  const url = readHttpUrl(content, 'url')
  const name = readString(content, 'name')

  if (url === undefined || !name) {
    return undefined
  }

  return {
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE,
    fileInfo: {
      fileUrl: url,
      fileThumbnail: readHttpUrl(content, 'thumb'),
      fileName: name,
      fileSize: readNumber(content, 'size') ?? 0,
    },
  }
}

function parseLocationContent(content: ServiceMsgContent | undefined): WL_MsgContent | undefined {
  const latitude = readNumber(content, 'latitude')
  const longitude = readNumber(content, 'longitude')

  if (
    latitude === undefined ||
    longitude === undefined ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return undefined
  }

  return {
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_LOCATION_TYPE,
    location: {
      locationType: readString(content, 'type') ?? '',
      latitude,
      longitude,
      name: readString(content, 'name'),
      address: readString(content, 'address'),
      mapUrl: readHttpUrl(content, 'url'),
    },
  }
}

function parseQrcodeContent(content: ServiceMsgContent | undefined): WL_MsgContent | undefined {
  const url = readHttpUrl(content, 'url')

  if (url === undefined) {
    return undefined
  }

  return {
    msgType: SERVICE_MSG_TYPE,
    servicePayload: {
      type: 'qrcode',
      url,
      name: readString(content, 'name'),
      desc: readString(content, 'desc'),
      sessionId: readString(content, 'session_id'),
      sessionType: readNumber(content, 'session_type'),
    },
  }
}

function parseMember(value: JsonValue): Array<{ userId: number; nick: string }> {
  if (!isRecord(value)) {
    return []
  }

  const userId = readNumber(value, 'user_id')
  const nick = readString(value, 'nick')

  if (userId === undefined || nick === undefined) {
    return []
  }

  return [{ userId, nick }]
}

function parseMemberChangeContent(
  content: ServiceMsgContent | undefined,
): WL_MsgContent | undefined {
  const action = readString(content, 'action')
  const rawMembers = content?.members

  if ((action !== 'join' && action !== 'exit') || !Array.isArray(rawMembers)) {
    return undefined
  }

  const members = rawMembers.flatMap(parseMember)

  if (!members.length) {
    return undefined
  }

  return {
    msgType: SERVICE_MSG_TYPE,
    servicePayload: { type: 'session-member-change', action, members },
  }
}

function parseGroupDestroyContent(): WL_MsgContent {
  return { msgType: SERVICE_MSG_TYPE, servicePayload: { type: 'group-destroy' } }
}

interface AlarmUserFields {
  userId?: number
  userNumber?: string
  userNick?: string
  userAvatar?: string
}

function readAlarmUser(content: ServiceMsgContent | undefined): AlarmUserFields {
  return {
    userId: readNumber(content, 'user_id'),
    userNumber: readString(content, 'user_number'),
    userNick: readString(content, 'user_nick'),
    userAvatar: readString(content, 'user_avatar'),
  }
}

function parseAlarmPowerContent(content: ServiceMsgContent | undefined): WL_MsgContent {
  return {
    msgType: SERVICE_MSG_TYPE,
    servicePayload: {
      type: 'alarm-power',
      ...readAlarmUser(content),
      timestamp: readNumber(content, 'timestamp'),
      info: readString(content, 'info'),
    },
  }
}

function parseAlarmGeofenceContent(content: ServiceMsgContent | undefined): WL_MsgContent {
  return {
    msgType: SERVICE_MSG_TYPE,
    servicePayload: {
      type: 'alarm-geofence',
      ...readAlarmUser(content),
      geofenceId: readNumber(content, 'geofence_id'),
      latitude: readNumber(content, 'latitude'),
      longitude: readNumber(content, 'longitude'),
      locationType: readNumber(content, 'location_type'),
      transitionType: readNumber(content, 'transition_type'),
      timestamp: readNumber(content, 'timestamp'),
      address: readString(content, 'addr'),
    },
  }
}

function parseAlarmSosContent(content: ServiceMsgContent | undefined): WL_MsgContent {
  return {
    msgType: SERVICE_MSG_TYPE,
    servicePayload: {
      type: 'alarm-sos',
      ...readAlarmUser(content),
      latitude: readNumber(content, 'latitude'),
      longitude: readNumber(content, 'longitude'),
      locationType: readNumber(content, 'location_type'),
      timestamp: readNumber(content, 'timestamp'),
      address: readString(content, 'addr'),
      info: readString(content, 'info'),
    },
  }
}

const SERVICE_CONTENT_PARSERS = new Map<string, ServiceContentParser>([
  ['image', parseImageContent],
  ['video', parseVideoContent],
  ['file', parseFileContent],
  ['location', parseLocationContent],
  ['qrcode', parseQrcodeContent],
  ['session-member-change', parseMemberChangeContent],
  ['group-destroy', parseGroupDestroyContent],
  ['alarm-power', parseAlarmPowerContent],
  ['alarm-geofence', parseAlarmGeofenceContent],
  ['alarm-sos', parseAlarmSosContent],
])

function isServiceMsgPayload(value: unknown): value is ServiceMsgPayload {
  if (!isRecord(value)) {
    return false
  }

  const { service_type, content } = value

  return isString(service_type) && (content === undefined || isRecord(content))
}

function unknownServiceContent(raw: string): WL_MsgContent {
  return { msgType: SERVICE_MSG_TYPE, servicePayload: { type: 'unknown', raw } }
}

export function parseSessionServiceMsg(serviceData: string): WL_MsgContent {
  let payload: unknown

  try {
    payload = JSON.parse(serviceData)
  } catch {
    return unknownServiceContent(serviceData)
  }

  if (!isServiceMsgPayload(payload)) {
    return unknownServiceContent(serviceData)
  }

  return (
    SERVICE_CONTENT_PARSERS.get(payload.service_type)?.(payload.content) ??
    unknownServiceContent(serviceData)
  )
}
