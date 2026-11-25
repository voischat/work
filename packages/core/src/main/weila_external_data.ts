import {
  WL_IDbExtensionInfo,
  WL_IDbGroup,
  WL_IDbMsgData,
  WL_IDbService,
  WL_IDbServiceSessionInfo,
  WL_IDbServiceStaffInfo,
  WL_IDbUserInfo,
} from '../database/weila_db_data'
import type { WL_IDbSession } from '../database/weila_db_data'

interface WL_ExtEventCallback {
  (eventId: WL_ExtEventID, eventData: any): void
}

interface WL_PbMsgErrorInfo {
  resultCode: number
  errorMsg: string
}

interface WL_DataPrepareInd {
  state: WL_DataPrepareState
  msg: string
}

enum WL_DataPrepareState {
  START_PREPARING,
  PREPARE_PROGRESS_IND,
  PREPARE_SUCC_END,
  PREPARE_FAIL_END,
}

enum WL_PttAudioPlayState {
  PTT_AUDIO_PLAYING_START,
  PTT_AUDIO_PLAYING,
  PTT_AUDIO_PLAYING_END,
}

enum WL_PttAudioPlaySource {
  PTT_AUDIO_SRC_STREAM,
  PTT_AUDIO_SRC_HISTORY,
  PTT_AUDIO_SRC_SINGLE,
}

interface WL_PttPlayIndData {
  source: WL_PttAudioPlaySource
  state: WL_PttAudioPlayState
}

interface WL_PttPlayInd {
  msgData: WL_IDbMsgData
  indData: WL_PttPlayIndData
}

enum WL_PttRecordState {
  PTT_AUDIO_RECORDING_START,
  PTT_AUDIO_RECORDING,
  PTT_AUDIO_RECORDING_END,
}

interface WL_PttRecordInd {
  msgData: WL_IDbMsgData
  state: WL_PttRecordState
}

enum WL_ExtEventID {
  WL_EXT_DATA_PREPARE_IND,
  WL_EXT_SYSTEM_EXCEPTION_IND,
  WL_EXT_PTT_PLAY_IND,
  WL_EXT_PTT_RECORD_IND,
  WL_EXT_MSG_SEND_IND,
  WL_EXT_NEW_MSG_RECV_IND,
  WL_EXT_NEW_SESSION_OPEN_IND,
  WL_EXT_SESSION_UPDATED_IND,
  WL_EXT_NEW_NOTIFICATION_IND,
  WL_EXT_GROUP_MODIFIED_IND,
  WL_EXT_GROUP_MEMBERS_MODIFIED_IND,
  WL_EXT_GROUP_DELETED_IND,
  WL_EXT_GROUP_MEMBER_DELETED_IND,
  WL_EXT_GROUP_NEW_MEMBER_JOINED_IND,
  WL_EXT_FRIEND_DELETED_IND,
  WL_EXT_FRIEND_MODIFIED_IND,
  WL_EXT_FRIEND_NEW_IND,

  WL_EXT_COMMON_SESSION_CHANGE_IND,
  WL_EXT_COMMON_STAFF_INVITE_IND,
  WL_EXT_COMMON_ANSWER_INVITE_IND,
  WL_EXT_STAFF_ACCEPT_SESSION_IND,
  WL_EXT_STAFF_EXIT_SESSION_IND,
  WL_EXT_STAFF_CLOSE_SESSION_IND,
  WL_EXT_STAFF_SESSION_INVITE_IND,
  WL_EXT_STAFF_ANSWER_INVITE_IND,
  WL_EXT_STAFF_REMOVED_SESSION_IND,
  WL_EXT_DEVICE_BINDING_ANSWER_IND,
  WL_EXT_KICKOUT_IND,
  WL_EXT_MSG_AUDIO_READY_IND,
}

interface WL_KickoutInfo {
  reason: number
  reasonText: string
}

type WL_SubscribeTopic = 'sessionList' | 'messages'

interface WL_SessionListCallback {
  (sessions: WL_IDbSession[]): void
}

interface WL_MessagesFilter {
  sessionId: string
  sessionType: number
}

interface WL_MessagesCallback {
  (msgData: WL_IDbMsgData): void
}

interface WL_SubscribeOptions<F = undefined> {
  filter?: F
  immediately?: boolean
}

interface WL_SubscribeMap {
  sessionList: {
    callback: WL_SessionListCallback
    options?: WL_SubscribeOptions
  }
  messages: {
    callback: WL_MessagesCallback
    options: WL_SubscribeOptions<WL_MessagesFilter>
  }
}

enum WL_AnswerStatus {
  ANSWER_NORMAL = 0x00,
  ANSWER_ACCEPT = 0x01,
  ANSWER_REJECT = 0x02,
  ANSWER_IGNORE = 0x03,
}

interface WL_FriendInviteInfo {
  inviterUserInfo: WL_IDbUserInfo | undefined
  inviteDetail: string
  createdTime: number
  status: WL_AnswerStatus
}

interface WL_FriendAnswerInviteInfo {
  inviteeUserInfo: WL_IDbUserInfo | undefined
  status: WL_AnswerStatus
}

interface WL_GroupInviteInfo {
  groupInfo: WL_IDbGroup | undefined
  invitorUserInfo: WL_IDbUserInfo | undefined
  status: WL_AnswerStatus
}

interface WL_GroupAnswerInviteInfo {
  groupInfo: WL_IDbGroup | undefined
  invitorUserInfo: WL_IDbUserInfo | undefined
  inviteeUserInfo: WL_IDbUserInfo | undefined
  status: WL_AnswerStatus
  updated: number
}

interface WL_GroupJoinInfo {
  groupInfo: WL_IDbGroup | undefined
  joinUserInfo: WL_IDbUserInfo | undefined
  status: WL_AnswerStatus
  detail: string
}

interface WL_GroupAnswerJoinInfo {
  groupInfo: WL_IDbGroup | undefined
  joinUserInfo: WL_IDbUserInfo | undefined
  answerUserInfo: WL_IDbUserInfo | undefined
  status: WL_AnswerStatus
  updated: number
}

interface WL_GroupMemberDeleteInfo {
  groupId: string
  initiatorId: number
  userIdList: number[]
}

interface WL_StaffInvite {
  service: WL_IDbService
  invitorInfo: WL_IDbServiceStaffInfo
  content?: string
}

interface WL_CommonAnswerStaffInvite {
  serviceId: number
  userId: number
  status: WL_AnswerStatus
}

interface WL_StaffSessionInfo {
  sessionId: string
  staffId: number
}

interface WL_ServiceSessionInvite {
  session: WL_IDbServiceSessionInfo
  content?: string
}

interface WL_StaffAnswerSessionInvite {
  sessionId: string
  invitee: WL_IDbServiceStaffInfo
  status: WL_AnswerStatus
}

interface WL_bindAnswerInfo {
  status: WL_AnswerStatus
  deviceInfo: WL_IDbExtensionInfo
  verifyCode: string
  userInfo: WL_IDbUserInfo
}

export {
  WL_PbMsgErrorInfo,
  WL_ExtEventID,
  WL_DataPrepareState,
  WL_ExtEventCallback,
  WL_PttAudioPlayState,
  WL_PttPlayInd,
  WL_PttRecordState,
  WL_PttRecordInd,
  WL_AnswerStatus,
  WL_DataPrepareInd,
  WL_FriendInviteInfo,
  WL_FriendAnswerInviteInfo,
  WL_GroupInviteInfo,
  WL_GroupAnswerInviteInfo,
  WL_GroupJoinInfo,
  WL_GroupAnswerJoinInfo,
  WL_PttPlayIndData,
  WL_PttAudioPlaySource,
  WL_CommonAnswerStaffInvite,
  WL_StaffInvite,
  WL_StaffSessionInfo,
  WL_ServiceSessionInvite,
  WL_StaffAnswerSessionInvite,
  WL_bindAnswerInfo,
  WL_GroupMemberDeleteInfo,
  WL_KickoutInfo,
  WL_SubscribeTopic,
  WL_SessionListCallback,
  WL_MessagesFilter,
  WL_MessagesCallback,
  WL_SubscribeOptions,
  WL_SubscribeMap,
}
