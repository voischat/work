import { WL } from 'proto/weilapb'
import type {
  WL_FriendAnswerInviteInfo,
  WL_FriendInviteInfo,
  WL_GroupAnswerJoinInfo,
  WL_GroupInviteInfo,
  WL_GroupJoinInfo,
} from 'main/weila_external_data'
import { isRecord, isString, type JsonValue } from 'main/weila_type_guards'
import { dbEnum } from './db_enum'

enum WL_IDbSettingID {
  SETTING_LOGIN_TOKEN,
  SETTING_SESSION_LATEST_UPDATE,
  SETTING_FRIEND_LATEST_UPDATE,
  SETTING_GROUP_LATEST_UPDATE,
  SETTING_SUB_USERINFO_VER_UPDATE,
  SETTING_MSG_SENDING_SEQ,
  SETTING_CORP_SESSION_LATEST_UPDATE,
}

type WL_IDbSettingData = string | number | null

interface WL_IDbSetting {
  id: WL_IDbSettingID
  data: WL_IDbSettingData
}

enum WL_IDbSessionStatus {
  SESSION_ACTIVATE,
  SESSION_DEACTIVATE,
  SESSION_INVALID,
}

const WL_IDbSessionType = {
  SESSION_INDIVIDUAL_TYPE: WL.Common.SessionType.SESSION_TYPE_SINGLE,

  SESSION_GROUP_TYPE: WL.Common.SessionType.SESSION_TYPE_GROUP,

  SESSION_ROOM_TYPE: WL.Common.SessionType.SESSION_TYPE_ROOM,

  SESSION_SERVICE_TYPE: WL.Common.SessionType.SESSION_TYPE_SERVICE,

  SESSION_CORP_INDIVIDUAL_TYPE: WL.Common.SessionType.SESSION_TYPE_CORP_SINGLE,

  SESSION_CORP_GROUP_TYPE: WL.Common.SessionType.SESSION_TYPE_CORP_GROUP,

  SESSION_CORP_GROUP_TMP_TYPE: WL.Common.SessionType.SESSION_TYPE_CORP_GROUP_TMP,
} as const

type WL_IDbSessionType = (typeof WL_IDbSessionType)[keyof typeof WL_IDbSessionType]

function isIndividualSessionType(sessionType: number): boolean {
  return (
    dbEnum<WL_IDbSessionType>(sessionType) === WL_IDbSessionType.SESSION_INDIVIDUAL_TYPE ||
    dbEnum<WL_IDbSessionType>(sessionType) === WL_IDbSessionType.SESSION_CORP_INDIVIDUAL_TYPE
  )
}

function isGroupSessionType(sessionType: number): boolean {
  return (
    dbEnum<WL_IDbSessionType>(sessionType) === WL_IDbSessionType.SESSION_GROUP_TYPE ||
    dbEnum<WL_IDbSessionType>(sessionType) === WL_IDbSessionType.SESSION_CORP_GROUP_TYPE ||
    dbEnum<WL_IDbSessionType>(sessionType) === WL_IDbSessionType.SESSION_CORP_GROUP_TMP_TYPE
  )
}

function isServiceSessionType(sessionType: number): boolean {
  return dbEnum<WL_IDbSessionType>(sessionType) === WL_IDbSessionType.SESSION_SERVICE_TYPE
}

function applySessionExtraProfile(session: WL_IDbSession): boolean {
  const { sessionName, sessionAvatar } = getSessionExtraProfile(session.extra)

  if (!sessionName && !sessionAvatar) {
    return false
  }

  if (sessionName) {
    session.sessionName = sessionName
  }

  if (sessionAvatar) {
    session.sessionAvatar = sessionAvatar
  }

  session.status = WL_IDbSessionStatus.SESSION_ACTIVATE

  return true
}

interface SessionExtraProfile {
  sessionName?: string
  sessionAvatar?: string
}

function getSessionExtraProfile(extra: JsonValue | undefined): SessionExtraProfile {
  if (!isRecord(extra)) {
    return {}
  }

  const sessionName = [extra.sessionName, extra.name, extra.nick].find(isString)
  const sessionAvatar = [extra.sessionAvatar, extra.avatar].find(isString)

  return { sessionName, sessionAvatar }
}

function inheritSessionProfile(session: WL_IDbSession, existingSession?: WL_IDbSession): void {
  if (!existingSession) {
    return
  }

  const extra = isRecord(existingSession.extra) ? { ...existingSession.extra } : {}

  const { sessionName, sessionAvatar } = getSessionExtraProfile(extra)

  if (!sessionName && existingSession.sessionName) {
    extra.sessionName = existingSession.sessionName
  }

  if (!sessionAvatar && existingSession.sessionAvatar) {
    extra.sessionAvatar = existingSession.sessionAvatar
  }

  if (Object.keys(extra).length) {
    session.extra = extra
  }
}

type WL_IDbSessionExtra = {
  sessionName?: string
  sessionAvatar?: string
  memberCount?: number
} & Record<string, JsonValue>

interface WL_IDbSession {
  combo_id_type: string
  sessionId: string
  sessionType: WL_IDbSessionType
  sessionName: string
  sessionAvatar: string
  readMsgId: number
  lastMsgId: number
  unreadCount?: number
  latestUpdate: number
  status: WL_IDbSessionStatus
  extra?: WL_IDbSessionExtra
  lastMsgData?: WL_IDbMsgData
}

interface WL_IDbSessionSettingParams {
  tts?: boolean
  mute?: boolean
  loactionShared?: boolean
}

interface WL_SessionProfileUpdate {
  sessionName?: string
  sessionAvatar?: string
  memberCount?: number
  extra?: WL_IDbSessionExtra
}

interface WL_Profile {
  name?: string
  avatar?: string
  weilaNum?: string
  memberCount?: number
  extra?: WL_IDbSessionExtra
}

type WL_ProfileResolver = (userId: number) => Promise<WL_Profile | null | undefined>

type WL_GroupProfileResolver = (groupId: string) => Promise<WL_Profile | null | undefined>

type WL_SessionProfileResolver = (
  session: WL_IDbSession,
) => Promise<WL_SessionProfileUpdate | null | undefined>

interface WL_IDbSessionSetting {
  combo_id_type: string
  sessionId: string
  sessionType: number
  tts: boolean
  mute: boolean
  loactionShared: boolean
}

interface WL_IDbUserInfo {
  userId: number
  weilaNum: string
  sex: number
  nick: string
  pinyinName: string
  avatar: string
  email?: string
  phone?: string
  countryCode?: string
  status: number
  signature?: string
  userType: number
  created: number
}

enum WL_IDbGroupType {
  GROUP_NORMAL = 0x1,
  GROUP_TEMP = 0x2,
  GROUP_COMPANY_NORMAL = 0x21,
  GROUP_COMPANY_DEPT = 0x22,
}

enum WL_IDbGroupPublicType {
  GROUP_PUBLIC_CLOSE = 0x01,
  GROUP_PUBLIC_OPEN = 0x02,
}

enum WL_IDbGroupAuthType {
  GROUP_AUTH_NONE = 1,
  GROUP_AUTH_CONFIRM = 2,
  GROUP_AUTH_CONFIRM_OR_PASSWORD = 3,
  GROUP_AUTH_CONFIRM_AND_PASSWORD = 4,
}

enum WL_IDbMemberType {
  NORMAL_MEMBER_TYPE = 0x01,
  ADMIN_MEMBER_TYPE = 0x02,
}

interface WL_IDbGroup {
  groupId: string
  name: string
  pinyinName: string
  avatar: string
  groupNum: string
  ownerId: number
  groupType: WL_IDbGroupType
  desc?: string
  publicType: WL_IDbGroupPublicType
  authType: WL_IDbGroupAuthType
  groupClass: number
  audioQuality: number
  speechEnable: boolean
  home?: string
  latitude?: string
  longitude?: string
  burstType: number
  memberLimit: number
  memberCount: number
  memberVersion: number
  version: number
  created: number
}

enum WL_IDbMemberStatus {
  MEMBER_NORMAL_STATUS,
  MEMBER_QUIT_STATUS,
}

interface WL_IDbMemberInfo {
  combo_gid_uid: string
  groupId: string
  userId: number
  status: WL_IDbMemberStatus
  memberType: WL_IDbMemberType
  remark?: string
  priority: number
  speechEnable: boolean
  speechDisableTimeout: number
  blockedStatus: boolean
  tts: boolean
  locationShared: boolean
  created: number
}

interface WL_IDbGroupMember {
  memberInfo: WL_IDbMemberInfo
  userInfo?: WL_IDbUserInfo
}

enum WL_IDbFriendStatus {
  FRIEND_NORMAL_STATUS,
  FRIEND_DELETED_STATUS,
}

interface WL_IDbFriendInfo {
  userId: number
  status: WL_IDbFriendStatus
  remark?: string
  label?: string
  desc?: string
  blockedStatus: boolean
  tts: boolean
  locationShared: boolean
  extension?: string
}

interface WL_IDbFriend {
  friendInfo: WL_IDbFriendInfo
  userInfo: WL_IDbUserInfo | null
}

enum WL_IDbMsgDataType {
  WL_DB_MSG_DATA_TEXT_TYPE,
  WL_DB_MSG_DATA_AUDIO_TYPE,
  WL_DB_MSG_DATA_IMAGE_TYPE,
  WL_DB_MSG_DATA_VIDEO_TYPE,
  WL_DB_MSG_DATA_FILE_TYPE,
  WL_DB_MSG_DATA_LOCATION_TYPE,
  WL_DB_MSG_DATA_COMMAND_TYPE,
  WL_DB_MSG_DATA_PTT_TYPE,
  WL_DB_MSG_DATA_SERVICE_TYPE,
  WL_DB_MSG_DATA_SWITCH_TYPE,
  WL_DB_MSG_DATA_WITHDRAW_TYPE,
  WL_DB_MSG_DATA_UNKNOWN_TYPE,
}

enum WL_IDbMsgDataStatus {
  WL_DB_MSG_DATA_STATUS_NEW,
  WL_DB_MSG_DATA_STATUS_SENT,
  WL_DB_MSG_DATA_STATUS_UNSENT,
  WL_DB_MSG_DATA_STATUS_READ,
  WL_DB_MSG_DATA_STATUS_SENDING,
  WL_DB_MSG_DATA_STATUS_WITHDRAW,
  WL_DB_MSG_DATA_STATUS_ERR,
}

interface WL_IDbAudioData {
  frameCount: number
  data?: Uint8Array
  audioUrl?: string
}

interface WL_IDbFileData {
  fileSize: number
  fileName?: string
  fileUrl?: string
  fileThumbnail?: string
}

interface WL_IDbLocationShared {
  locationType: string
  latitude: number
  longitude: number
  title?: string
  name?: string
  address?: string
  mapUrl?: string
}

type WL_IDbServicePayload =
  | {
      type: 'qrcode'
      url?: string
      name?: string
      desc?: string
      sessionId?: string
      sessionType?: number
    }
  | {
      type: 'session-member-change'
      action: 'join' | 'exit'
      members: Array<{ userId: number; nick: string }>
    }
  | { type: 'group-destroy' }
  | {
      type: 'alarm-power'
      userId?: number
      userNumber?: string
      userNick?: string
      userAvatar?: string
      timestamp?: number
      info?: string
    }
  | {
      type: 'alarm-geofence'
      userId?: number
      userNumber?: string
      userNick?: string
      userAvatar?: string
      geofenceId?: number
      latitude?: number
      longitude?: number
      locationType?: number
      transitionType?: number
      timestamp?: number
      address?: string
    }
  | {
      type: 'alarm-sos'
      userId?: number
      userNumber?: string
      userNick?: string
      userAvatar?: string
      latitude?: number
      longitude?: number
      locationType?: number
      timestamp?: number
      address?: string
      info?: string
    }
  | { type: 'unknown'; raw: string }

interface WL_IDbPttData {
  seq: number
  seqInPackage: number
  sourceType: number
  frameCount: number
  mark: number
  data: Uint8Array
}

interface WL_MsgBase {
  combo_id: string
  senderId: number
  sessionId: string
  sessionType: number
  msgId: number
  created: number
  autoReply: number
  status: WL_IDbMsgDataStatus
  tag?: string
}

type WL_MediaMsgType =
  | WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE
  | WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE
  | WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE

type WL_MsgContent =
  | { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE; textData: string }
  | {
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_AUDIO_TYPE
      audioData: WL_IDbAudioData
      pttData?: WL_IDbPttData
    }
  | { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE; fileInfo: WL_IDbFileData }
  | { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE; fileInfo: WL_IDbFileData }
  | { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE; fileInfo: WL_IDbFileData }
  | { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_LOCATION_TYPE; location: WL_IDbLocationShared }
  | { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_COMMAND_TYPE; command: string }
  | { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_PTT_TYPE; pttData: WL_IDbPttData }
  | {
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE
      servicePayload: WL_IDbServicePayload
    }
  | { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SWITCH_TYPE; switchData?: string }
  | { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_WITHDRAW_TYPE; withdrawMsgId?: number }
  | { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_UNKNOWN_TYPE }

type WL_MsgWithEnvelope<T> = T extends unknown ? WL_MsgBase & T : never

type WL_IDbMsgData = WL_MsgWithEnvelope<WL_MsgContent>

type WL_TextMsgData = Extract<
  WL_IDbMsgData,
  { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE }
>

type WL_AudioMsgData = Extract<
  WL_IDbMsgData,
  { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_AUDIO_TYPE }
>

type WL_MediaMsgData<T extends WL_MediaMsgType = WL_MediaMsgType> = T extends unknown
  ? WL_MsgBase & { msgType: T; fileInfo: WL_IDbFileData }
  : never

type WL_ImageMsgData = WL_MediaMsgData<WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE>

type WL_VideoMsgData = WL_MediaMsgData<WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE>

type WL_FileMsgData = WL_MediaMsgData<WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE>

type WL_LocationMsgData = Extract<
  WL_IDbMsgData,
  { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_LOCATION_TYPE }
>

type WL_PttMsgData = Extract<WL_IDbMsgData, { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_PTT_TYPE }>

type WL_ServiceMsgData = Extract<
  WL_IDbMsgData,
  { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE }
>

type WL_UnknownMsgData = Extract<
  WL_IDbMsgData,
  { msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_UNKNOWN_TYPE }
>

interface WL_IDbLocationInfo {
  userId: number
  clientType: number
  locationType: number
  latitude: number
  longitude: number
  speed: number
  altitude: number
  radius: number
  timestamp: number
  direction: number
}

enum WL_IDbNotificationType {
  FRIEND_INVITE_NOTIFICATION,
  FRIEND_ANSWER_NOTIFICATION,
  GROUP_INVITE_NOTIFICATION,
  GROUP_JOIN_NOTIFICATION,
  GROUP_ANSWER_INVITE_NOTIFICATION,
  GROUP_ANSWER_JOIN_NOTIFICATION,
}

type WL_IDbNotificationData =
  | WL_GroupInviteInfo
  | WL_GroupJoinInfo
  | WL_GroupAnswerJoinInfo
  | WL_FriendInviteInfo
  | WL_FriendAnswerInviteInfo

interface WL_IDbNotification {
  id: number
  notificationType: WL_IDbNotificationType
  data: WL_IDbNotificationData
  createTime: number
}

enum WL_IDbExtensionState {
  EXTENSION_UNBIND,
  EXTENSION_BINDING,
  EXTENSION_BOUND,
  EXTENSION_LOCKED,
}

enum WL_IDbExtensionType {
  EXTENSION_SLAVE,
  EXTENSION_SUB,
}

interface WL_IDbExtension {
  info: WL_IDbExtensionInfo
  userInfo: WL_IDbUserInfo
  supervisor: WL_IDbUserInfo
}

interface WL_IDbExtensionInfo {
  imei: string
  state: WL_IDbExtensionState
  productName: string
  extensionType: WL_IDbExtensionType
  userId: number
  supervisorId: number
  status: number
  version: string
  config: string
  groupLimit: number
  groupCount: number
  activeTime: number
  warrant: number
  createdTime: number
}

interface WL_IDbService {
  serviceId: number
  serviceNum: string
  serviceType: number
  serviceClass: number
  name: string
  avatar: string
  intro: string
  url: string
  createdTime: number
}

interface WL_IDbServiceStaff {
  userId: number
  staffType: number
  admin: number
  staffClass: number
  isOperator: boolean
  createdTime: number
}

interface WL_IDbServiceStaffInfo {
  staff: WL_IDbServiceStaff
  userData: WL_IDbUserInfo
}

enum WL_ServiceStatus {
  SERVICE_STATUS_INIT,
  SERVICE_STATUS_PROCESSING,
  SERVICE_STATUS_TERMINATE,
  SERVICE_STATUS_FINISH,
  SERVICE_STATUS_DISPATCH_TIMEOUT,
  SERVICE_STATUS_MSG_TIMEOUT,
  SERVICE_STATUS_STAFF_MISSING,
}

type WL_IDbServiceSession = {
  serviceId: number
  customerId: number
  staffIds: number[]
  serviceStatus: WL_ServiceStatus
  createdTime: number
  updatedTime: number
}

type WL_IDbServiceSessionRecord = WL_IDbServiceSession & {
  sessionId: string
}

interface WL_IDbServiceSessionInfo {
  service: WL_IDbService
  customer: WL_IDbUserInfo | undefined
  staffs: WL_IDbServiceStaffInfo[]
  serviceSession: WL_IDbServiceSession
}

function isFileData(value: unknown): value is WL_IDbFileData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fileName' in value &&
    'fileUrl' in value &&
    'fileSize' in value
  )
}

function isLocationShared(value: unknown): value is WL_IDbLocationShared {
  return (
    typeof value === 'object' && value !== null && !('fileName' in value) && !('sender' in value)
  )
}

function isAudioData(value: unknown): value is WL_IDbAudioData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'frameCount' in value &&
    ('audioUrl' in value || 'data' in value)
  )
}

function isPttData(value: unknown): value is WL_IDbPttData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'seq' in value &&
    'seqInPackage' in value &&
    'mark' in value &&
    'data' in value
  )
}

export {
  WL_IDbSettingID,
  WL_IDbSetting,
  WL_IDbSessionStatus,
  WL_IDbSession,
  WL_IDbSessionExtra,
  WL_Profile,
  WL_ProfileResolver,
  WL_GroupProfileResolver,
  WL_SessionProfileUpdate,
  WL_SessionProfileResolver,
  WL_IDbSessionType,
  isIndividualSessionType,
  isGroupSessionType,
  isServiceSessionType,
  applySessionExtraProfile,
  inheritSessionProfile,
  WL_IDbSessionSetting,
  WL_IDbUserInfo,
  WL_IDbSessionSettingParams,
  WL_IDbGroupType,
  WL_IDbGroupPublicType,
  WL_IDbGroupAuthType,
  WL_IDbMemberType,
  WL_IDbGroup,
  WL_IDbMemberStatus,
  WL_IDbMemberInfo,
  WL_IDbGroupMember,
  WL_IDbFriendStatus,
  WL_IDbFriendInfo,
  WL_IDbFriend,
  WL_IDbMsgDataType,
  WL_IDbMsgDataStatus,
  WL_IDbAudioData,
  WL_IDbFileData,
  WL_IDbLocationShared,
  WL_IDbServicePayload,
  WL_IDbPttData,
  isFileData,
  isLocationShared,
  isAudioData,
  isPttData,
  WL_MsgBase,
  WL_MediaMsgType,
  WL_MsgContent,
  WL_IDbMsgData,
  WL_TextMsgData,
  WL_AudioMsgData,
  WL_MediaMsgData,
  WL_ImageMsgData,
  WL_VideoMsgData,
  WL_FileMsgData,
  WL_LocationMsgData,
  WL_PttMsgData,
  WL_ServiceMsgData,
  WL_UnknownMsgData,
  WL_IDbLocationInfo,
  WL_IDbNotificationType,
  WL_IDbNotification,
  WL_IDbExtension,
  WL_IDbExtensionInfo,
  WL_IDbExtensionState,
  WL_IDbService,
  WL_IDbServiceStaff,
  WL_IDbServiceSession,
  WL_IDbServiceSessionRecord,
  WL_ServiceStatus,
  WL_IDbServiceStaffInfo,
  WL_IDbServiceSessionInfo,
  WL_IDbExtensionType,
}
