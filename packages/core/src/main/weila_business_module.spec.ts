import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Long from 'long'
import { WL } from 'proto/weilapb'
import { WL_CoreInterface, WL_PbMsgHandler } from 'main/weila_internal_data'
import WLBusinessModule from 'main/weila_business_module'
import { WeilaPbBusinessWrapper } from 'proto/weilapb_business_wrapper'
import { WeilaDB } from 'db/weila_db'
import { WL_ServiceStatus } from 'db/weila_db_data'
import { WL_ExtEventID } from 'main/weila_external_data'

function makeBusinessModule() {
  const rspPbMsg = vi.fn()
  const sendPbMsg = vi.fn()
  const sendExtEvent = vi.fn()
  const handlers = new Map<number, WL_PbMsgHandler>()

  const coreInterface: WL_CoreInterface = {
    sendExtEvent,
    sendPbMsg,
    rspPbMsg,
    registerPbMsgHandler: (serviceId: number, handler: WL_PbMsgHandler) => {
      handlers.set(serviceId, handler)
    },
    executeCoreFunc: vi.fn(),
    getLoginUserInfo: vi.fn(),
  }

  const businessModule = new WLBusinessModule(coreInterface)
  expect(businessModule).toBeInstanceOf(WLBusinessModule)

  const handler = handlers.get(WL.Service.ServiceID.SERVICE_BUSINESS)

  if (!handler) throw new Error('business module did not register its handler')

  return { rspPbMsg, sendPbMsg, sendExtEvent, handler }
}

function buildResponse(
  commandId: WL.Business.BusinessCommandId,
  businessMessage?: WL.Business.BusinessMessage,
  resultCode = 0,
) {
  return new WL.Service.ServiceMessage({
    serviceHead: new WL.Service.ServiceHead({
      seq: 42,
      serviceId: WL.Service.ServiceID.SERVICE_BUSINESS,
      commandType: WL.Service.CommandType.COMMAND_RESPONSE,
      commandId,
      resultCode,
    }),
    businessMessage,
  })
}

describe('WLBusinessModule response routing', () => {
  it('routes COMMON_GET_SESSION responses so getSessionServiceFromServer() can resolve', () => {
    const { rspPbMsg, handler } = makeBusinessModule()

    const rspCommonGetSessions = new WL.Business.RspCommonGetSessions()

    const message = buildResponse(
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_GET_SESSION,
      new WL.Business.BusinessMessage({ rspCommonGetSessions }),
    )

    handler(message)

    expect(rspPbMsg).toHaveBeenCalledTimes(1)
    expect(rspPbMsg).toHaveBeenCalledWith(42, 0, rspCommonGetSessions)
  })

  it('keeps the failure contract: nonzero resultCode forwards a null payload', () => {
    const { rspPbMsg, handler } = makeBusinessModule()

    const message = buildResponse(
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_SEARCH_STAFFS,
      new WL.Business.BusinessMessage(),
      1,
    )

    handler(message)

    expect(rspPbMsg).toHaveBeenCalledWith(42, 1, null)
  })

  it('resolves the ten ack commands with true instead of a payload', () => {
    const { rspPbMsg, handler } = makeBusinessModule()

    handler(buildResponse(WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_CLOSE_SESSION))

    expect(rspPbMsg).toHaveBeenCalledWith(42, 0, true)
  })

  it('leaves unrouted commands silent instead of acking with a wrong payload', () => {
    const { rspPbMsg, handler } = makeBusinessModule()

    handler(buildResponse(WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_STAFF_EXIT))

    expect(rspPbMsg).not.toHaveBeenCalled()
  })

  const BUSINESS_BUILDER_COMMANDS = {
    buildCommonGetSessionsReq: WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_GET_SESSION,
    buildCommonStaffInviteReq: WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_STAFF_INVITE,
    buildCommonAnswerStaffInviteReq:
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_ANSWER_STAFF_INVITE,
    buildCommonGetStaffInviteReq:
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_GET_STAFF_INVITE,
    buildCommonStaffExitReq: WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_STAFF_EXIT,
    buildCommonStaffDeleteReq: WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_STAFF_DELETE,
    buildStaffAcceptSessionReq: WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_ACCEPT_SESSION,
    buildStaffExitSessionReq: WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_EXIT_SESSION,
    buildStaffCloseSessionReq: WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_CLOSE_SESSION,
    buildStaffSessionInviteReq: WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_SESSION_INVITE,
    buildStaffAnswerSessionInviteReq:
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_ANSWER_SESSION_INVITE,
    buildStaffRemoveSessionStaffReq:
      WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_REMOVE_SESSION_STAFFS,
    buildStaffSearchStaffsReq: WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_SEARCH_STAFFS,
    buildStaffResetSessionReq: WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_RESET_SESSION,
  } satisfies Record<string, WL.Business.BusinessCommandId>

  const NOT_AWAITED = new Set<number>([
    WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_STAFF_EXIT,
  ])

  it('covers every builder the business wrapper exposes', () => {
    expect(Object.keys(BUSINESS_BUILDER_COMMANDS).toSorted()).toEqual(
      Object.keys(WeilaPbBusinessWrapper).toSorted(),
    )
  })

  it('routes every awaited business command and only those', () => {
    const { rspPbMsg, handler } = makeBusinessModule()

    for (const commandId of Object.values(BUSINESS_BUILDER_COMMANDS)) {
      handler(buildResponse(commandId))

      if (NOT_AWAITED.has(commandId)) {
        expect(
          rspPbMsg,
          `${WL.Business.BusinessCommandId[commandId]} should stay unrouted`,
        ).not.toHaveBeenCalled()
      } else {
        expect(
          rspPbMsg,
          `${WL.Business.BusinessCommandId[commandId]} must route`,
        ).toHaveBeenCalledTimes(1)
      }

      rspPbMsg.mockClear()
    }
  })
})

const SESSION_ID = '80090001'
const SERVICE_ID = 12
const STAFF_ID = 22
const CUSTOMER_ID = 21
const DB_VERSION = 3
const DB_USER_BASE = 920000
let dbSeq = 0

afterEach(() => {
  WeilaDB.close()
})

async function openDb(): Promise<WeilaDB> {
  dbSeq += 1
  await WeilaDB.init(String(DB_USER_BASE + dbSeq), DB_VERSION)

  return WeilaDB.getInstance()
}

function makeUserRaw(userId: number, nick: string): WL.Common.IUserInfo {
  return {
    userId,
    nick,
    avatar: 'user.png',
    number: String(userId),
    status: 0,
    type: 0,
    sex: 0,
    created: Long.fromNumber(1700000000),
  }
}

function makeStaffRaw(userId: number): WL.Business.IStaffAttribute {
  return {
    userInfo: makeUserRaw(userId, 'Agent'),
    class: 0,
    type: 0,
    admin: 0,
    operator: 0,
    created: Long.fromNumber(1700000000),
  }
}

function makeServiceRaw(
  overrides: Partial<WL.Business.IServiceAttribute> = {},
): WL.Business.IServiceAttribute {
  return {
    id: SERVICE_ID,
    number: 'S12',
    class: 0,
    type: 0,
    avatar: 'service.png',
    intro: 'help',
    name: 'Support',
    url: '',
    created: Long.fromNumber(1700000000),
    ...overrides,
  }
}

function makeSessionRaw(
  overrides: Partial<WL.Business.IServiceSession> = {},
): WL.Business.IServiceSession {
  return {
    serviceAttribute: makeServiceRaw(),
    staffAttributes: [makeStaffRaw(STAFF_ID)],
    customerAttribute: { userInfo: makeUserRaw(CUSTOMER_ID, 'Customer') },
    status: WL_ServiceStatus.SERVICE_STATUS_INIT,
    created: Long.fromNumber(1700000000),
    updated: Long.fromNumber(1700000100),
    ...overrides,
  }
}

function buildNotify(
  commandId: WL.Business.BusinessCommandId,
  businessMessage?: WL.Business.BusinessMessage,
) {
  return new WL.Service.ServiceMessage({
    serviceHead: new WL.Service.ServiceHead({
      seq: 7,
      serviceId: WL.Service.ServiceID.SERVICE_BUSINESS,
      commandType: WL.Service.CommandType.COMMAND_NOTIFY,
      commandId,
    }),
    businessMessage,
  })
}

describe('WLBusinessModule notify handling', () => {
  it('emits a session change and persists an init session', async () => {
    const { handler, sendExtEvent } = makeBusinessModule()
    const db = await openDb()

    handler(
      buildNotify(
        WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_SESSION_CHANGE,
        new WL.Business.BusinessMessage({
          ntfCommonSessionChange: { session: makeSessionRaw() },
        }),
      ),
    )

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_COMMON_SESSION_CHANGE_IND,
      expect.objectContaining({
        serviceSession: expect.objectContaining({
          serviceId: SERVICE_ID,
          serviceStatus: WL_ServiceStatus.SERVICE_STATUS_INIT,
          staffIds: [STAFF_ID],
          customerId: CUSTOMER_ID,
          createdTime: 1700000000,
          updatedTime: 1700000100,
        }),
      }),
    )

    await vi.waitFor(async () => {
      expect(await db.getService(SERVICE_ID)).toMatchObject({ name: 'Support' })
      expect(await db.getServiceStaff(STAFF_ID)).toMatchObject({
        staff: { userId: STAFF_ID },
      })
      expect(await db.getUser(CUSTOMER_ID)).toMatchObject({ nick: 'Customer' })
      expect(await db.getUser(STAFF_ID)).toMatchObject({ nick: 'Agent' })
    })
  })

  it('emits a staff invite with the service and invitor', async () => {
    const { handler, sendExtEvent } = makeBusinessModule()
    await openDb()

    handler(
      buildNotify(
        WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_STAFF_INVITE,
        new WL.Business.BusinessMessage({
          ntfCommonStaffInvite: {
            inviteInfo: {
              invitor: makeStaffRaw(STAFF_ID),
              serviceAttribute: makeServiceRaw(),
              content: 'join us',
            },
          },
        }),
      ),
    )

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_COMMON_STAFF_INVITE_IND,
      expect.objectContaining({
        content: 'join us',
        service: expect.objectContaining({ serviceId: SERVICE_ID }),
        invitorInfo: expect.objectContaining({
          staff: expect.objectContaining({ userId: STAFF_ID }),
          userData: expect.objectContaining({ userId: STAFF_ID }),
        }),
      }),
    )
  })

  it('emits a staff answer with the answer status', () => {
    const { handler, sendExtEvent } = makeBusinessModule()

    handler(
      buildNotify(
        WL.Business.BusinessCommandId.BUSINESS_COMMAND_COMMON_ANSWER_STAFF_INVITE,
        new WL.Business.BusinessMessage({
          ntfCommonAnswerStaffInvite: { serviceId: SERVICE_ID, userId: STAFF_ID, status: 1 },
        }),
      ),
    )

    expect(sendExtEvent).toHaveBeenCalledWith(WL_ExtEventID.WL_EXT_COMMON_ANSWER_INVITE_IND, {
      serviceId: SERVICE_ID,
      userId: STAFF_ID,
      status: 1,
    })
  })

  const STAFF_SESSION_NOTIFICATIONS = [
    {
      commandId: WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_ACCEPT_SESSION,
      notification: {
        ntfStaffAcceptSession: { sessionId: Long.fromString(SESSION_ID), staffId: STAFF_ID },
      },
      eventId: WL_ExtEventID.WL_EXT_STAFF_ACCEPT_SESSION_IND,
    },
    {
      commandId: WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_EXIT_SESSION,
      notification: {
        ntfStaffExitSession: { sessionId: Long.fromString(SESSION_ID), staffId: STAFF_ID },
      },
      eventId: WL_ExtEventID.WL_EXT_STAFF_EXIT_SESSION_IND,
    },
    {
      commandId: WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_CLOSE_SESSION,
      notification: {
        ntfStaffCloseSession: { sessionId: Long.fromString(SESSION_ID), staffId: STAFF_ID },
      },
      eventId: WL_ExtEventID.WL_EXT_STAFF_CLOSE_SESSION_IND,
    },
  ]

  it('emits accept, exit and close staff session events', () => {
    const { handler, sendExtEvent } = makeBusinessModule()

    for (const { commandId, notification, eventId } of STAFF_SESSION_NOTIFICATIONS) {
      handler(buildNotify(commandId, new WL.Business.BusinessMessage(notification)))

      expect(sendExtEvent, WL.Business.BusinessCommandId[commandId]).toHaveBeenCalledWith(eventId, {
        sessionId: SESSION_ID,
        staffId: STAFF_ID,
      })

      sendExtEvent.mockClear()
    }
  })

  it('emits a staff session invite with the converted session', async () => {
    const { handler, sendExtEvent } = makeBusinessModule()
    await openDb()

    handler(
      buildNotify(
        WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_SESSION_INVITE,
        new WL.Business.BusinessMessage({
          ntfStaffSessionInvite: { session: makeSessionRaw(), content: 'take it' },
        }),
      ),
    )

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_STAFF_SESSION_INVITE_IND,
      expect.objectContaining({
        content: 'take it',
        session: expect.objectContaining({
          serviceSession: expect.objectContaining({ serviceId: SERVICE_ID }),
        }),
      }),
    )
  })

  it('emits a staff answer-invite event', async () => {
    const { handler, sendExtEvent } = makeBusinessModule()
    await openDb()

    handler(
      buildNotify(
        WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_ANSWER_SESSION_INVITE,
        new WL.Business.BusinessMessage({
          ntfStaffAnswerSessionInvite: {
            sessionId: Long.fromString(SESSION_ID),
            invitee: makeStaffRaw(STAFF_ID),
            status: 2,
          },
        }),
      ),
    )

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_STAFF_ANSWER_INVITE_IND,
      expect.objectContaining({
        sessionId: SESSION_ID,
        status: 2,
        invitee: expect.objectContaining({
          staff: expect.objectContaining({ userId: STAFF_ID }),
          userData: expect.objectContaining({ userId: STAFF_ID }),
        }),
      }),
    )
  })

  it('emits the removed session id', () => {
    const { handler, sendExtEvent } = makeBusinessModule()

    handler(
      buildNotify(
        WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_REMOVE_SESSION_STAFFS,
        new WL.Business.BusinessMessage({
          ntfStaffRemoveSessionStaff: { sessionId: Long.fromString(SESSION_ID) },
        }),
      ),
    )

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_STAFF_REMOVED_SESSION_IND,
      SESSION_ID,
    )
  })

  it('ignores a notify without a business message', () => {
    const { handler, sendExtEvent } = makeBusinessModule()

    handler(buildNotify(WL.Business.BusinessCommandId.BUSINESS_COMMAND_STAFF_ACCEPT_SESSION))

    expect(sendExtEvent).not.toHaveBeenCalled()
  })
})
