import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WL } from 'proto/weilapb'
import { WL_CoreInterface, WL_PbMsgHandler } from 'main/weila_internal_data'
import WLSessionModule from 'main/weila_session_module'
import { WeilaPBSessionWrapper } from 'proto/weilapb_session_wrapper'
import { WeilaDB } from 'db/weila_db'
import { WL_IDbSessionStatus, type WL_IDbSessionExtra } from 'db/weila_db_data'

function makeSessionModule() {
  const rspPbMsg = vi.fn()
  const handlers = new Map<number, WL_PbMsgHandler>()

  const coreInterface: WL_CoreInterface = {
    sendExtEvent: vi.fn(),
    sendPbMsg: vi.fn(),
    rspPbMsg,
    registerPbMsgHandler: (serviceId: number, handler: WL_PbMsgHandler) => {
      handlers.set(serviceId, handler)
    },
    executeCoreFunc: vi.fn(),
    getLoginUserInfo: vi.fn(),
  }

  const sessionModule = new WLSessionModule(coreInterface)
  expect(sessionModule).toBeInstanceOf(WLSessionModule)

  const handler = handlers.get(WL.Service.ServiceID.SERVICE_SESSION)

  if (!handler) throw new Error('session module did not register its handler')

  return { rspPbMsg, handler, sessionModule }
}

function buildResponse(
  commandId: WL.Session.SessionCommandId,
  sessionMessage?: WL.Session.SessionMessage,
  resultCode = 0,
) {
  return new WL.Service.ServiceMessage({
    serviceHead: new WL.Service.ServiceHead({
      seq: 42,
      serviceId: WL.Service.ServiceID.SERVICE_SESSION,
      commandType: WL.Service.CommandType.COMMAND_RESPONSE,
      commandId,
      resultCode,
    }),
    sessionMessage,
  })
}

async function seedCorpGroupSession(extra?: WL_IDbSessionExtra): Promise<void> {
  await WeilaDB.getInstance().putSession({
    combo_id_type: '80001922_18',
    sessionId: '80001922',
    sessionType: WL.Common.SessionType.SESSION_TYPE_CORP_GROUP,
    sessionName: '验证群01',
    sessionAvatar: '',
    readMsgId: 0,
    lastMsgId: 0,
    latestUpdate: 0,
    status: WL_IDbSessionStatus.SESSION_INVALID,
    extra,
  })
}

describe('WLSessionModule response routing', () => {
  it('routes MSGDATA responses so every send path can resolve', () => {
    const { rspPbMsg, handler } = makeSessionModule()

    const rspMsg = new WL.Session.RspMsg({ msgId: 16191652001 })

    const message = buildResponse(
      WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
      new WL.Session.SessionMessage({ rspMsg }),
    )

    handler(message)

    expect(rspPbMsg).toHaveBeenCalledTimes(1)
    expect(rspPbMsg).toHaveBeenCalledWith(42, 0, rspMsg)
  })

  it('forwards a null payload when the sessionMessage container is absent', () => {
    const { rspPbMsg, handler } = makeSessionModule()

    handler(buildResponse(WL.Session.SessionCommandId.SESSION_COMMAND_GET_MSG))

    expect(rspPbMsg).toHaveBeenCalledWith(42, 0, null)
  })

  it('resolves REMOVE_SESSION with true instead of a payload', () => {
    const { rspPbMsg, handler } = makeSessionModule()

    handler(buildResponse(WL.Session.SessionCommandId.SESSION_COMMAND_REMOVE_SESSION))

    expect(rspPbMsg).toHaveBeenCalledWith(42, 0, true)
  })

  it('leaves unrouted commands silent instead of acking with a wrong payload', () => {
    const { rspPbMsg, handler } = makeSessionModule()

    handler(buildResponse(WL.Session.SessionCommandId.SESSION_COMMAND_GET_UNREAD_MSG))

    expect(rspPbMsg).not.toHaveBeenCalled()
  })

  const SESSION_BUILDER_COMMANDS = {
    buildGetSessionReq: WL.Session.SessionCommandId.SESSION_COMMAND_GET_SESSION,
    buildRemoveSessionReq: WL.Session.SessionCommandId.SESSION_COMMAND_REMOVE_SESSION,
    buildMsgReadReq: WL.Session.SessionCommandId.SESSION_COMMAND_READ_MSG,
    buildMsgGetUnReadReq: WL.Session.SessionCommandId.SESSION_COMMAND_GET_UNREAD_MSG,
    buildMsgGetMsgReq: WL.Session.SessionCommandId.SESSION_COMMAND_GET_MSG,
    buildBurstControlReq: WL.Session.SessionCommandId.SESSION_COMMAND_BURST_CONTROL,
    buildMonitorControlReq: WL.Session.SessionCommandId.SESSION_COMMAND_MONITOR_CONTROL,
    buildMsgDataReq: WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
    buildTextSessionMsgReq: WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
    buildImageSessionMsgReq: WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
    buildMediaInfoSessionMsgReq: WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
    buildLocationInfoSessionMsgReq: WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
    buildAudioSessionMsgReq: WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
    buildPttSessionMsgReq: WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
    buildServiceSessionMsgReq: WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
    buildSwitchSessionMsgReq: WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
    buildWithDrawMsgReq: WL.Session.SessionCommandId.SESSION_COMMAND_MSGDATA,
  } satisfies Record<string, WL.Session.SessionCommandId>

  const NOT_AWAITED = new Set<number>([
    WL.Session.SessionCommandId.SESSION_COMMAND_GET_UNREAD_MSG,
    WL.Session.SessionCommandId.SESSION_COMMAND_BURST_CONTROL,
    WL.Session.SessionCommandId.SESSION_COMMAND_MONITOR_CONTROL,
  ])

  it('covers every builder the session wrapper exposes', () => {
    expect(Object.keys(SESSION_BUILDER_COMMANDS).toSorted()).toEqual(
      Object.keys(WeilaPBSessionWrapper).toSorted(),
    )
  })

  it('routes every awaited session command and only those', () => {
    const { rspPbMsg, handler } = makeSessionModule()

    for (const commandId of Object.values(SESSION_BUILDER_COMMANDS)) {
      handler(buildResponse(commandId))

      if (NOT_AWAITED.has(commandId)) {
        expect(
          rspPbMsg,
          `${WL.Session.SessionCommandId[commandId]} should stay unrouted`,
        ).not.toHaveBeenCalled()
      } else {
        expect(
          rspPbMsg,
          `${WL.Session.SessionCommandId[commandId]} must route`,
        ).toHaveBeenCalledTimes(1)
      }

      rspPbMsg.mockClear()
    }
  })
})

describe('WLSessionModule.updateSessionProfile member count', () => {
  beforeEach(async () => {
    await WeilaDB.init('member-count-test', 3)
  })

  afterEach(() => {
    WeilaDB.close()
  })

  it('stores a corp group member count in the session extra', async () => {
    const { sessionModule } = makeSessionModule()
    await seedCorpGroupSession()

    await sessionModule.updateSessionProfile('80001922', 18, {
      sessionName: '验证群01',
      memberCount: 5,
    })

    const session = await WeilaDB.getInstance().getSession('80001922', 18)

    expect(session?.extra).toEqual({ memberCount: 5 })
  })

  it('preserves existing extra keys when it stores the member count', async () => {
    const { sessionModule } = makeSessionModule()
    await seedCorpGroupSession({ pinned: true })

    await sessionModule.updateSessionProfile('80001922', 18, { memberCount: 5 })

    const session = await WeilaDB.getInstance().getSession('80001922', 18)

    expect(session?.extra).toEqual({ pinned: true, memberCount: 5 })
  })

  it('merges profile.extra into the stored extra instead of replacing it', async () => {
    const { sessionModule } = makeSessionModule()
    await seedCorpGroupSession({ pinned: true, memberCount: 3 })

    await sessionModule.updateSessionProfile('80001922', 18, {
      extra: { sessionAvatar: 'https://cdn.voiswork.cn/a.png' },
    })

    const session = await WeilaDB.getInstance().getSession('80001922', 18)

    expect(session?.extra).toEqual({
      pinned: true,
      memberCount: 3,
      sessionAvatar: 'https://cdn.voiswork.cn/a.png',
    })
  })

  it('lets profile.extra override the stored memberCount', async () => {
    const { sessionModule } = makeSessionModule()
    await seedCorpGroupSession({ memberCount: 3 })

    await sessionModule.updateSessionProfile('80001922', 18, {
      memberCount: 5,
      extra: { memberCount: 7 },
    })

    const session = await WeilaDB.getInstance().getSession('80001922', 18)

    expect(session?.extra).toEqual({ memberCount: 7 })
  })
})
