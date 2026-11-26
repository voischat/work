/* oxlint-disable import/default -- worker-rspack-loader emits this module as a Worker factory with a default export */
import Network from 'main/weila_network.worker'
/* oxlint-enable import/default */
import WeilaPbDispatcher from 'main/weila_pb_dispatcher'
import WeilaNetworkGateway from 'main/weila_network_gateway'
import WeilaMainFsmHost from 'main/weila_main_fsm_host'
import { fsmEvents, mainFsm } from 'fsm/weila_fsmScript'
import type { MainActor } from 'fsm/weila_fsmScript'
import { createActor } from 'xstate'
import Long from 'long'

import {
  WL_CoreInterface,
  WL_LoginParam,
  WL_NetworkEvent,
  WL_NetworkEventID,
  WL_PbMsgHandler,
  WL_PromiseCallback,
} from 'main/weila_internal_data'
import { WLBuildMsgRet } from 'proto/weilapb_wrapper_data'
import {
  WL_IDbAudioData,
  WL_IDbExtension,
  WL_IDbExtensionInfo,
  WL_IDbFileData,
  WL_IDbFriend,
  WL_IDbGroup,
  WL_IDbGroupAuthType,
  WL_IDbGroupMember,
  WL_IDbGroupPublicType,
  WL_IDbGroupType,
  WL_IDbLocationInfo,
  WL_IDbLocationShared,
  WL_IDbMsgData,
  WL_IDbMsgDataStatus,
  WL_IDbMsgDataType,
  WL_IDbNotification,
  WL_IDbServiceSession,
  WL_IDbServiceSessionInfo,
  WL_IDbServiceStaffInfo,
  WL_IDbSession,
  WL_IDbSessionSetting,
  WL_IDbSessionSettingParams,
  WL_IDbSessionType,
  WL_GroupProfileResolver,
  WL_Profile,
  WL_ProfileResolver,
  WL_SessionProfileResolver,
  WL_SessionProfileUpdate,
  WL_IDbSettingID,
  WL_IDbUserInfo,
  isGroupSessionType,
  isIndividualSessionType,
} from 'db/weila_db_data'
import { dbEnum } from 'db/db_enum'
import { getLogger } from 'log/weila_log'
import { fetchAudioDataFromUrl, getMsgDataIdByCombo } from 'main/weila_utils'
import { isCallable, isRecord } from 'main/weila_type_guards'
import WLLoginModule from 'main/weila_login_module'
import WLSessionModule from 'main/weila_session_module'
import WLFriendModule from 'main/weila_friend_module'
import WLGroupModule from 'main/weila_group_module'
import WLLocationModule from 'main/weila_location_module'
import WLUserModule from 'main/weila_user_module'
import { WeilaDB } from 'db/weila_db'
import { TinyEmitter } from 'tiny-emitter'
import {
  WL_AnswerStatus,
  WL_DataPrepareState,
  WL_ExtEventCallback,
  WL_ExtEventID,
  WL_PttAudioPlaySource,
  WL_PttAudioPlayState,
  WL_SubscribeMap,
  WL_SubscribeTopic,
} from 'main/weila_external_data'
import { AliOssHelper } from 'main/weila_ali_oss'
import { TextMsgDataParser } from 'proto/weilapb_textmsg_parser'
import WLBusinessModule from 'main/weila_business_module'

const wllog = getLogger('CORE:info')
const wlerr = getLogger('CORE:err')

interface WL_SubscribeRequest {
  topic: WL_SubscribeTopic
  callback: WL_SubscribeMap[WL_SubscribeTopic]['callback']
  options?: WL_SubscribeMap[WL_SubscribeTopic]['options']
}

function isSessionListRequest(request: WL_SubscribeRequest): request is WL_SubscribeRequest & {
  topic: 'sessionList'
  callback: WL_SubscribeMap['sessionList']['callback']
  options?: WL_SubscribeMap['sessionList']['options']
} {
  return request.topic === 'sessionList'
}

function isMessagesRequest(request: WL_SubscribeRequest): request is WL_SubscribeRequest & {
  topic: 'messages'
  callback: WL_SubscribeMap['messages']['callback']
  options?: WL_SubscribeMap['messages']['options']
} {
  return request.topic === 'messages'
}

export interface WL_InitOptions {
  appId?: string
  appKey?: string
  webSock?: string
}

export interface WL_LoginOptions {
  md5?: boolean
}

export type WL_FileUploader = (file: File, fileName: string) => Promise<string>

class WeilaCore implements WL_CoreInterface {
  readonly maxRetryLoginTimes = 2
  mainFsm?: typeof mainFsm
  mainFsmService!: MainActor
  network?: Worker
  pbDispatcher: WeilaPbDispatcher
  networkGateway: WeilaNetworkGateway
  pbMsgHandlerList: Map<number, WL_PbMsgHandler>
  loginUserInfo?: WL_IDbUserInfo
  loginModule: WLLoginModule
  sessionModule: WLSessionModule
  friendModule: WLFriendModule
  groupModule: WLGroupModule
  businessModule: WLBusinessModule
  locationModule: WLLocationModule
  userModule: WLUserModule
  isLoginReady: boolean
  emitter: TinyEmitter
  profileResolver?: WL_ProfileResolver
  groupProfileResolver?: WL_GroupProfileResolver
  sessionProfileResolver?: WL_SessionProfileResolver
  fileUploader?: WL_FileUploader
  resolvingSessionProfileKeys: Set<string>

  constructor() {
    this.emitter = new TinyEmitter()
    this.isLoginReady = false
    this.resolvingSessionProfileKeys = new Set()
    this.pbDispatcher = new WeilaPbDispatcher((reqData) => {
      this.sendNetworkEvent(WL_NetworkEventID.NET_SEND_DATA_EVT, reqData)
    })
    this.pbMsgHandlerList = new Map<number, WL_PbMsgHandler>()
    this.networkGateway = new WeilaNetworkGateway({
      sendToFsm: (event) => this.mainFsmService.send(event),
      dispatcher: this.pbDispatcher,
      pbMsgHandlers: this.pbMsgHandlerList,
    })

    this.network = new Network()
    this.network.addEventListener('message', this.onNetworkMessage.bind(this))

    this.loginModule = new WLLoginModule(this)
    this.friendModule = new WLFriendModule(this)
    this.groupModule = new WLGroupModule(this)
    this.businessModule = new WLBusinessModule(this)
    this.sessionModule = new WLSessionModule(this)
    this.locationModule = new WLLocationModule(this)
    this.userModule = new WLUserModule(this)

    this.mainFsm = new WeilaMainFsmHost({
      sendNetworkEvent: (event, data) => this.sendNetworkEvent(event, data),
      sendExtEvent: (event, data) => this.sendExtEvent(event, data),
      sendToFsm: (event) => this.mainFsmService.send(event),
      setLoginUserInfo: (userInfo) => {
        this.loginUserInfo = userInfo
      },
      setLoginReady: (ready) => {
        this.isLoginReady = ready
      },
      requestLogout: () => this.weila_logout(),
      checkWaitingTimeouts: () => this.pbDispatcher.checkTimeouts(),
      maxRetryLoginTimes: this.maxRetryLoginTimes,
      loginModule: this.loginModule,
      friendModule: this.friendModule,
      groupModule: this.groupModule,
      businessModule: this.businessModule,
      sessionModule: this.sessionModule,
    }).buildMachine()

    this.mainFsmService = createActor(this.mainFsm, { input: { loginParam: null, core: this } })

    const previousState = { current: this.mainFsmService.getSnapshot() }
    this.mainFsmService.subscribe((state: { value: unknown }) => {
      wllog(
        '从状态:%s ===> 状态:%s',
        JSON.stringify(previousState.current.value),
        JSON.stringify(state.value),
      )
      previousState.current = state
    })
    this.mainFsmService.start()
  }

  sendExtEvent(event: WL_ExtEventID, data: any): void {
    this.emitter.emit('ext_event', event, data)
  }

  getLoginUserInfo(): WL_IDbUserInfo {
    if (!this.loginUserInfo) {
      throw new Error('尚未登录，无法获取用户信息')
    }

    return this.loginUserInfo
  }

  registerPbMsgHandler(serviceId: number, handler: WL_PbMsgHandler): void {
    this.pbMsgHandlerList.set(serviceId, handler)
  }

  rspPbMsg(seq: number, resultCode: number, data: any): void {
    this.pbDispatcher.rspPbMsg(seq, resultCode, data)
  }

  async executeCoreFunc(funcName: string, ...argvs: any[]): Promise<any> {
    // SAFETY: executeCoreFunc is the SDK's external dispatch surface: the SDK
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion, anti-slop/no-unsafe-dictionary-type -- dispatch by name over the class's own shape
    const method: unknown = (this as Record<string, unknown>)[funcName]

    if (isCallable(method)) {
      return method.call(this, ...argvs)
    }

    return Promise.reject(new Error('Not Support Function:' + funcName))
  }

  sendPbMsg(buildPbMsg: WLBuildMsgRet, timeout?: number): Promise<any> {
    return this.pbDispatcher.sendPbMsg(buildPbMsg, timeout)
  }

  private sendNetworkEvent(eventId: WL_NetworkEventID, eventData: any) {
    const netEvent: WL_NetworkEvent = { eventId, eventData }
    this.network?.postMessage(netEvent, [])
  }

  private onNetworkMessage(event: MessageEvent<WL_NetworkEvent>) {
    this.networkGateway.onNetworkMessage(event)
  }

  public weila_onEvent(callback: WL_ExtEventCallback): void {
    this.emitter.on('ext_event', callback)
  }

  public async weila_init(options?: WL_InitOptions): Promise<boolean> {
    const { appId, appKey, webSock } = options ?? {}

    if (webSock) {
      this.weila_setWebSock(webSock)
    }

    if (options && ('appId' in options || 'appKey' in options)) {
      if (!appId || !appKey) {
        return Promise.reject(new Error('appId and appKey must be provided together'))
      }

      this.weila_setAuthInfo(appId, appKey)
    }

    return new Promise<boolean>((resolve, reject) => {
      const callback: WL_PromiseCallback = { resolve, reject }
      this.mainFsmService.send({ type: fsmEvents.FSM_LOAD_RESOURCE_EVT, data: callback })
    })
  }

  public async weila_login(
    account: string,
    password: string,
    countryCode: string,
    options: WL_LoginOptions = {},
  ): Promise<WL_IDbUserInfo> {
    return new Promise<WL_IDbUserInfo>((resolve, reject) => {
      const params: WL_LoginParam = {
        retryCount: 0,
        callback: { resolve, reject },
        account,
        password,
        countryCode,
        md5: options.md5 ?? true,
      }

      this.mainFsmService.send({ type: fsmEvents.FSM_LOGIN_SERVER_EVT, data: params })
    })
  }

  public async weila_audioInit(): Promise<boolean> {
    return this.sessionModule.initAudioSystem()
  }

  public async weila_playSingle(audioMsgData: WL_IDbMsgData): Promise<boolean> {
    const ready = await this.sessionModule.prepareSinglePlayback(audioMsgData)

    if (!ready) {
      this.notifySinglePlayFailed(audioMsgData)

      return false
    }

    return this.sessionModule.playSingleAudioItem(audioMsgData)
  }

  private notifySinglePlayFailed(msgData: WL_IDbMsgData): void {
    this.sendExtEvent(WL_ExtEventID.WL_EXT_PTT_PLAY_IND, {
      msgData,
      indData: {
        source: WL_PttAudioPlaySource.PTT_AUDIO_SRC_SINGLE,
        state: WL_PttAudioPlayState.PTT_AUDIO_PLAYING_END,
      },
    })
  }

  public weila_stopSingle(): Promise<void> {
    return this.sessionModule.stopPlayAudio()
  }

  public weila_pauseSingle(): void {
    this.sessionModule.pausePlayAudio()
  }

  public weila_resumeSingle(): void {
    this.sessionModule.resumePlayAudio()
  }

  public weila_getSinglePlayProgress(): Promise<number> {
    return this.sessionModule.getSinglePlayProgressMs()
  }

  public async weila_playHistoryList(audioMsgDatas: WL_IDbMsgData[]): Promise<boolean> {
    audioMsgDatas = audioMsgDatas.filter((value) => {
      return (
        value.msgType === WL_IDbMsgDataType.WL_DB_MSG_DATA_AUDIO_TYPE &&
        value.status !== WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_ERR
      )
    })

    for (let msgData of audioMsgDatas) {
      const audioData = msgData.audioData

      if (audioData && !audioData.data && audioData.audioUrl) {
        const audioUrl = audioData.audioUrl.replace(/^http(?!s)/, 'https')
        msgData.audioData = await this.weila_fetchAudioData(audioUrl)

        if (!msgData.audioData) {
          msgData.status = WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_ERR
        }

        await WeilaDB.getInstance().putMsgData(msgData)
      }
    }

    audioMsgDatas = audioMsgDatas.filter((value) => {
      return value.status !== WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_ERR
    })

    return this.sessionModule.playHistoryAudioItems(audioMsgDatas)
  }

  public async weila_getMsgData(comboId: string): Promise<WL_IDbMsgData | undefined> {
    return WeilaDB.getInstance().getMsgData(comboId)
  }

  public async weila_getMsgDatas(
    sessionId: string,
    sessionType: number,
    fromMsgId: number,
    count: number,
  ): Promise<WL_IDbMsgData[]> {
    const result = await this.sessionModule.getMsgDatas(sessionId, sessionType, fromMsgId, count)

    return (result ?? []).toReversed()
  }

  public async weila_requestTalk(sessionId: string, sessionType: number): Promise<boolean> {
    return this.sessionModule.requestTalk(sessionId, sessionType)
  }

  public async weila_releaseTalk(): Promise<boolean> {
    return this.sessionModule.releaseTalk()
  }

  public async weila_logout(): Promise<boolean> {
    this.sessionModule.clearActiveSessionState()

    this.mainFsmService.send({ type: 'FSM_LOGOUT_EVT' })

    return true
  }

  public async weila_getGroupMembers(groupId: string): Promise<WL_IDbGroupMember[]> {
    return WeilaDB.getInstance().getGroupMembers(groupId)
  }

  public async weila_getGroup(groupId: string): Promise<WL_IDbGroup | undefined> {
    let group = await WeilaDB.getInstance().getGroup(groupId)

    if ((group?.name && group.avatar) || !this.groupProfileResolver) {
      return group
    }

    const profile = await this.resolveGroupProfile(groupId)

    if (!profile?.name && !profile?.avatar) {
      return group
    }

    group = {
      ...group,
      groupId,
      groupNum: group?.groupNum || groupId,
      groupType: group?.groupType ?? WL_IDbGroupType.GROUP_TEMP,
      groupClass: group?.groupClass ?? 0,
      name: profile.name || group?.name || groupId,
      pinyinName: group?.pinyinName || '',
      avatar: profile.avatar || group?.avatar || '',
      memberCount: group?.memberCount ?? 0,
      memberLimit: group?.memberLimit ?? 0,
      memberVersion: group?.memberVersion ?? 0,
      version: group?.version ?? 0,
      ownerId: group?.ownerId ?? 0,
      speechEnable: group?.speechEnable ?? false,
      audioQuality: group?.audioQuality ?? 0,
      authType: dbEnum<WL_IDbGroupAuthType>(group?.authType),
      publicType: dbEnum<WL_IDbGroupPublicType>(group?.publicType),
      burstType: group?.burstType ?? 0,
      created: group?.created ?? 0,
    }
    await WeilaDB.getInstance().putGroup(group)

    return group
  }

  public async weila_getGroupFromServer(groupId: string): Promise<WL_IDbGroup | undefined> {
    return await this.groupModule.getGroupFromServer(groupId)
  }

  public async weila_getAllGroups(): Promise<WL_IDbGroup[]> {
    return WeilaDB.getInstance().getGroups()
  }

  public async weila_changeGroupOwner(groupId: string, ownerUserId: number): Promise<boolean> {
    return this.groupModule.changeGroupOwner(groupId, ownerUserId)
  }

  public async weila_quitGroup(groupId: string): Promise<boolean> {
    return this.groupModule.quitGroup(groupId)
  }

  public async weila_quitGroupsForDevice(groupIds: string[], subUserId: number): Promise<boolean> {
    for (const groupId of groupIds) {
      await this.groupModule.quitGroup(groupId, subUserId)
    }

    return true
  }

  public async weila_deleteMembers(groupId: string, memberUserIds: number[]): Promise<boolean> {
    return this.groupModule.deleteGroupMembers(groupId, memberUserIds)
  }

  public async weila_getGroupAdminMembers(groupId: string): Promise<WL_IDbGroupMember[]> {
    return WeilaDB.getInstance().getGroupAdminMembers(groupId)
  }

  public async weila_changeMemberType(
    groupId: string,
    memberUserId: number,
    memberType: number,
  ): Promise<boolean> {
    return this.groupModule.changeMemberType(groupId, memberUserId, memberType)
  }

  public async weila_inviteUserJoinGroup(groupId: string, userIds: number[]): Promise<boolean> {
    return this.groupModule.inviteUser(groupId, userIds)
  }

  public async weila_addDeviceMembers(groupId: string, userIds: number[]): Promise<number[]> {
    return this.groupModule.addSubDeviceMember(groupId, userIds)
  }

  public async weila_getUserInfo(userId: number): Promise<WL_IDbUserInfo | undefined> {
    let userInfo = await WeilaDB.getInstance().getUser(userId)

    const hasResolvedProfile = Boolean(
      userInfo?.nick &&
      userInfo.avatar &&
      userInfo.weilaNum &&
      userInfo.weilaNum !== String(userId),
    )

    if (hasResolvedProfile || !this.profileResolver) {
      return userInfo
    }

    const profile = await this.resolveProfile(userId)

    if (!profile?.name && !profile?.avatar && !profile?.weilaNum) {
      return userInfo
    }

    const weilaNum =
      profile.weilaNum ||
      (userInfo?.weilaNum && userInfo.weilaNum !== String(userId) ? userInfo.weilaNum : '')

    userInfo = {
      ...userInfo,
      userId,
      weilaNum,
      sex: userInfo?.sex ?? 0,
      nick: profile.name || userInfo?.nick || String(userId),
      pinyinName: userInfo?.pinyinName || '',
      avatar: profile.avatar || userInfo?.avatar || '',
      status: userInfo?.status ?? 0,
      userType: userInfo?.userType ?? 0,
      created: userInfo?.created ?? 0,
    }
    await WeilaDB.getInstance().putUserInfo(userInfo)

    return userInfo
  }

  public async weila_getUserInfos(userIdList: number[]): Promise<WL_IDbUserInfo[]> {
    return WeilaDB.getInstance().getUserInfos(userIdList)
  }

  public async weila_getFriends(userIds?: number[]): Promise<WL_IDbFriend[]> {
    return WeilaDB.getInstance().getFriends(userIds)
  }

  public weila_getSession(sessionId: string, sessionType: number): WL_IDbSession | undefined {
    const sessionList = this.sessionModule.getSessionList()

    const index = sessionList.findIndex((value) => {
      return (
        value.sessionId === sessionId &&
        value.sessionType === dbEnum<WL_IDbSessionType>(sessionType)
      )
    })

    return index !== -1 ? sessionList[index] : undefined
  }

  public weila_getSessions(): WL_IDbSession[] {
    return this.sessionModule.getSessionList()?.slice()
  }

  public async weila_getSessionFromDb(
    sessionId: string,
    sessionType: number,
  ): Promise<WL_IDbSession | undefined> {
    return WeilaDB.getInstance().getSession(sessionId, sessionType)
  }

  public async weila_getSessionsFromDb(): Promise<WL_IDbSession[]> {
    const sessions = await WeilaDB.getInstance().getSessions()

    for (const session of sessions) {
      if (!session.lastMsgData) {
        const lastMsg = await WeilaDB.getInstance().getLastMsgData(
          session.sessionId,
          session.sessionType,
        )

        if (lastMsg) {
          session.lastMsgData = lastMsg
        }
      }
    }

    sessions.forEach((session) => {
      void this.resolveSessionProfile(session)
    })

    return sessions
  }

  public weila_refreshSessionList(): void {
    this.sendExtEvent(WL_ExtEventID.WL_EXT_SESSION_UPDATED_IND, {})
  }

  private async resolveSessionProfile(session: WL_IDbSession): Promise<void> {
    const key = `${session.sessionId}_${session.sessionType}`

    if (this.resolvingSessionProfileKeys.has(key)) return

    this.resolvingSessionProfileKeys.add(key)

    try {
      let profile: WL_SessionProfileUpdate | null | undefined

      if (isIndividualSessionType(session.sessionType)) {
        const userProfile = await this.resolveProfile(Number(session.sessionId))
        profile = userProfile
          ? {
              sessionName: userProfile.name,
              sessionAvatar: userProfile.avatar,
            }
          : null
      } else if (isGroupSessionType(session.sessionType)) {
        const groupProfile = await this.resolveGroupProfile(session.sessionId)
        profile = groupProfile
          ? {
              sessionName: groupProfile.name,
              sessionAvatar: groupProfile.avatar,
              memberCount: groupProfile.memberCount,
              extra: groupProfile.extra,
            }
          : null
      } else if (this.sessionProfileResolver) {
        profile = await this.sessionProfileResolver(session)
      }

      const sessionName = profile?.sessionName?.trim()

      if (!sessionName) return

      let extra = session.extra

      if (profile?.extra !== undefined) {
        const baseExtra = isRecord(session.extra) ? session.extra : {}
        extra = { ...baseExtra, ...profile.extra }
      }

      await this.weila_updateSessionProfile(session.sessionId, session.sessionType, {
        ...profile,
        sessionName,
        extra,
      })
    } catch (err) {
      wlerr('补全会话资料失败:', err)
    } finally {
      this.resolvingSessionProfileKeys.delete(key)
    }
  }

  private async resolveProfile(userId: number): Promise<WL_Profile | null | undefined> {
    if (!this.profileResolver || !Number.isFinite(userId)) return null

    try {
      return await this.profileResolver(userId)
    } catch (err) {
      wlerr('补全用户资料失败:', err)

      return null
    }
  }

  private async resolveGroupProfile(groupId: string): Promise<WL_Profile | null | undefined> {
    if (!this.groupProfileResolver) return null

    try {
      return await this.groupProfileResolver(groupId)
    } catch (err) {
      wlerr('补全群资料失败:', err)

      return null
    }
  }

  public weila_setProfileResolver(resolver?: WL_ProfileResolver): void {
    this.profileResolver = resolver
  }

  public weila_setGroupProfileResolver(resolver?: WL_GroupProfileResolver): void {
    this.groupProfileResolver = resolver
  }

  public weila_setSessionProfileResolver(resolver?: WL_SessionProfileResolver): void {
    this.sessionProfileResolver = resolver
  }

  public weila_setFileUploader(uploader?: WL_FileUploader): void {
    this.fileUploader = uploader
  }

  private async uploadFileToCache(
    sessionId: string,
    sessionType: number,
    fileName: string,
    data: File,
  ): Promise<string> {
    if (this.fileUploader) {
      const url = await this.fileUploader(data, fileName)

      if (!url) {
        throw new Error('上传失败: 上传接口未返回文件地址')
      }

      return url
    }

    const result = await AliOssHelper.getInstance().uploadToCache(
      this.loginUserInfo!.userId,
      sessionId,
      sessionType,
      fileName,
      data,
    )

    if (result.statusCode !== 200) {
      throw new Error('上传失败:' + result.statusCode)
    }

    return result.remoteUrl
  }

  public async weila_updateSessionProfile(
    sessionId: string,
    sessionType: number,
    profile: WL_SessionProfileUpdate,
  ): Promise<WL_IDbSession | undefined> {
    return this.sessionModule.updateSessionProfile(sessionId, sessionType, profile)
  }

  public async weila_clearSession(sessionId: string, sessionType: number): Promise<boolean> {
    await WeilaDB.getInstance().delMsgDatas(sessionId, sessionType)

    return true
  }

  public async weila_deleteSession(sessionId: string, sessionType: number): Promise<boolean> {
    return this.sessionModule.deleteSession(sessionId, sessionType)
  }

  public async weila_setSessionMsgRead(
    sessionId: string,
    sessionType: number,
    msgId: number,
  ): Promise<boolean> {
    return this.sessionModule.setSessionMsgRead(sessionId, sessionType, msgId)
  }

  public async weila_setActiveSession(sessionId: string, sessionType: number): Promise<boolean> {
    return this.sessionModule.setActiveSession(sessionId, sessionType)
  }

  public weila_clearActiveSession(): void {
    this.sessionModule.clearActiveSessionState()
  }

  public async weila_getSessionSetting(
    sessionId: string,
    sessionType: number,
  ): Promise<WL_IDbSessionSetting | undefined> {
    return WeilaDB.getInstance().getSessionSetting(sessionId, sessionType)
  }

  public async weila_getSessionSettings(): Promise<WL_IDbSessionSetting[]> {
    return WeilaDB.getInstance().getSessionSettings()
  }

  public async weila_updateSessionSetting(
    sessionId: string,
    sessionType: number,
    settingParam: WL_IDbSessionSettingParams,
  ): Promise<boolean> {
    return WeilaDB.getInstance().updateSessionSetting(sessionId, sessionType, settingParam)
  }

  public async weila_startNewSession(
    sessionId: string,
    sessionType: number,
    extra?: any,
  ): Promise<WL_IDbSession> {
    return this.sessionModule.startSession(sessionId, sessionType, extra)
  }

  public async weila_getAllTypeNotifications(): Promise<WL_IDbNotification[]> {
    return WeilaDB.getInstance().getAllNotifications()
  }

  public async weila_updateNotification(notification: WL_IDbNotification): Promise<number> {
    return WeilaDB.getInstance().putNotification(notification)
  }

  public async weila_sendPttAudioData(
    sessionId: string,
    sessionType: number,
    audioData: Uint8Array,
  ): Promise<boolean> {
    if (!this.isLoginReady) {
      return Promise.reject('微喇状态不正确')
    }

    return this.sessionModule.sendPttMsgByData(sessionId, sessionType, audioData)
  }

  public async weila_withdrawMsg(
    sessionId: string,
    sessionType: number,
    msgId: number,
  ): Promise<boolean> {
    if (!this.isLoginReady) {
      return Promise.reject('微喇状态不正确')
    }

    return this.sessionModule.sendMsgData(
      sessionId,
      sessionType,
      msgId,
      WL_IDbMsgDataType.WL_DB_MSG_DATA_WITHDRAW_TYPE,
    )
  }

  public async weila_sendAudioMsg(
    sessionId: string,
    sessionType: number,
    audioUrl: string,
    frameCount?: number,
  ): Promise<boolean> {
    if (!this.isLoginReady) {
      return Promise.reject('微喇状态不正确')
    }

    return this.sessionModule.sendAudioMsg(sessionId, sessionType, audioUrl, frameCount)
  }

  public async weila_sendAudioMsgByData(
    sessionId: string,
    sessionType: number,
    audioData: WL_IDbAudioData,
  ): Promise<boolean> {
    if (!this.isLoginReady) {
      return Promise.reject('微喇状态不正确')
    }

    if (!audioData.data && !audioData.audioUrl) {
      return Promise.reject('音频数据不能为空')
    }

    return this.sessionModule.sendMsgData(
      sessionId,
      sessionType,
      audioData,
      WL_IDbMsgDataType.WL_DB_MSG_DATA_AUDIO_TYPE,
    )
  }

  public async weila_sendPTTByAudioData(
    sessionId: string,
    sessionType: number,
    audioData: Uint8Array,
  ): Promise<boolean> {
    if (!this.isLoginReady) {
      return Promise.reject('微喇状态不正确')
    }

    return this.sessionModule.sendPttPacketsByAudioData(sessionId, sessionType, audioData)
  }

  public async weila_sendTextMsg(
    sessionId: string,
    sessionType: number,
    text: string,
  ): Promise<boolean> {
    if (!this.isLoginReady) {
      return Promise.reject('微喇状态不正确')
    }

    const result = await this.sessionModule.sendMsgData(
      sessionId,
      sessionType,
      text,
      WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE,
    )

    return result
  }

  public async weila_sendPosition(
    sessionId: string,
    sessionType: number,
    position: WL_IDbLocationShared,
  ): Promise<boolean> {
    if (!this.isLoginReady) {
      return Promise.reject('微喇状态不正确')
    }

    return this.sessionModule.sendMsgData(
      sessionId,
      sessionType,
      position,
      WL_IDbMsgDataType.WL_DB_MSG_DATA_LOCATION_TYPE,
    )
  }

  private async weila_sendFileInfo(
    sessionId: string,
    sessionType: number,
    filename: string,
    data: File,
    msgType: WL_IDbMsgDataType,
  ): Promise<boolean> {
    if (!this.isLoginReady) {
      return Promise.reject('微喇状态不正确')
    }

    const lastMsgData = await WeilaDB.getInstance().getLastMsgData(sessionId, sessionType)

    const seqSetting = await WeilaDB.getInstance().getSettingItem(
      WL_IDbSettingID.SETTING_MSG_SENDING_SEQ,
    )

    let index = filename.lastIndexOf('\\')

    if (index === -1) {
      index = filename.lastIndexOf('/')
    }

    const fileName = index !== -1 ? filename.substring(index + 1) : filename

    const fileInfo: WL_IDbFileData = {
      fileName,
      fileUrl: '',
      fileThumbnail: TextMsgDataParser.getExtendFileFormatUrl(fileName),
      fileSize: data.size,
    }

    const msgData: WL_IDbMsgData = {
      combo_id: '',
      fileInfo,
      msgType,
      msgId: lastMsgData ? lastMsgData.msgId + 1 : 0,
      sessionType,
      sessionId,
      status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_SENDING,
      senderId: this.getLoginUserInfo().userId,
      created: new Date().getTime() / 1000,
      autoReply: 0,
    }

    msgData.combo_id = getMsgDataIdByCombo(msgData, seqSetting?.data ?? 0)

    if (seqSetting) {
      seqSetting.data = (seqSetting.data ?? 0) + 1
      await WeilaDB.getInstance().putSettingItem(seqSetting)
    }

    await WeilaDB.getInstance().putMsgData(msgData)
    this.sendExtEvent(WL_ExtEventID.WL_EXT_MSG_SEND_IND, msgData)

    try {
      fileInfo.fileUrl = await this.uploadFileToCache(
        sessionId,
        sessionType,
        fileInfo.fileName || filename,
        data,
      )
    } catch (error) {
      wlerr('上传文件失败:', error)
      msgData.status = WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_UNSENT
      await WeilaDB.getInstance().putMsgData(msgData)
      this.sendExtEvent(WL_ExtEventID.WL_EXT_MSG_SEND_IND, msgData)

      return Promise.reject(error)
    }

    return this.sessionModule.sendMsgData(sessionId, sessionType, fileInfo, msgType, msgData)
  }

  public async weila_sendImage(
    sessionId: string,
    sessionType: number,
    imageName: string,
    image: File,
  ): Promise<boolean> {
    return this.weila_sendFileInfo(
      sessionId,
      sessionType,
      imageName,
      image,
      WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE,
    )
  }

  public async weila_sendFile(
    sessionId: string,
    sessionType: number,
    filename: string,
    fileData: File,
  ): Promise<boolean> {
    return this.weila_sendFileInfo(
      sessionId,
      sessionType,
      filename,
      fileData,
      WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE,
    )
  }

  public async weila_sendVideo(
    sessionId: string,
    sessionType: number,
    videoName: string,
    video: File,
  ): Promise<boolean> {
    return this.weila_sendFileInfo(
      sessionId,
      sessionType,
      videoName,
      video,
      WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE,
    )
  }

  public async weila_getLocation(
    sessionId: string,
    sessionType: number,
  ): Promise<WL_IDbLocationInfo[]> {
    return this.locationModule.getLocation(sessionId, sessionType)
  }

  public async weila_answerGroupJoin(
    groupId: string,
    joinId: number,
    answerStatus: number,
  ): Promise<boolean> {
    return this.groupModule.answerGroupJoin(groupId, joinId, answerStatus)
  }

  public async weila_inviteFriend(
    inviteeId: number,
    detail: string,
    remark: string,
  ): Promise<boolean> {
    return this.friendModule.inviteFriend(inviteeId, detail, remark)
  }

  public async weila_getOnlineFriends(): Promise<WL_IDbFriend[]> {
    return this.friendModule.getOnlineFriends()
  }

  public async weila_inviteFriendsForDevice(
    inviteeIds: number[],
    subUserId: number,
    detail: string,
  ): Promise<boolean> {
    return this.friendModule.inviteFriendsForDevice(inviteeIds, subUserId, detail)
  }

  public async weila_deleteFriendsForDevice(
    userIds: number[],
    subUserId: number,
  ): Promise<boolean> {
    return this.friendModule.deleteFriends(userIds, subUserId)
  }

  public async weila_deleteFriends(userIds: number[]): Promise<boolean> {
    return this.friendModule.deleteFriends(userIds)
  }

  public async weila_answerFriendInvite(
    inviterUserId: number,
    answerStatus: number,
    info: string,
  ): Promise<boolean> {
    return this.friendModule.answerFriendInvite(inviterUserId, answerStatus, info)
  }

  public async weila_answerGroupInvitation(
    groupId: string,
    invitorId: number,
    status: number,
  ): Promise<boolean> {
    return this.groupModule.answerGroupInvitation(groupId, invitorId, status)
  }

  public async weila_createGroup(
    name: string,
    groupType: number,
    groupIcon: Blob | null,
    publicType: number,
    memberUserIdList: number[],
  ): Promise<WL_IDbGroup> {
    let avatar = ''

    if (groupIcon) {
      try {
        const uploadResult = await AliOssHelper.getInstance().uploadToAvatar(
          this.getLoginUserInfo().userId,
          true,
          groupIcon,
          100,
          100,
        )

        if (uploadResult.statusCode === 200) {
          avatar = uploadResult.remoteUrl
        }

        wllog('上传头像成功:', uploadResult)
      } catch (e) {
        wllog('上传头像失败:', e)
        avatar = ''
      }
    }

    const groupInfo = await this.groupModule.createGroup(
      name,
      groupType,
      avatar,
      publicType,
      memberUserIdList,
    )

    if (!groupInfo) {
      return Promise.reject(new Error('创建群组失败'))
    }

    if (dbEnum<WL_IDbGroupType>(groupType) === WL_IDbGroupType.GROUP_TEMP) {
      await this.weila_startNewSession(groupInfo.groupId, WL_IDbSessionType.SESSION_GROUP_TYPE)
    }

    return groupInfo
  }

  public async weila_joinGroup(
    groupId: string,
    detail?: string,
    password?: string,
  ): Promise<boolean> {
    return this.groupModule.joinGroup(groupId, detail, password)
  }

  public async weila_searchUserInfos(key: string): Promise<WL_IDbUserInfo[]> {
    return this.userModule.searchUserByNumber(key)
  }

  public async weila_dismissGroup(groupId: string): Promise<boolean> {
    return this.groupModule.dismissGroup(groupId)
  }

  public async weila_getOnlineMemberIds(groupId: string): Promise<number[]> {
    return this.groupModule.getGroupOnlineMembers(groupId)
  }

  public async weila_updateMsgData(msgData: WL_IDbMsgData): Promise<string> {
    return WeilaDB.getInstance().putMsgData(msgData)
  }

  public async weila_uploadImageCache(
    sessionId: string,
    sessionType: number,
    imageFile: File,
  ): Promise<string> {
    const name = new Date().toTimeString() + '_map.png'
    const url = await this.uploadFileToCache(sessionId, sessionType, name, imageFile)
    wllog('weila_uploadImageCache', url)

    return url
  }

  public async weila_getExtensions(): Promise<WL_IDbExtension[]> {
    return this.loginModule.getExtensionList()
  }

  public async weila_putExtension(extensionInfo: WL_IDbExtensionInfo): Promise<number> {
    return WeilaDB.getInstance().putExtension(extensionInfo)
  }

  public async weila_getDeviceSubGroups(subUserId: number): Promise<WL_IDbGroup[]> {
    return this.groupModule.getDeviceSubGroups(subUserId)
  }

  public async weila_getDeviceSubFriends(subUserId: number): Promise<WL_IDbFriend[]> {
    return this.friendModule.getDeviceSubFriends(subUserId)
  }

  public async weila_setDeviceConfig(
    cfgKey: string,
    cfgValue: string,
    subUserId: number,
  ): Promise<string> {
    return this.loginModule.setDeviceConfig(cfgKey, cfgValue, subUserId)
  }

  public async weila_bindDevice(verifyCode: string): Promise<number> {
    return this.loginModule.bindDevice(verifyCode)
  }

  public async weila_unbindDevice(deviceUserId: number): Promise<number> {
    return this.loginModule.unbindDevice(deviceUserId)
  }

  public weila_playNext() {
    return this.sessionModule.playNext()
  }

  public async weila_getServiceSession(
    sessionId: string,
  ): Promise<WL_IDbServiceSessionInfo | undefined> {
    const session: WL_IDbSession | undefined = await WeilaDB.getInstance().getSession(
      sessionId,
      WL_IDbSessionType.SESSION_SERVICE_TYPE,
    )

    if (session) {
      const serviceId = Long.fromValue(session.sessionId).high
      const service = await WeilaDB.getInstance().getService(serviceId)

      if (service) {
        const serviceSession: WL_IDbServiceSession | undefined = session.extra

        if (serviceSession) {
          return {
            service,
            serviceSession,
            staffs: await WeilaDB.getInstance().getServiceStaffs(serviceSession.staffIds),
            customer: await WeilaDB.getInstance().getUser(serviceSession.customerId),
          }
        }
      }
    }

    return this.businessModule.getSessionServiceFromServer(sessionId)
  }

  public async weila_staffAcceptSession(sessionId: string): Promise<boolean> {
    return this.businessModule.staffAcceptSession(sessionId)
  }

  public async weila_staffExitSession(sessionId: string): Promise<boolean> {
    return this.businessModule.staffExitSession(sessionId)
  }

  public async weila_staffCloseSession(sessionId: string): Promise<boolean> {
    return this.businessModule.staffCloseSession(sessionId)
  }

  public async weila_staffSessionInvite(
    sessionId: string,
    userIds: number[],
    content?: string,
  ): Promise<boolean> {
    return this.businessModule.staffSessionInvite(sessionId, userIds, content)
  }

  public async weila_staffAnswerSessionInvite(
    sessionId: string,
    status: WL_AnswerStatus,
  ): Promise<boolean> {
    return this.businessModule.staffAnswerSessionInvite(sessionId, status)
  }

  public async weila_staffRemoveSessionStaff(
    sessionId: string,
    staffIds: number[],
  ): Promise<boolean> {
    return this.businessModule.staffRemoveSessionStaff(sessionId, staffIds)
  }

  public async weila_staffSearchStaffs(
    serviceId: number,
    pageIndex: number,
    pageSize: number,
    staffClass?: number,
  ): Promise<WL_IDbServiceStaffInfo[]> {
    return this.businessModule.staffSearchStaffs(serviceId, pageIndex, pageSize, staffClass)
  }

  public async weila_staffResetSession(sessionId: string): Promise<boolean> {
    return this.businessModule.staffResetSession(sessionId)
  }

  public async weila_getStaffInfos(userIds: number[]): Promise<WL_IDbServiceStaffInfo[]> {
    return WeilaDB.getInstance().getServiceStaffs(userIds)
  }

  public weila_getServiceSessionId(serviceId: number, customerId: number): string {
    return new Long(customerId, serviceId).toString(10)
  }

  public async weila_fetchAudioData(url: string): Promise<WL_IDbAudioData | undefined> {
    return fetchAudioDataFromUrl(url)
  }

  public weila_setWebSock(webSock: string) {
    this.sendNetworkEvent(WL_NetworkEventID.NET_WEBSOCK_ADDR_SET_EVT, webSock)
  }

  public weila_setAuthInfo(appId: string, appKey: string) {
    WeilaDB.setAppAuthInfo(appId, appKey)
  }

  public async weila_get_token(): Promise<string> {
    const tokenItem = await WeilaDB.getInstance().getSettingItem(
      WL_IDbSettingID.SETTING_LOGIN_TOKEN,
    )

    return tokenItem?.data ?? ''
  }

  public weila_offEvent(callback: WL_ExtEventCallback): void {
    this.emitter.off('ext_event', callback)
  }

  public weila_subscribe<T extends WL_SubscribeTopic>(
    topic: T,
    callback: WL_SubscribeMap[T]['callback'],
    options?: WL_SubscribeMap[T]['options'],
  ): () => void {
    const request: WL_SubscribeRequest = { topic, callback, options }

    if (isSessionListRequest(request)) {
      const cb = request.callback
      const opts = request.options

      const handler: WL_ExtEventCallback = (eventId: WL_ExtEventID, eventData: any) => {
        if (
          (eventId === WL_ExtEventID.WL_EXT_DATA_PREPARE_IND &&
            eventData?.state === WL_DataPrepareState.PREPARE_SUCC_END) ||
          eventId === WL_ExtEventID.WL_EXT_NEW_SESSION_OPEN_IND ||
          eventId === WL_ExtEventID.WL_EXT_SESSION_UPDATED_IND
        ) {
          cb(this.weila_getSessions())
        }
      }

      this.emitter.on('ext_event', handler)

      if (opts?.immediately) {
        cb(this.weila_getSessions())
      }

      return () => {
        this.emitter.off('ext_event', handler)
      }
    } else if (isMessagesRequest(request)) {
      const opts = request.options
      const cb = request.callback
      const filter = opts?.filter

      const handler: WL_ExtEventCallback = (eventId: WL_ExtEventID, eventData: any) => {
        if (
          eventId === WL_ExtEventID.WL_EXT_NEW_MSG_RECV_IND ||
          eventId === WL_ExtEventID.WL_EXT_MSG_SEND_IND
        ) {
          const msgData: WL_IDbMsgData = eventData

          if (
            msgData &&
            filter &&
            msgData.sessionId === filter.sessionId &&
            msgData.sessionType === filter.sessionType
          ) {
            cb(msgData)
          }
        }
      }

      this.emitter.on('ext_event', handler)

      if (opts?.immediately && filter) {
        void this.weila_getMsgDatas(filter.sessionId, filter.sessionType, 0, 20).then((msgs) => {
          for (const msg of msgs) {
            cb(msg)
          }
        })
      }

      return () => {
        this.emitter.off('ext_event', handler)
      }
    }

    wlerr(`weila_subscribe: unknown topic '${topic}'`)

    return () => {}
  }
}

export { WeilaCore }
