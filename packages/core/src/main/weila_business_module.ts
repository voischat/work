import { WL_CoreInterface } from 'main/weila_internal_data'
import { WL } from 'proto/weilapb'
import { createLogger } from 'log/weila_log'
import {
  WL_IDbService,
  WL_IDbServiceSessionInfo,
  WL_IDbServiceStaff,
  WL_IDbServiceStaffInfo,
  WL_IDbSession,
  WL_IDbSessionStatus,
  WL_IDbUserInfo,
  WL_ServiceStatus,
  isServiceSessionType,
} from 'db/weila_db_data'
import { dbEnum } from 'db/db_enum'
import { WeilaPbBusinessWrapper } from 'proto/weilapb_business_wrapper'
import Long from 'long'
import { WeilaDB } from 'db/weila_db'
import {
  WL_AnswerStatus,
  WL_CommonAnswerStaffInvite,
  WL_ExtEventID,
  WL_ServiceSessionInvite,
  WL_StaffAnswerSessionInvite,
  WL_StaffInvite,
  WL_StaffSessionInfo,
} from 'main/weila_external_data'

const log = createLogger('MOD:business')

type BusinessResponseRoute = (
  serviceHead: WL.Service.ServiceHead.$Properties,
  businessMessage: WL.Business.IBusinessMessage | null | undefined,
) => void

type BusinessNotificationRoute = (businessMessage: WL.Business.IBusinessMessage) => void

export default class WLBusinessModule {
  private readonly responseRoutes = new Map<number, BusinessResponseRoute>([
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_GET_SESSION,
      (serviceHead, businessMessage) => {
        this.coreInterface.rspPbMsg(
          serviceHead.seq ?? 0,
          serviceHead.resultCode ?? 0,
          serviceHead.resultCode === 0 && businessMessage
            ? businessMessage.rspCommonGetSessions
            : null,
        )
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_GET_STAFF_INVITE,
      (serviceHead, businessMessage) => {
        this.coreInterface.rspPbMsg(
          serviceHead.seq ?? 0,
          serviceHead.resultCode ?? 0,
          serviceHead.resultCode === 0 && businessMessage
            ? businessMessage.rspCommonGetStaffInvite
            : null,
        )
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_SEARCH_STAFFS,
      (serviceHead, businessMessage) => {
        this.coreInterface.rspPbMsg(
          serviceHead.seq ?? 0,
          serviceHead.resultCode ?? 0,
          serviceHead.resultCode === 0 && businessMessage
            ? businessMessage.rspStaffSearchStaffs
            : null,
        )
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_RESET_SESSION,
      (serviceHead) => {
        this.coreInterface.rspPbMsg(serviceHead.seq ?? 0, serviceHead.resultCode ?? 0, true)
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_REMOVE_SESSION_STAFFS,
      (serviceHead) => {
        this.coreInterface.rspPbMsg(serviceHead.seq ?? 0, serviceHead.resultCode ?? 0, true)
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_ANSWER_SESSION_INVITE,
      (serviceHead) => {
        this.coreInterface.rspPbMsg(serviceHead.seq ?? 0, serviceHead.resultCode ?? 0, true)
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_SESSION_INVITE,
      (serviceHead) => {
        this.coreInterface.rspPbMsg(serviceHead.seq ?? 0, serviceHead.resultCode ?? 0, true)
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_CLOSE_SESSION,
      (serviceHead) => {
        this.coreInterface.rspPbMsg(serviceHead.seq ?? 0, serviceHead.resultCode ?? 0, true)
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_EXIT_SESSION,
      (serviceHead) => {
        this.coreInterface.rspPbMsg(serviceHead.seq ?? 0, serviceHead.resultCode ?? 0, true)
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_ACCEPT_SESSION,
      (serviceHead) => {
        this.coreInterface.rspPbMsg(serviceHead.seq ?? 0, serviceHead.resultCode ?? 0, true)
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_STAFF_DELETE,
      (serviceHead) => {
        this.coreInterface.rspPbMsg(serviceHead.seq ?? 0, serviceHead.resultCode ?? 0, true)
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_STAFF_INVITE,
      (serviceHead) => {
        this.coreInterface.rspPbMsg(serviceHead.seq ?? 0, serviceHead.resultCode ?? 0, true)
      },
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_ANSWER_STAFF_INVITE,
      (serviceHead) => {
        this.coreInterface.rspPbMsg(serviceHead.seq ?? 0, serviceHead.resultCode ?? 0, true)
      },
    ],
  ])

  private readonly notificationRoutes = new Map<number, BusinessNotificationRoute>([
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_SESSION_CHANGE,
      (businessMessage) => this.onNtfCommonSessionChange(businessMessage),
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_STAFF_INVITE,
      (businessMessage) => this.onNtfCommonStaffInvite(businessMessage),
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_ANSWER_STAFF_INVITE,
      (businessMessage) => this.onNtfCommonAnswerStaffInvite(businessMessage),
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_ACCEPT_SESSION,
      (businessMessage) =>
        this.onNtfStaffSessionState(
          businessMessage.ntfStaffAcceptSession,
          WL_ExtEventID.WL_EXT_STAFF_ACCEPT_SESSION_IND,
        ),
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_EXIT_SESSION,
      (businessMessage) =>
        this.onNtfStaffSessionState(
          businessMessage.ntfStaffExitSession,
          WL_ExtEventID.WL_EXT_STAFF_EXIT_SESSION_IND,
        ),
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_CLOSE_SESSION,
      (businessMessage) =>
        this.onNtfStaffSessionState(
          businessMessage.ntfStaffCloseSession,
          WL_ExtEventID.WL_EXT_STAFF_CLOSE_SESSION_IND,
        ),
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_SESSION_INVITE,
      (businessMessage) => this.onNtfStaffSessionInvite(businessMessage),
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_ANSWER_SESSION_INVITE,
      (businessMessage) => this.onNtfStaffAnswerSessionInvite(businessMessage),
    ],
    [
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_REMOVE_SESSION_STAFFS,
      (businessMessage) => this.onNtfStaffRemoveSessionStaff(businessMessage),
    ],
  ])

  constructor(private coreInterface: WL_CoreInterface) {
    this.coreInterface.registerPbMsgHandler(
      WL.Service.ServiceID.SERVICE_BUSINESS,
      this.onPbMsgHandler.bind(this),
    )
  }

  private onPbMsgHandler(data: WL.Service.IServiceMessage): void {
    const serviceHead = data.serviceHead

    if (!serviceHead) return

    const businessMessage = data.businessMessage
    const commandId = serviceHead.commandId

    if (commandId === undefined || commandId === null) return

    if (serviceHead.commandType === WL.Service.CommandType.COMMAND_RESPONSE) {
      const route = this.responseRoutes.get(commandId)

      if (route) route(serviceHead, businessMessage)
    } else if (serviceHead.commandType === WL.Service.CommandType.COMMAND_NOTIFY) {
      if (!businessMessage) return

      const route = this.notificationRoutes.get(commandId)

      if (route) route(businessMessage)
    }
  }

  private onNtfCommonSessionChange(businessMessage: WL.Business.IBusinessMessage): void {
    const ntf = businessMessage.ntfCommonSessionChange

    if (!ntf) return

    const session = ntf.session

    if (!session) return

    const db = WeilaDB.getInstance()
    const serviceSessionInfo = db.convertFromServiceSessionRaw(session)

    this.coreInterface.sendExtEvent(
      WL_ExtEventID.WL_EXT_COMMON_SESSION_CHANGE_IND,
      serviceSessionInfo,
    )

    if (serviceSessionInfo.serviceSession.serviceStatus === WL_ServiceStatus.SERVICE_STATUS_INIT) {
      void (async () => {
        await db.putService(serviceSessionInfo.service)
        await db.putServiceStaffs(db.convertFromStaffRaws(session.staffAttributes ?? []))
        await db.putUserInfos(
          serviceSessionInfo.staffs.map((value) => {
            return value.userData
          }),
        )

        const customer = serviceSessionInfo.customer

        if (customer) {
          await db.putUserInfo(customer)
        }
      })()
    }
  }

  private onNtfCommonStaffInvite(businessMessage: WL.Business.IBusinessMessage): void {
    const ntf = businessMessage.ntfCommonStaffInvite

    if (!ntf) return

    const inviteInfo = ntf.inviteInfo

    if (!inviteInfo) return

    const invitor = inviteInfo.invitor

    if (!invitor) return

    const invitorUserInfo = invitor.userInfo

    if (!invitorUserInfo) return

    const serviceAttribute = inviteInfo.serviceAttribute

    if (!serviceAttribute) return

    const db = WeilaDB.getInstance()

    const staffInvite: WL_StaffInvite = {
      invitorInfo: {
        staff: db.convertFromStaffRaws([invitor])[0],
        userData: db.convertFromUserRaw([invitorUserInfo])[0],
      },
      content: inviteInfo.content ?? undefined,
      service: db.convertFromServiceRaw(serviceAttribute),
    }

    this.coreInterface.sendExtEvent(WL_ExtEventID.WL_EXT_COMMON_STAFF_INVITE_IND, staffInvite)
  }

  private onNtfCommonAnswerStaffInvite(businessMessage: WL.Business.IBusinessMessage): void {
    const ntf = businessMessage.ntfCommonAnswerStaffInvite

    if (!ntf) return

    const commonAnswerStaffInvite: WL_CommonAnswerStaffInvite = {
      serviceId: ntf.serviceId ?? 0,
      userId: ntf.userId ?? 0,
      status: dbEnum<WL_AnswerStatus>(ntf.status),
    }

    this.coreInterface.sendExtEvent(
      WL_ExtEventID.WL_EXT_COMMON_ANSWER_INVITE_IND,
      commonAnswerStaffInvite,
    )
  }

  private onNtfStaffSessionState(
    ntf:
      | WL.Business.INtfStaffAcceptSession
      | WL.Business.INtfStaffExitSession
      | WL.Business.INtfStaffCloseSession
      | null
      | undefined,
    eventId: WL_ExtEventID,
  ): void {
    if (!ntf) return

    const staffSessionInfo: WL_StaffSessionInfo = {
      sessionId: Long.fromValue(ntf.sessionId ?? 0).toString(10),
      staffId: ntf.staffId ?? 0,
    }

    this.coreInterface.sendExtEvent(eventId, staffSessionInfo)
  }

  private onNtfStaffSessionInvite(businessMessage: WL.Business.IBusinessMessage): void {
    const ntf = businessMessage.ntfStaffSessionInvite

    if (!ntf) return

    const session = ntf.session

    if (!session) return

    const staffSessionInvite: WL_ServiceSessionInvite = {
      session: WeilaDB.getInstance().convertFromServiceSessionRaw(session),
      content: ntf.content ?? undefined,
    }

    this.coreInterface.sendExtEvent(
      WL_ExtEventID.WL_EXT_STAFF_SESSION_INVITE_IND,
      staffSessionInvite,
    )
  }

  private onNtfStaffAnswerSessionInvite(businessMessage: WL.Business.IBusinessMessage): void {
    const ntf = businessMessage.ntfStaffAnswerSessionInvite

    if (!ntf) return

    const invitee = ntf.invitee

    if (!invitee) return

    const inviteeUserInfo = invitee.userInfo

    if (!inviteeUserInfo) return

    const db = WeilaDB.getInstance()

    const staffAnswerSessionInvite: WL_StaffAnswerSessionInvite = {
      sessionId: Long.fromValue(ntf.sessionId ?? 0).toString(10),
      status: dbEnum<WL_AnswerStatus>(ntf.status),
      invitee: {
        staff: db.convertFromStaffRaws([invitee])[0],
        userData: db.convertFromUserRaw([inviteeUserInfo])[0],
      },
    }

    this.coreInterface.sendExtEvent(
      WL_ExtEventID.WL_EXT_STAFF_ANSWER_INVITE_IND,
      staffAnswerSessionInvite,
    )
  }

  private onNtfStaffRemoveSessionStaff(businessMessage: WL.Business.IBusinessMessage): void {
    const ntf = businessMessage.ntfStaffRemoveSessionStaff

    if (!ntf) return

    this.coreInterface.sendExtEvent(
      WL_ExtEventID.WL_EXT_STAFF_REMOVED_SESSION_IND,
      Long.fromValue(ntf.sessionId ?? 0).toString(10),
    )
  }

  public async getSessionServiceFromServer(
    sessionId: string,
  ): Promise<WL_IDbServiceSessionInfo | undefined> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildCommonGetSessionsReq([
      Long.fromValue(sessionId),
    ])

    if (buildMsgRet.resultCode === 0) {
      const dbUserInfos: WL_IDbUserInfo[] = []

      const rsp: WL.Business.IRspCommonGetSessions = await this.coreInterface.sendPbMsg(buildMsgRet)

      const sessions = rsp.sessions ?? []

      if (sessions.length) {
        const rawSession = sessions[0]
        const serviceSessionInfo = WeilaDB.getInstance().convertFromServiceSessionRaw(rawSession)
        dbUserInfos.push(
          ...serviceSessionInfo.staffs.map((value) => {
            return value.userData
          }),
        )
        const customer = serviceSessionInfo.customer

        if (customer) {
          dbUserInfos.push(customer)
        }

        await WeilaDB.getInstance().putUserInfos(dbUserInfos)
        await WeilaDB.getInstance().putServiceStaffs(
          WeilaDB.getInstance().convertFromStaffRaws(rawSession.staffAttributes ?? []),
        )
        await WeilaDB.getInstance().putService(serviceSessionInfo.service)

        return serviceSessionInfo
      }

      return undefined
    }

    return Promise.reject(new Error('build msg error'))
  }

  public async initService(dbSessionList: WL_IDbSession[]): Promise<boolean> {
    if (dbSessionList.length === 0) {
      return true
    }

    dbSessionList = dbSessionList.filter((value) => {
      return isServiceSessionType(value.sessionType)
    })

    const sessionIds_long = dbSessionList.map((value) => {
      return Long.fromValue(value.sessionId)
    })

    const buildMsgRet = WeilaPbBusinessWrapper.buildCommonGetSessionsReq(sessionIds_long)

    if (buildMsgRet.resultCode === 0) {
      const rsp: WL.Business.IRspCommonGetSessions = await this.coreInterface.sendPbMsg(buildMsgRet)

      const services: WL_IDbService[] = []
      let dbUserInfos: WL_IDbUserInfo[] = []
      let allStaffs: WL_IDbServiceStaff[] = []

      log.info('buildCommonGetSessionsReq', rsp)

      const sessions = rsp.sessions ?? []

      const validServiceSessionIds = sessions.map((value) => {
        return new Long(
          value.customerAttribute?.userInfo?.userId ?? 0,
          value.serviceAttribute?.id ?? 0,
        ).toString(10)
      })

      for (let dbSession of dbSessionList) {
        const idx = validServiceSessionIds.indexOf(dbSession.sessionId)

        if (idx !== -1) {
          const serviceSessionRaw = sessions[idx]

          const serviceSessionInfo =
            WeilaDB.getInstance().convertFromServiceSessionRaw(serviceSessionRaw)

          services.push(serviceSessionInfo.service)
          allStaffs.push(
            ...serviceSessionInfo.staffs.map((value) => {
              return value.staff
            }),
          )
          dbUserInfos.push(
            ...serviceSessionInfo.staffs.map((value) => {
              return value.userData
            }),
          )
          const customer = serviceSessionInfo.customer

          if (customer) {
            dbUserInfos.push(customer)
          }

          dbSession.latestUpdate = serviceSessionInfo.serviceSession.updatedTime
          dbSession.sessionName = serviceSessionInfo.service.name
          dbSession.sessionAvatar = serviceSessionInfo.service.avatar
          dbSession.extra = {
            ...dbSession.extra,
            serviceSession: serviceSessionInfo.serviceSession,
          }
        } else {
          dbSession.status = WL_IDbSessionStatus.SESSION_INVALID
          dbSession.extra = {
            ...dbSession.extra,
            serviceStatus: WL_ServiceStatus.SERVICE_STATUS_FINISH,
          }
        }
      }

      dbUserInfos = dbUserInfos.filter((value, index, array) => {
        return (
          array.findIndex((value1) => {
            return value1.userId === value.userId
          }) === index
        )
      })
      await WeilaDB.getInstance().putUserInfos(dbUserInfos)

      allStaffs = allStaffs.filter((value, index, array) => {
        return (
          array.findIndex((value1) => {
            return value1.userId === value.userId
          }) === index
        )
      })
      await WeilaDB.getInstance().putServiceStaffs(allStaffs)
      await WeilaDB.getInstance().putServices(services)
      await WeilaDB.getInstance().putSessions(dbSessionList)

      return true
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async commonStaffInvite(
    serviceId: number,
    userIds: number[],
    content?: string,
  ): Promise<boolean> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildCommonStaffInviteReq(
      serviceId,
      userIds,
      content,
    )

    if (buildMsgRet.resultCode === 0) {
      return this.coreInterface.sendPbMsg(buildMsgRet)
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async commonAnswerStaffInvite(
    serviceId: number,
    invitorId: number,
    status: WL_AnswerStatus,
  ): Promise<boolean> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildCommonAnswerStaffInviteReq(
      serviceId,
      invitorId,
      status,
    )

    if (buildMsgRet.resultCode === 0) {
      return this.coreInterface.sendPbMsg(buildMsgRet)
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async commonGetStaffInvite(latestUpdate: number): Promise<WL_StaffInvite[]> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildCommonGetStaffInviteReq(latestUpdate)

    if (buildMsgRet.resultCode === 0) {
      const staffInvites: WL_StaffInvite[] = []

      const rsp: WL.Business.IRspCommonGetStaffInvite =
        await this.coreInterface.sendPbMsg(buildMsgRet)

      if (rsp.invites) {
        for (let invite of rsp.invites) {
          const serviceAttribute = invite.serviceAttribute

          if (!serviceAttribute) continue

          const invitor = invite.invitor

          if (!invitor) continue

          const invitorUserInfo = invitor.userInfo

          if (!invitorUserInfo) continue

          const staffInvite: WL_StaffInvite = {
            service: WeilaDB.getInstance().convertFromServiceRaw(serviceAttribute),
            invitorInfo: {
              staff: WeilaDB.getInstance().convertFromStaffRaws([invitor])[0],
              userData: WeilaDB.getInstance().convertFromUserRaw([invitorUserInfo])[0],
            },
            content: invite.content ?? undefined,
          }

          staffInvites.push(staffInvite)
        }
      }

      return staffInvites
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async commonStaffDelete(serviceId: number, userId: number): Promise<boolean> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildCommonStaffDeleteReq(serviceId, userId)

    if (buildMsgRet.resultCode === 0) {
      return this.coreInterface.sendPbMsg(buildMsgRet)
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async staffAcceptSession(sessionId: string): Promise<boolean> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildStaffAcceptSessionReq(Long.fromValue(sessionId))

    if (buildMsgRet.resultCode === 0) {
      return this.coreInterface.sendPbMsg(buildMsgRet)
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async staffExitSession(sessionId: string): Promise<boolean> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildStaffExitSessionReq(Long.fromValue(sessionId))

    if (buildMsgRet.resultCode === 0) {
      return this.coreInterface.sendPbMsg(buildMsgRet)
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async staffCloseSession(sessionId: string): Promise<boolean> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildStaffCloseSessionReq(Long.fromValue(sessionId))

    if (buildMsgRet.resultCode === 0) {
      return this.coreInterface.sendPbMsg(buildMsgRet)
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async staffSessionInvite(
    sessionId: string,
    userIds: number[],
    content?: string,
  ): Promise<boolean> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildStaffSessionInviteReq(
      Long.fromValue(sessionId),
      userIds,
      content,
    )

    if (buildMsgRet.resultCode === 0) {
      return this.coreInterface.sendPbMsg(buildMsgRet)
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async staffAnswerSessionInvite(
    sessionId: string,
    status: WL_AnswerStatus,
  ): Promise<boolean> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildStaffAnswerSessionInviteReq(
      Long.fromValue(sessionId),
      status,
    )

    if (buildMsgRet.resultCode === 0) {
      return this.coreInterface.sendPbMsg(buildMsgRet)
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async staffRemoveSessionStaff(sessionId: string, staffIds: number[]): Promise<boolean> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildStaffRemoveSessionStaffReq(
      Long.fromValue(sessionId),
      staffIds,
    )

    if (buildMsgRet.resultCode === 0) {
      return this.coreInterface.sendPbMsg(buildMsgRet)
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async staffSearchStaffs(
    serviceId: number,
    pageIndex: number,
    pageSize: number,
    staffClass?: number,
  ): Promise<WL_IDbServiceStaffInfo[]> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildStaffSearchStaffsReq(
      serviceId,
      pageIndex,
      pageSize,
      staffClass,
    )

    if (buildMsgRet.resultCode === 0) {
      const rsp: WL.Business.IRspStaffSearchStaffs = await this.coreInterface.sendPbMsg(buildMsgRet)

      if (rsp.staffs) {
        const staffRaws = rsp.staffs.filter(
          (
            value,
          ): value is WL.Business.StaffAttribute.$Properties & {
            userInfo: WL.Common.UserInfo.$Properties
          } => value.userInfo !== null && value.userInfo !== undefined,
        )

        const staffs = WeilaDB.getInstance().convertFromStaffRaws(staffRaws)

        const userInfos = WeilaDB.getInstance().convertFromUserRaw(
          staffRaws.map((value) => {
            return value.userInfo
          }),
        )

        await WeilaDB.getInstance().putServiceStaffs(staffs)
        await WeilaDB.getInstance().putUserInfos(userInfos)

        return staffs.map((value, index) => {
          const staffInfo: WL_IDbServiceStaffInfo = {
            userData: userInfos[index],
            staff: value,
          }

          return staffInfo
        })
      }

      return []
    }

    return Promise.reject(new Error('创建消息出错'))
  }

  public async staffResetSession(sessionId: string): Promise<boolean> {
    const buildMsgRet = WeilaPbBusinessWrapper.buildStaffResetSessionReq(Long.fromValue(sessionId))

    if (buildMsgRet.resultCode === 0) {
      return this.coreInterface.sendPbMsg(buildMsgRet)
    }

    return Promise.reject(new Error('创建消息出错'))
  }
}
