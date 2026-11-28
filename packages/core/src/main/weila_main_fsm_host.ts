import { fromPromise } from 'xstate'
import type { AnyEventObject } from 'xstate'
import { fsmEvents, mainFsm, systemWatchdogActor } from 'fsm/weila_fsm_script'
import type { MainFsmContext, MainFsmUserEvent } from 'fsm/weila_fsm_script'
import { createLogger } from 'log/weila_log'
import { WL_LoginParam, WL_LoginResult, WL_NetworkEventID } from 'main/weila_internal_data'
import type { WL_NetworkEventPayload } from 'main/weila_internal_data'
import type { WL_PromiseCallback } from 'main/weila_internal_data'
import {
  WL_DataPrepareInd,
  WL_DataPrepareState,
  WL_ExtEventID,
  WL_ExtEventPayload,
} from 'main/weila_external_data'
import { isServiceSessionType } from 'db/weila_db_data'
import { isString } from 'main/weila_type_guards'
import { toError } from 'main/weila_utils'
import type { WL_IDbSession, WL_IDbUserInfo } from 'db/weila_db_data'

const log = createLogger('CORE')

interface WeilaMainFsmLoginModule {
  loginReq: (
    account: string,
    password: string,
    countryCode: string,
    md5: boolean,
  ) => Promise<WL_IDbUserInfo>
  logoutReq: () => Promise<boolean>
  sendHeartbeat: () => Promise<boolean>
  refreshToken: () => Promise<boolean>
  initExtension: () => Promise<boolean>
}

export interface WeilaMainFsmHostDeps {
  loadResource: () => Promise<boolean>
  sendNetworkEvent: (event: WL_NetworkEventID, data: WL_NetworkEventPayload) => void
  sendExtEvent: (event: WL_ExtEventID, data: WL_ExtEventPayload) => void
  sendToFsm: (event: MainFsmUserEvent) => void
  setLoginUserInfo: (userInfo: WL_IDbUserInfo) => void
  setLoginReady: (ready: boolean) => void
  requestLogout: () => Promise<boolean>
  checkWaitingTimeouts: () => void
  readonly maxRetryLoginTimes: number
  readonly loginModule: WeilaMainFsmLoginModule
  readonly friendModule: { initFriends: () => Promise<boolean> }
  readonly groupModule: { initGroups: () => Promise<boolean> }
  readonly businessModule: { initService: (dbSessionList: WL_IDbSession[]) => Promise<boolean> }
  readonly sessionModule: {
    initSessions: () => Promise<boolean>
    getSessionList: () => WL_IDbSession[]
  }
}

function isLoadResourceEvent(
  event: AnyEventObject,
): event is AnyEventObject & { data: WL_PromiseCallback } {
  return event.type === fsmEvents.FSM_LOAD_RESOURCE_EVT && 'data' in event
}

interface ErrorLike {
  message?: unknown
  error?: unknown
  callback?: unknown
}

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === 'object' && value !== null
}

function isLoginResult(value: unknown): value is WL_LoginResult {
  if (!isErrorLike(value)) return false

  const callback = value.callback

  return (
    typeof callback === 'object' &&
    callback !== null &&
    'resolve' in callback &&
    'reject' in callback
  )
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message

  if (isErrorLike(cause)) {
    if (isString(cause.message)) return cause.message

    if (cause.error instanceof Error) return cause.error.message

    if (isErrorLike(cause.error) && isString(cause.error.message)) {
      return cause.error.message
    }
  }

  return ''
}

export default class WeilaMainFsmHost {
  private heartbeatTimerId: ReturnType<typeof setInterval> | null = null
  private refreshTokenTimerId: ReturnType<typeof setInterval> | null = null

  constructor(private readonly deps: WeilaMainFsmHostDeps) {}

  buildMachine(): typeof mainFsm {
    return mainFsm.provide({
      actors: {
        loadResource: fromPromise(({ input }) => this.loadResource(input.context, input.event)),
        prepareData: fromPromise(() => this.prepareData()),
        loginServer: fromPromise(({ input }) => this.loginServer(input.context)),
        logout: fromPromise(() => this.logout()),
        systemWatchdog: systemWatchdogActor,
      },
      actions: {
        onResourceLoadFail: ({ event }) => {
          if ('error' in event) this.onResourceLoadFail(event)
        },
        onLoadingResource: () => this.onLoadingResource(),
        onException: ({ event }) => {
          if ('error' in event) this.onException(event)
        },
        onReadyEntry: () => this.onReadyEntry(),
        onReadyExit: () => this.onReadyExit(),
        onSysTimeChecking: () => this.onSysTimeChecking(),
        onDataInit: () => this.onDataInit(),
        onDataInited: () => this.onDataInited(),
        onDataPrepareFail: () => this.onDataPrepareFail(),
        onLoginServerSucc: ({ event }) => {
          if ('output' in event && isLoginResult(event.output)) this.onLoginSucc(event.output)
        },
        onLoginServerFail: ({ event }) => {
          if ('error' in event) this.onLoginFail(event)
        },
        connectServer: () => this.connectServer(),
        onConnecting: ({ context, event }) => this.onConnecting(context, event),
        onDisconnectInReadyState: () => this.onDisconnectInReadyState(),
        onLoginRetryFail: ({ context, event }) => this.onLoginRetryFail(context, event),
      },
      guards: {
        canRetry: ({ context }) => this.canRetry(context),
        isDefinitiveRejection: ({ event }) => this.isDefinitiveRejection(event),
      },
    })
  }

  private async loadResource(_context: MainFsmContext, event: AnyEventObject): Promise<boolean> {
    if (!isLoadResourceEvent(event)) {
      return Promise.reject(new Error('loadResource invoked without a promise callback'))
    }

    const callback = event.data

    try {
      await this.deps.loadResource()
      callback.resolve(true)
      log.info('加载数据成功')
    } catch (e) {
      log.error('加载数据失败', e)
      callback.reject(toError(e))

      return Promise.reject(e)
    }

    return true
  }

  private async prepareData(): Promise<boolean> {
    const ind: WL_DataPrepareInd = {
      state: WL_DataPrepareState.PREPARE_PROGRESS_IND,
      msg: 'SDK.FriendInit',
    }

    this.deps.sendExtEvent(WL_ExtEventID.WL_EXT_DATA_PREPARE_IND, ind)
    await this.deps.friendModule.initFriends()
    ind.msg = 'SDK.GroupInit'
    this.deps.sendExtEvent(WL_ExtEventID.WL_EXT_DATA_PREPARE_IND, ind)
    await this.deps.groupModule.initGroups()
    ind.msg = 'SDK.SessionInit'
    this.deps.sendExtEvent(WL_ExtEventID.WL_EXT_DATA_PREPARE_IND, ind)
    await this.deps.sessionModule.initSessions()
    ind.msg = 'SDK.ExtensionInit'
    this.deps.sendExtEvent(WL_ExtEventID.WL_EXT_DATA_PREPARE_IND, ind)
    await this.deps.loginModule.initExtension()

    ind.msg = 'SDK.Services'
    this.deps.sendExtEvent(WL_ExtEventID.WL_EXT_DATA_PREPARE_IND, ind)
    const sessionList = this.deps.sessionModule.getSessionList()

    try {
      await this.deps.businessModule.initService(
        sessionList.filter((value) => {
          return isServiceSessionType(value.sessionType)
        }),
      )
    } catch (e) {
      log.error('初始化服务失败:', e)
    }

    return true
  }

  private async logout(): Promise<boolean> {
    return this.deps.loginModule.logoutReq()
  }

  private async loginServer(context: MainFsmContext): Promise<WL_LoginResult> {
    const loginParam: WL_LoginParam | null = context.loginParam

    if (!loginParam) {
      return Promise.reject(new Error('loginServer invoked without a login parameter'))
    }

    const loginResult: WL_LoginResult = { callback: loginParam.callback }

    loginParam.retryCount++

    try {
      log.info('开始登陆')
      loginResult.loginUserInfo = await this.deps.loginModule.loginReq(
        loginParam.account,
        loginParam.password,
        loginParam.countryCode,
        loginParam.md5,
      )
      log.info('loginServer succ', loginResult)

      return loginResult
    } catch (e) {
      loginResult.error = e
      log.info('loginServer error', loginResult, e)

      return Promise.reject(loginResult)
    }
  }

  private onResourceLoadFail(event: { error?: unknown }) {
    log.error('初始加载数据出错', event.error)
  }

  private onLoadingResource() {
    log.info('加载数据成功')
  }

  private onException(event: { error?: unknown }) {
    this.deps.sendExtEvent(WL_ExtEventID.WL_EXT_SYSTEM_EXCEPTION_IND, toError(event.error))
  }

  private onDataInit() {
    const ind: WL_DataPrepareInd = {
      state: WL_DataPrepareState.START_PREPARING,
      msg: 'Commons.startPrepare',
    }

    this.deps.sendExtEvent(WL_ExtEventID.WL_EXT_DATA_PREPARE_IND, ind)
  }

  private onDataInited() {
    const ind: WL_DataPrepareInd = {
      state: WL_DataPrepareState.PREPARE_SUCC_END,
      msg: 'Commons.prepareFinishSucc',
    }

    this.deps.sendExtEvent(WL_ExtEventID.WL_EXT_DATA_PREPARE_IND, ind)
  }

  private onDataPrepareFail() {
    void this.deps.requestLogout().then((_value) => {})

    const ind: WL_DataPrepareInd = {
      state: WL_DataPrepareState.PREPARE_FAIL_END,
      msg: 'Commons.prepareFinishFail',
    }

    this.deps.sendExtEvent(WL_ExtEventID.WL_EXT_DATA_PREPARE_IND, ind)
  }

  private onLoginFail(event: { error?: unknown }) {
    log.info('onLoginFail:', event)
    this.deps.sendNetworkEvent(WL_NetworkEventID.NET_DISCONNECT_EVT, null)
    this.deps.sendToFsm({
      type: fsmEvents.FSM_LOGIN_PROCEDURE_FAIL_EVT,
      data: event.error,
    })
  }

  private onLoginSucc(loginResult: WL_LoginResult) {
    log.info('onLogin:', loginResult)

    if (loginResult.loginUserInfo) {
      this.deps.setLoginUserInfo(loginResult.loginUserInfo)
    }

    if (loginResult.callback) {
      loginResult.callback.resolve(loginResult.loginUserInfo)
    }

    this.deps.sendToFsm({
      type: fsmEvents.FSM_LOGIN_PROCEDURE_SUCC_EVT,
      data: loginResult,
    })
  }

  private onSysTimeChecking() {
    this.deps.checkWaitingTimeouts()
  }

  private onReadyEntry() {
    log.info('系统已经准备好，可以接受任何消息')
    this.deps.setLoginReady(true)
    this.heartbeatTimerId = setInterval(() => {
      this.deps.loginModule
        .sendHeartbeat()
        .then((_value) => {
          log.info('发送心跳成功')
        })
        .catch((reason) => {
          log.error('发送心跳失败', reason)
        })
    }, 59000)

    this.refreshTokenTimerId = setInterval(() => {
      this.deps.loginModule
        .refreshToken()
        .then((_value) => {
          log.info('刷新token成功')
        })
        .catch((reason) => {
          log.error('刷新token失败:', reason)
        })
    }, 3600000)
  }

  private onReadyExit() {
    log.info('系统没有准备好')
    this.deps.setLoginReady(false)

    if (this.heartbeatTimerId !== null) clearInterval(this.heartbeatTimerId)
    this.heartbeatTimerId = null

    if (this.refreshTokenTimerId !== null) clearInterval(this.refreshTokenTimerId)
    this.refreshTokenTimerId = null
  }

  private isDefinitiveRejection(event: AnyEventObject): boolean {
    if (event.type !== fsmEvents.FSM_LOGIN_PROCEDURE_FAIL_EVT || !('data' in event)) return false

    const message = errorMessage(event.data)

    return message.search(/.*-MESSAGE:.*:END/) !== -1
  }

  private canRetry(context: MainFsmContext): boolean {
    const loginParam = context.loginParam

    if (!loginParam) return false

    log.info('canRetry', loginParam)

    return loginParam.retryCount < this.deps.maxRetryLoginTimes
  }

  private connectServer() {
    this.deps.sendNetworkEvent(WL_NetworkEventID.NET_CONNECT_EVT, null)
  }

  private onConnecting(context: MainFsmContext, event: AnyEventObject) {
    log.info('onConnecting:', context, event)
  }

  private onDisconnectInReadyState() {}

  private onLoginRetryFail(context: MainFsmContext, event: AnyEventObject) {
    log.info('onLoginRetryFail', event)

    const loginParam: WL_LoginParam | null = context.loginParam

    if (!loginParam) {
      context.loginParam = null

      return
    }

    const reason: unknown = 'data' in event ? event.data : undefined
    const error = isErrorLike(reason) ? reason.error : undefined

    if (error !== undefined && error !== null) {
      loginParam.callback.reject(toError(error))
    } else {
      loginParam.callback.reject(new Error('登陆尝试多次失败'))
    }

    context.loginParam = null
  }
}
