import { WLBuildMsgRet, WLMsgHeader } from 'proto/weilapb_wrapper_data'
import { WL_IDbUserInfo, WL_AudioMsgData } from 'db/weila_db_data'
import { WLPlayerType } from 'audio/weila_audio_data'
import { WL } from 'proto/weilapb'
import { WL_ExtEventID, WL_ExtEventPayload, WL_PttPlayIndData } from 'main/weila_external_data'

type WL_PromiseResult = boolean | number | WL_IDbUserInfo | undefined

interface WL_PromiseCallback<T = WL_PromiseResult> {
  resolve: (data: T) => void
  reject: (reason: Error) => void
}

const default_user_logo =
  'https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/default/user_avatar_default.png'

const default_group_logo = 'https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/default/session.png'

enum WL_NetworkState {
  NET_CONNECTING_STATE,
  NET_CONNECTED_STATE,
  NET_DISCONNECTING_STATE,
  NET_DISCONNECTED_STATE,
}

enum WL_NetworkEventID {
  NET_WEBSOCK_ADDR_SET_EVT,
  NET_EXCEPTION_IND_EVT,
  NET_CONNECT_EVT,
  NET_DISCONNECT_EVT,
  NET_SEND_DATA_EVT,
  NET_STATE_IND_EVT,
  NET_MSG_RECV_IND_EVT,
}

type WL_NetworkEventPayload = string | number | Uint8Array | null | undefined

interface WL_NetworkEvent {
  eventId: WL_NetworkEventID
  eventData: unknown
}

interface WL_PbMsgData {
  header: WLMsgHeader
  pbMsgData?: unknown
}

interface WL_PbMsgHandler {
  (data: WL.Service.IServiceMessage): void
}

interface WL_LoginParam {
  retryCount: number
  account: string
  password: string
  countryCode: string
  md5: boolean
  callback: WL_PromiseCallback<WL_IDbUserInfo | undefined>
}

interface WL_LoginResult {
  callback: WL_PromiseCallback<WL_IDbUserInfo | undefined>
  loginUserInfo?: WL_IDbUserInfo
  error?: unknown
}

type WL_PbMsgResponse =
  | WL.Business.IRspCommonGetSessions
  | WL.Business.IRspCommonGetStaffInvite
  | WL.Business.IRspStaffSearchStaffs
  | WL.Friend.IRspGetFriendInfo
  | WL.Friend.IRspGetFriendUserInfo
  | WL.Friend.IRspGetOnlineFriend
  | WL.Group.IRspAddSubMember
  | WL.Group.IRspChangeGroupAttribute
  | WL.Group.IRspCreateGroup
  | WL.Group.IRspGetGroupAttribute
  | WL.Group.IRspGetGroupInfo
  | WL.Group.IRspGetGroupOnlineMember
  | WL.Group.IRspGetGroupVersion
  | WL.Group.IRspGetMemberUserInfo
  | WL.Group.IRspGetSubGroupAttribute
  | WL.Group.IRspGroupBroadcast
  | WL.Group.IRspGroupInvite
  | WL.Group.IRspGroupJoin
  | WL.Location.IRspGetLocation
  | WL.Login.IRspBindExtension
  | WL.Login.IRspGetExtensionList
  | WL.Login.IRspLoginApp
  | WL.Login.IRspRefreshAccessToken
  | WL.Login.IRspSetExtensionConfig
  | WL.Login.IRspUnbindExtension
  | WL.Session.IRspGetMsg
  | WL.Session.IRspGetSession
  | WL.Session.IRspMsgRead
  | WL.User.IRspGetUserInfo
  | WL.User.IRspSetConfig
  | null
  | undefined
  | boolean

interface WL_CoreInterface {
  sendExtEvent(event: WL_ExtEventID, data: WL_ExtEventPayload): void
  sendPbMsg<T = WL_PbMsgResponse>(buildPbMsg: WLBuildMsgRet, timeout?: number): Promise<T>
  rspPbMsg(seq: number, resultCode: number, data: WL_PbMsgResponse): void
  registerPbMsgHandler(serviceId: number, handler: WL_PbMsgHandler): void
  executeCoreFunc<T = unknown>(funcName: string, ...argvs: unknown[]): Promise<T>
  getLoginUserInfo(): WL_IDbUserInfo
}

interface WL_PttPayload {
  frameCount: number
  data: Uint8Array
}

interface WL_PttAudioItem {
  id: string
  msgData: WL_AudioMsgData
  payloadList: WL_PttPayload[]
  priority: number
  isCompleted: boolean
  recvWaitTimerId: ReturnType<typeof setTimeout> | null
  playIndex: number
  playerType: WLPlayerType
  shouldSave: boolean
}

enum WL_PttPackType {
  PTT_FIRST_PACK = 0x00,
  PTT_INTER_PACK = 0x01,
  PTT_END_PACK = 0x02,
  PTT_WHOLE_PACK = 0x03,
}

interface WL_PttPacket {
  seq: number
  seqInPackage: number
  sourceType: number
  frameCount: number
  mark: WL_PttPackType
  data: Uint8Array
}

interface WL_PttFsmListener {
  onPlayInd(audioItem: WL_PttAudioItem | null | undefined, playIndData: WL_PttPlayIndData): void
  onRecordPttPacketInd(pttPacket: WL_PttPacket): void
}

export {
  WL_PbMsgResponse,
  WL_PromiseCallback,
  default_user_logo,
  default_group_logo,
  WL_PbMsgHandler,
  WL_CoreInterface,
  WL_NetworkEvent,
  WL_NetworkEventID,
  WL_NetworkEventPayload,
  WL_NetworkState,
  WL_PbMsgData,
  WL_LoginParam,
  WL_LoginResult,
  WL_PttAudioItem,
  WL_PttPayload,
  WL_PttPacket,
  WL_PttFsmListener,
  WL_PttPackType,
}
