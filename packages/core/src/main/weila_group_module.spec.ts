import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Long from 'long'
import { WL } from 'proto/weilapb'
import { WL_CoreInterface, WL_PbMsgHandler } from 'main/weila_internal_data'
import WLGroupModule from 'main/weila_group_module'
import { WeilaPBGroupWrapper } from 'proto/weilapb_group_wrapper'
import { WeilaDB } from 'db/weila_db'
import { WL_IDbNotificationType } from 'db/weila_db_data'
import { WL_AnswerStatus, WL_ExtEventID } from 'main/weila_external_data'
import { setLogLevel } from 'log/weila_log'

function makeGroupModule() {
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

  const groupModule = new WLGroupModule(coreInterface)
  expect(groupModule).toBeInstanceOf(WLGroupModule)

  const handler = handlers.get(WL.Service.ServiceID.SERVICE_GROUP)

  if (!handler) throw new Error('group module did not register its handler')

  return { rspPbMsg, sendPbMsg, sendExtEvent, handler }
}

function buildResponse(
  commandId: WL.Group.GroupCommandId,
  groupMessage?: WL.Group.GroupMessage,
  resultCode = 0,
) {
  return new WL.Service.ServiceMessage({
    serviceHead: new WL.Service.ServiceHead({
      seq: 42,
      serviceId: WL.Service.ServiceID.SERVICE_GROUP,
      commandType: WL.Service.CommandType.COMMAND_RESPONSE,
      commandId,
      resultCode,
    }),
    groupMessage,
  })
}

describe('WLGroupModule response routing', () => {
  it('routes GROUP_JOIN responses so joinGroup() can resolve', () => {
    const { rspPbMsg, handler } = makeGroupModule()

    const rspGroupJoin = new WL.Group.RspGroupJoin()

    const message = buildResponse(
      WL.Group.GroupCommandId.GROUP_COMMAND_GROUP_JOIN,
      new WL.Group.GroupMessage({ rspGroupJoin }),
    )

    handler(message)

    expect(rspPbMsg).toHaveBeenCalledTimes(1)
    expect(rspPbMsg).toHaveBeenCalledWith(42, 0, rspGroupJoin)
  })

  it('forwards a null payload when the groupMessage container is absent', () => {
    const { rspPbMsg, handler } = makeGroupModule()

    handler(buildResponse(WL.Group.GroupCommandId.GROUP_COMMAND_GET_GROUPINFO))

    expect(rspPbMsg).toHaveBeenCalledWith(42, 0, null)
  })

  it('resolves delete-style commands with true instead of a payload', () => {
    const { rspPbMsg, handler } = makeGroupModule()

    handler(buildResponse(WL.Group.GroupCommandId.GROUP_COMMAND_DELETE_MEMBER))

    expect(rspPbMsg).toHaveBeenCalledWith(42, 0, true)
  })

  it('leaves unrouted commands silent instead of acking with a wrong payload', () => {
    const { rspPbMsg, handler } = makeGroupModule()

    handler(buildResponse(WL.Group.GroupCommandId.GROUP_COMMAND_GET_BLACKLIST))

    expect(rspPbMsg).not.toHaveBeenCalled()
  })

  const GROUP_BUILDER_COMMANDS = {
    buildGetGroupVersionReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_GROUPVERSION,
    buildGetGroupAttributeReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_GROUPATTRIBUTE,
    buildCreateGroupReq: WL.Group.GroupCommandId.GROUP_COMMAND_CREATE_GROUP,
    buildChangeGroupAttributeReq: WL.Group.GroupCommandId.GROUP_COMMAND_CHANGE_GROUPATTRIBUTE,
    buildGetGroupInfoReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_GROUPINFO,
    buildGetGroupOnlineMemberReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_ONLINE_MEMBER,
    buildChangeGroupMemberInfoReq: WL.Group.GroupCommandId.GROUP_COMMAND_CHANGE_MEMBERINFO,
    buildGetGroupMemberInfoReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_MEMBER_USERINFO,
    buildDelGroupMemebrReq: WL.Group.GroupCommandId.GROUP_COMMAND_DELETE_MEMBER,
    buildDelGroupReq: WL.Group.GroupCommandId.GROUP_COMMAND_DELETE_GROUP,
    buildGetGroupInvitationReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_GROUP_INVITEINFO,
    buildGroupInviteReq: WL.Group.GroupCommandId.GROUP_COMMAND_GROUP_INVITE,
    buildGroupAnswerInviteReq: WL.Group.GroupCommandId.GROUP_COMMAND_ANSWER_GROUP_INVITE,
    buildGroupGetJoinInfoReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_GROUP_JOININFO,
    buildGroupJoinReq: WL.Group.GroupCommandId.GROUP_COMMAND_GROUP_JOIN,
    buildGroupAnswerJoinReq: WL.Group.GroupCommandId.GROUP_COMMAND_ANSWER_GROUP_JOIN,
    buildGroupBroadcastReq: WL.Group.GroupCommandId.GROUP_COMMAND_BROADCAST,
    buildGroupGetBlacklistReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_BLACKLIST,
    buildGroupChangeBlacklistReq: WL.Group.GroupCommandId.GROUP_COMMAND_CHANGE_BLACKLIST,
    buildGetGroupMemberChangeLogReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_MEMBER_CHANGE_LOG,
    buildGetGroupNoticeReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_NOTICE,
    buildAddGroupNoticeReq: WL.Group.GroupCommandId.GROUP_COMMAND_ADD_NOTICE,
    buildChangeGroupNoticeReq: WL.Group.GroupCommandId.GROUP_COMMAND_CHANGE_NOTICE,
    buildDeleteGroupNoticeReq: WL.Group.GroupCommandId.GROUP_COMMAND_DELETE_NOTICE,
    buildGetGroupDetailReq: WL.Group.GroupCommandId.GROUP_COMMAND_GET_GROUPDETAIL,
    buildGetSubDeviceGroupAttributes: WL.Group.GroupCommandId.GROUP_COMMAND_GET_SUB_GROUPATTRIBUTE,
    buildAddSubMemberReq: WL.Group.GroupCommandId.GROUP_COMMAND_ADD_SUB_MEMBER,
  } satisfies Record<string, WL.Group.GroupCommandId>

  const NOT_AWAITED = new Set<number>([
    WL.Group.GroupCommandId.GROUP_COMMAND_CHANGE_MEMBERINFO,
    WL.Group.GroupCommandId.GROUP_COMMAND_GET_GROUP_INVITEINFO,
    WL.Group.GroupCommandId.GROUP_COMMAND_GET_GROUP_JOININFO,
    WL.Group.GroupCommandId.GROUP_COMMAND_GET_BLACKLIST,
    WL.Group.GroupCommandId.GROUP_COMMAND_CHANGE_BLACKLIST,
    WL.Group.GroupCommandId.GROUP_COMMAND_GET_MEMBER_CHANGE_LOG,
    WL.Group.GroupCommandId.GROUP_COMMAND_GET_NOTICE,
    WL.Group.GroupCommandId.GROUP_COMMAND_ADD_NOTICE,
    WL.Group.GroupCommandId.GROUP_COMMAND_CHANGE_NOTICE,
    WL.Group.GroupCommandId.GROUP_COMMAND_DELETE_NOTICE,
    WL.Group.GroupCommandId.GROUP_COMMAND_GET_GROUPDETAIL,
  ])

  it('covers every builder the group wrapper exposes', () => {
    expect(Object.keys(GROUP_BUILDER_COMMANDS).toSorted()).toEqual(
      Object.keys(WeilaPBGroupWrapper).toSorted(),
    )
  })

  it('routes every awaited group command and only those', () => {
    const { rspPbMsg, handler } = makeGroupModule()

    for (const commandId of Object.values(GROUP_BUILDER_COMMANDS)) {
      handler(buildResponse(commandId))

      if (NOT_AWAITED.has(commandId)) {
        expect(
          rspPbMsg,
          `${WL.Group.GroupCommandId[commandId]} should stay unrouted`,
        ).not.toHaveBeenCalled()
      } else {
        expect(rspPbMsg, `${WL.Group.GroupCommandId[commandId]} must route`).toHaveBeenCalledTimes(
          1,
        )
      }

      rspPbMsg.mockClear()
    }
  })
})

const GROUP_ID = '80010001'
const DB_VERSION = 3
const DB_USER_BASE = 910000
let dbSeq = 0

afterEach(() => {
  WeilaDB.close()
})

async function openDb(): Promise<WeilaDB> {
  dbSeq += 1
  await WeilaDB.init(String(DB_USER_BASE + dbSeq), DB_VERSION)

  return WeilaDB.getInstance()
}

function makeGroupRaw(overrides: Partial<WL.Group.IGroupAttribute> = {}): WL.Group.IGroupAttribute {
  return {
    groupId: Long.fromString(GROUP_ID),
    name: 'Alpha',
    number: 'G001',
    type: 1,
    class: 0,
    avatar: 'avatar.png',
    memberCount: 2,
    memberLimit: 200,
    memberVersion: 1,
    version: 1,
    ownerId: 5,
    desc: 'desc',
    latitude: '1.1',
    longitude: '2.2',
    shutupStatus: 0,
    audioQuality: 0,
    authType: 1,
    publicType: 2,
    burstType: 0,
    home: 'home',
    created: Long.fromNumber(1700000000),
    ...overrides,
  }
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

function makeMemberRaw(
  userId: number,
  overrides: Partial<WL.Group.IGroupMemberInfo> = {},
): WL.Group.IGroupMemberInfo {
  return {
    userId,
    type: 1,
    shutupStatus: 0,
    tts: 0,
    locationShare: 0,
    shieldStatus: 0,
    shutupTimeout: Long.ZERO,
    prority: 0,
    remark: '',
    status: 0,
    created: Long.fromNumber(1700000000),
    ...overrides,
  }
}

function buildNotify(commandId: WL.Group.GroupCommandId, groupMessage: WL.Group.GroupMessage) {
  return new WL.Service.ServiceMessage({
    serviceHead: new WL.Service.ServiceHead({
      seq: 7,
      serviceId: WL.Service.ServiceID.SERVICE_GROUP,
      commandType: WL.Service.CommandType.COMMAND_NOTIFY,
      commandId,
    }),
    groupMessage,
  })
}

async function seedGroup(db: WeilaDB, overrides: Partial<WL.Group.IGroupAttribute> = {}) {
  await db.putGroup(db.convertFromGroupRaw([makeGroupRaw(overrides)])[0])
}

async function seedMember(db: WeilaDB, userId: number) {
  await db.putMemberInfo(db.convertFromMemberRaw(GROUP_ID, [makeMemberRaw(userId)])[0])
}

async function seedUser(db: WeilaDB, userId: number, nick: string) {
  await db.putUserInfo(db.convertFromUserRaw([makeUserRaw(userId, nick)])[0])
}

describe('WLGroupModule notify handling', () => {
  it('stores and emits a group invite notification', async () => {
    const { handler, sendPbMsg, sendExtEvent } = makeGroupModule()
    const db = await openDb()
    sendPbMsg.mockResolvedValue({ groupAttrList: [makeGroupRaw()] })

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_GROUP_INVITE,
        new WL.Group.GroupMessage({
          ntfGroupInvite: {
            groupId: Long.fromString(GROUP_ID),
            inviterId: 5,
            userInfo: makeUserRaw(5, 'Inviter'),
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(sendExtEvent).toHaveBeenCalledTimes(1))

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_NEW_NOTIFICATION_IND,
      expect.objectContaining({
        notificationType: WL_IDbNotificationType.GROUP_INVITE_NOTIFICATION,
        data: expect.objectContaining({
          status: WL_AnswerStatus.ANSWER_NORMAL,
          invitorUserInfo: expect.objectContaining({ userId: 5 }),
          groupInfo: expect.objectContaining({ groupId: GROUP_ID }),
        }),
      }),
    )
    expect(await db.getAllNotifications()).toHaveLength(1)
    expect(await db.getUser(5)).toMatchObject({ nick: 'Inviter' })
  })

  it('stores and emits a group join notification', async () => {
    const { handler, sendExtEvent } = makeGroupModule()
    const db = await openDb()
    await seedGroup(db)

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_GROUP_JOIN,
        new WL.Group.GroupMessage({
          ntfGroupJoin: {
            groupId: Long.fromString(GROUP_ID),
            joinId: 6,
            detail: 'please',
            userInfo: makeUserRaw(6, 'Joiner'),
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(sendExtEvent).toHaveBeenCalledTimes(1))

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_NEW_NOTIFICATION_IND,
      expect.objectContaining({
        notificationType: WL_IDbNotificationType.GROUP_JOIN_NOTIFICATION,
        data: expect.objectContaining({
          detail: 'please',
          status: WL_AnswerStatus.ANSWER_NORMAL,
          joinUserInfo: expect.objectContaining({ userId: 6 }),
          groupInfo: expect.objectContaining({ groupId: GROUP_ID }),
        }),
      }),
    )
    expect(await db.getAllNotifications()).toHaveLength(1)
  })

  it('merges a group attribute change into the stored group', async () => {
    const { handler, sendExtEvent } = makeGroupModule()
    const db = await openDb()
    await seedGroup(db)

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_CHANGE_GROUPATTRIBUTE,
        new WL.Group.GroupMessage({
          ntfChangeGroupAttribute: {
            groupAttribute: {
              groupId: Long.fromString(GROUP_ID),
              name: 'Renamed',
              version: 9,
              memberCount: 12,
              shutupStatus: 1,
            },
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(sendExtEvent).toHaveBeenCalledTimes(1))

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_GROUP_MODIFIED_IND,
      expect.objectContaining({ name: 'Renamed', version: 9, speechEnable: false }),
    )
    expect(await db.getGroup(GROUP_ID)).toMatchObject({
      name: 'Renamed',
      version: 9,
      memberCount: 12,
      speechEnable: false,
    })
  })

  it('merges a member change into the stored member', async () => {
    const { handler, sendExtEvent } = makeGroupModule()
    const db = await openDb()
    await seedGroup(db)
    await seedMember(db, 7)

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_CHANGE_MEMBERINFO,
        new WL.Group.GroupMessage({
          ntfChangeMemberInfo: {
            groupId: Long.fromString(GROUP_ID),
            memberInfo: {
              userId: 7,
              status: 1,
              type: 2,
              remark: 'lead',
              shieldStatus: 1,
              tts: 1,
            },
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(sendExtEvent).toHaveBeenCalledTimes(1))

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_GROUP_MEMBERS_MODIFIED_IND,
      expect.objectContaining({
        userId: 7,
        status: 1,
        memberType: 2,
        remark: 'lead',
        blockedStatus: true,
        tts: true,
      }),
    )
    expect(await db.getGroupMemberInfo(GROUP_ID, 7)).toMatchObject({
      status: 1,
      memberType: 2,
      remark: 'lead',
      blockedStatus: true,
      tts: true,
    })
  })

  it('deletes the stored group and emits the group id', async () => {
    const { handler, sendExtEvent } = makeGroupModule()
    const db = await openDb()
    await seedGroup(db)

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_DELETE_GROUP,
        new WL.Group.GroupMessage({
          ntfDeleteGroup: { groupId: Long.fromString(GROUP_ID) },
        }),
      ),
    )

    await vi.waitFor(() => expect(sendExtEvent).toHaveBeenCalledTimes(1))

    expect(sendExtEvent).toHaveBeenCalledWith(WL_ExtEventID.WL_EXT_GROUP_DELETED_IND, GROUP_ID)
    expect(await db.getGroup(GROUP_ID)).toBeUndefined()
  })

  it('deletes the named members and emits the delete info', async () => {
    const { handler, sendExtEvent } = makeGroupModule()
    const db = await openDb()
    await seedGroup(db)
    await seedMember(db, 7)
    await seedMember(db, 8)

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_DELETE_MEMBER,
        new WL.Group.GroupMessage({
          ntfDeleteMember: {
            groupId: Long.fromString(GROUP_ID),
            initiatorId: 5,
            userIdList: [7, 8],
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(sendExtEvent).toHaveBeenCalledTimes(1))

    expect(sendExtEvent).toHaveBeenCalledWith(WL_ExtEventID.WL_EXT_GROUP_MEMBER_DELETED_IND, {
      groupId: GROUP_ID,
      initiatorId: 5,
      userIdList: [7, 8],
    })
    expect(await db.getGroupMemberInfo(GROUP_ID, 7)).toBeUndefined()
    expect(await db.getGroupMemberInfo(GROUP_ID, 8)).toBeUndefined()
  })

  it('stores new members and users before emitting the joined event', async () => {
    const { handler, sendExtEvent } = makeGroupModule()
    const db = await openDb()
    await seedGroup(db)

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_NEW_MEMBER,
        new WL.Group.GroupMessage({
          ntfNewMember: {
            groupId: Long.fromString(GROUP_ID),
            inviterId: 5,
            memberInfoList: [makeMemberRaw(9)],
            userInfoList: [makeUserRaw(9, 'Newcomer')],
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(sendExtEvent).toHaveBeenCalledTimes(1))

    expect(sendExtEvent).toHaveBeenCalledWith(WL_ExtEventID.WL_EXT_GROUP_NEW_MEMBER_JOINED_IND, [
      expect.objectContaining({ userId: 9 }),
    ])
    expect(await db.getGroupMemberInfo(GROUP_ID, 9)).toMatchObject({ userId: 9 })
    expect(await db.getUser(9)).toMatchObject({ nick: 'Newcomer' })
  })

  it('stores and emits an answer-join notification', async () => {
    const { handler, sendExtEvent } = makeGroupModule()
    const db = await openDb()
    await seedGroup(db)
    await seedUser(db, 5, 'Answerer')
    await seedUser(db, 6, 'Joiner')

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_ANSWER_GROUP_JOIN,
        new WL.Group.GroupMessage({
          ntfAnswerGroupJoin: {
            groupId: Long.fromString(GROUP_ID),
            joinId: 6,
            answerId: 5,
            status: 1,
            updated: Long.fromNumber(1700000123),
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(sendExtEvent).toHaveBeenCalledTimes(1))

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_NEW_NOTIFICATION_IND,
      expect.objectContaining({
        notificationType: WL_IDbNotificationType.GROUP_ANSWER_JOIN_NOTIFICATION,
        data: expect.objectContaining({
          status: 1,
          updated: 1700000123,
          joinUserInfo: expect.objectContaining({ userId: 6 }),
          answerUserInfo: expect.objectContaining({ userId: 5 }),
          groupInfo: expect.objectContaining({ groupId: GROUP_ID }),
        }),
      }),
    )
  })

  it('stores and emits an answer-invite notification', async () => {
    const { handler, sendExtEvent } = makeGroupModule()
    const db = await openDb()
    await seedGroup(db)
    await seedUser(db, 5, 'Inviter')
    await seedUser(db, 6, 'Invitee')

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_ANSWER_GROUP_INVITE,
        new WL.Group.GroupMessage({
          ntfAnswerGroupInvite: {
            groupId: Long.fromString(GROUP_ID),
            inviterId: 5,
            inviteeId: 6,
            status: 2,
            updated: Long.fromNumber(1700000456),
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(sendExtEvent).toHaveBeenCalledTimes(1))

    expect(sendExtEvent).toHaveBeenCalledWith(
      WL_ExtEventID.WL_EXT_NEW_NOTIFICATION_IND,
      expect.objectContaining({
        notificationType: WL_IDbNotificationType.GROUP_ANSWER_INVITE_NOTIFICATION,
        data: expect.objectContaining({
          status: 2,
          updated: 1700000456,
          invitorUserInfo: expect.objectContaining({ userId: 5 }),
          inviteeUserInfo: expect.objectContaining({ userId: 6 }),
          groupInfo: expect.objectContaining({ groupId: GROUP_ID }),
        }),
      }),
    )
  })

  it('ignores a broadcast notify', async () => {
    const { handler, sendExtEvent } = makeGroupModule()
    await openDb()

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_BROADCAST,
        new WL.Group.GroupMessage({ ntfGroupBroadcast: {} }),
      ),
    )

    await Promise.resolve()

    expect(sendExtEvent).not.toHaveBeenCalled()
  })
})

function collectUnhandledRejections() {
  let count = 0

  const listener = () => {
    count += 1
  }

  process.on('unhandledRejection', listener)

  return {
    count: () => count,
    stop: () => process.off('unhandledRejection', listener),
  }
}

function captureLoggedErrors() {
  setLogLevel('error')

  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('WLGroupModule notify failures', () => {
  afterEach(() => {
    setLogLevel('silent')
    vi.restoreAllMocks()
  })

  it('logs a failed invite without an unhandled rejection', async () => {
    const { handler, sendPbMsg } = makeGroupModule()
    await openDb()
    sendPbMsg.mockRejectedValue(new Error('network down'))
    const logged = captureLoggedErrors()
    const unhandled = collectUnhandledRejections()

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_GROUP_INVITE,
        new WL.Group.GroupMessage({
          ntfGroupInvite: {
            groupId: Long.fromString(GROUP_ID),
            inviterId: 5,
            userInfo: makeUserRaw(5, 'Inviter'),
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(logged).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    unhandled.stop()

    expect(unhandled.count()).toBe(0)
  })

  it('logs a failed join without an unhandled rejection', async () => {
    const { handler } = makeGroupModule()
    const db = await openDb()
    vi.spyOn(db, 'putUserInfo').mockRejectedValue(new Error('quota'))
    const logged = captureLoggedErrors()
    const unhandled = collectUnhandledRejections()

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_GROUP_JOIN,
        new WL.Group.GroupMessage({
          ntfGroupJoin: {
            groupId: Long.fromString(GROUP_ID),
            joinId: 6,
            detail: 'please',
            userInfo: makeUserRaw(6, 'Joiner'),
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(logged).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    unhandled.stop()

    expect(unhandled.count()).toBe(0)
  })

  it('logs a failed answer-join without an unhandled rejection', async () => {
    const { handler } = makeGroupModule()
    const db = await openDb()
    vi.spyOn(db, 'putNotification').mockRejectedValue(new Error('quota'))
    const logged = captureLoggedErrors()
    const unhandled = collectUnhandledRejections()

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_ANSWER_GROUP_JOIN,
        new WL.Group.GroupMessage({
          ntfAnswerGroupJoin: {
            groupId: Long.fromString(GROUP_ID),
            joinId: 6,
            answerId: 5,
            status: 1,
            updated: Long.fromNumber(1700000123),
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(logged).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    unhandled.stop()

    expect(unhandled.count()).toBe(0)
  })

  it('logs a failed answer-invite without an unhandled rejection', async () => {
    const { handler } = makeGroupModule()
    const db = await openDb()
    vi.spyOn(db, 'putNotification').mockRejectedValue(new Error('quota'))
    const logged = captureLoggedErrors()
    const unhandled = collectUnhandledRejections()

    handler(
      buildNotify(
        WL.Group.GroupCommandId.GROUP_COMMAND_ANSWER_GROUP_INVITE,
        new WL.Group.GroupMessage({
          ntfAnswerGroupInvite: {
            groupId: Long.fromString(GROUP_ID),
            inviterId: 5,
            inviteeId: 6,
            status: 2,
            updated: Long.fromNumber(1700000456),
          },
        }),
      ),
    )

    await vi.waitFor(() => expect(logged).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    unhandled.stop()

    expect(unhandled.count()).toBe(0)
  })
})
