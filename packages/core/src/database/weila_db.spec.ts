import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { Dexie } from 'dexie'
import Long from 'long'
import { WL } from 'proto/weilapb'
import { WeilaDB } from './weila_db'
import {
  WL_IDbMsgDataStatus,
  WL_IDbMsgDataType,
  WL_IDbSessionStatus,
  WL_IDbSettingID,
  type WL_IDbMsgData,
  type WL_IDbSession,
} from './weila_db_data'

const CURRENT_DB_VERSION = 3

const CAPTURED_IMAGE_URL =
  'http://weilacache.oss-cn-shenzhen.aliyuncs.com/media/cg/80001922/20261125/1875437_142130_1.jpg'

const CAPTURED_IMAGE_SERVICE_DATA = JSON.stringify({
  service_type: 'image',
  content: { url: CAPTURED_IMAGE_URL },
})

const TABLE_NAMES = [
  'sessions',
  'session_setting',
  'groups',
  'friends',
  'users',
  'group_members',
  'msgDatas',
  'settings',
  'notifications',
  'extensions',
  'service',
  'service_staffs',
]

let userSeq = 0

function nextUserId(): string {
  userSeq += 1

  return String(900000 + userSeq)
}

async function openDb(userId: string, version: number): Promise<WeilaDB> {
  await WeilaDB.init(userId, version)

  return WeilaDB.getInstance()
}

function makeSession(sessionId: string): WL_IDbSession {
  return {
    combo_id_type: `${sessionId}_${WL.Common.SessionType.SESSION_TYPE_SINGLE}`,
    sessionId,
    sessionType: WL.Common.SessionType.SESSION_TYPE_SINGLE,
    sessionName: 'tester',
    sessionAvatar: '',
    readMsgId: 0,
    lastMsgId: 0,
    latestUpdate: 1000,
    status: WL_IDbSessionStatus.SESSION_ACTIVATE,
  }
}

function makeMessage(sessionId: string, msgId: number): WL_IDbMsgData {
  return {
    combo_id: `${sessionId}_${WL.Common.SessionType.SESSION_TYPE_SINGLE}_${msgId}`,
    senderId: 7,
    sessionId,
    sessionType: WL.Common.SessionType.SESSION_TYPE_SINGLE,
    msgId,
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE,
    created: 2000 + msgId,
    autoReply: 0,
    status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_READ,
    textData: `message ${msgId}`,
  }
}

function makeServiceRaw(
  sessionId: string,
  msgId: number,
  serviceData: string,
): WL.Session.IMsgData {
  return {
    senderId: 7,
    sessionId: Long.fromString(sessionId),
    sessionType: WL.Common.SessionType.SESSION_TYPE_SINGLE,
    msgId,
    created: Long.fromNumber(2000 + msgId),
    msgType: WL.Session.MessageType.MSG_TYPE_SERVICE,
    serviceData,
  }
}

afterEach(() => {
  WeilaDB.close()
})

describe('WeilaDB schema', () => {
  it('opens every stored table at the declared schema version', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)
    await db.open()

    expect(db.verno).toBe(CURRENT_DB_VERSION)
    expect(db.backendDB().version).toBe(CURRENT_DB_VERSION * 10)
    expect(db.tables.map((table) => table.name).toSorted()).toEqual(TABLE_NAMES.toSorted())
    expect(Array.from(db.backendDB().objectStoreNames).toSorted()).toEqual(TABLE_NAMES.toSorted())
  })
})

describe('WeilaDB messages', () => {
  it('round-trips a message through the public database methods', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)
    const message = makeMessage('4100', 11)

    await db.putMsgData(message)

    await expect(db.getMsgData(message.combo_id)).resolves.toEqual(message)
    const latest = await db.getLastMsgDatas(message.sessionId, message.sessionType, 10)
    expect(latest.map((item) => item.msgId)).toEqual([message.msgId])
  })

  it('deletes a session and its messages through one transaction', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)
    const session = makeSession('4200')
    const message = makeMessage(session.sessionId, 12)

    await db.putSession(session)
    await db.putMsgData(message)
    await db.delSessions([session.combo_id_type])

    await expect(db.getSession(session.sessionId, session.sessionType)).resolves.toBeUndefined()
    await expect(db.getMsgData(message.combo_id)).resolves.toBeUndefined()
  })
})

describe('WeilaDB service messages', () => {
  it('converts an image service message into an image message', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)

    const messages = db.convertFromMsgDataRaws(
      [makeServiceRaw('4700', 21, CAPTURED_IMAGE_SERVICE_DATA)],
      7,
    )

    expect(messages).toHaveLength(1)
    expect(messages[0].msgType).toBe(WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE)
    expect(messages[0].fileInfo?.fileUrl).toBe(CAPTURED_IMAGE_URL)
    expect(messages[0].serviceData).toBeUndefined()
  })

  it('repairs service messages already stored as legacy rows', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)

    const legacyMessage: WL_IDbMsgData = {
      combo_id: '4800_1_22',
      senderId: 7,
      sessionId: '4800',
      sessionType: WL.Common.SessionType.SESSION_TYPE_SINGLE,
      msgId: 22,
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
      created: 2022,
      autoReply: 0,
      status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_READ,
      serviceData: CAPTURED_IMAGE_SERVICE_DATA,
    }

    const session = makeSession('4800')
    session.lastMsgId = legacyMessage.msgId
    session.lastMsgData = { ...legacyMessage }

    await db.msgDatas.put(legacyMessage)
    await db.sessions.put(session)

    await expect(db.repairLegacyServiceMsgDatas()).resolves.toBe(1)

    const repairedMessage = await db.getMsgData(legacyMessage.combo_id)
    expect(repairedMessage?.msgType).toBe(WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE)
    expect(repairedMessage?.fileInfo?.fileUrl).toBe(CAPTURED_IMAGE_URL)
    expect(repairedMessage?.serviceData).toBeUndefined()

    const repairedSession = await db.getSession(session.sessionId, session.sessionType)
    expect(repairedSession?.lastMsgData?.msgType).toBe(WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE)
    expect(repairedSession?.lastMsgData?.fileInfo?.fileUrl).toBe(CAPTURED_IMAGE_URL)
    expect(repairedSession?.lastMsgData?.serviceData).toBeUndefined()

    await expect(db.repairLegacyServiceMsgDatas()).resolves.toBe(0)
  })
})

describe('WeilaDB transactions', () => {
  it('rolls back a failed transaction without leaving a row', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)
    const session = makeSession('4300')

    await expect(
      db.transaction('rw', db.sessions, async () => {
        await db.putSession(session)
        throw new Error('rollback')
      }),
    ).rejects.toThrow('rollback')

    await expect(db.getSession(session.sessionId, session.sessionType)).resolves.toBeUndefined()
  })
})

describe('WeilaDB migration guard', () => {
  it('allows Dexie to patch a same-version schema extension', async () => {
    const userId = nextUserId()
    const partial = new Dexie(`WL_${userId}_DB`)
    partial.version(CURRENT_DB_VERSION).stores({ sessions: 'combo_id_type, status' })
    await partial.open()
    partial.close()

    const db = await openDb(userId, CURRENT_DB_VERSION)
    await db.open()

    expect(db.backendDB().version).toBe(CURRENT_DB_VERSION * 10 + 1)
    const session = makeSession('4500')
    await db.putSession(session)

    await expect(db.getSession(session.sessionId, session.sessionType)).resolves.toEqual(session)
    WeilaDB.close()

    const reopened = await openDb(userId, CURRENT_DB_VERSION)
    await expect(reopened.getSession(session.sessionId, session.sessionType)).resolves.toEqual(
      session,
    )
  })

  it('refuses a newer database before it opens or writes to it', async () => {
    const userId = nextUserId()
    const dbName = `WL_${userId}_DB`
    const newer = new Dexie(dbName)
    newer.version(CURRENT_DB_VERSION + 1).stores({ settings: 'id' })
    await newer.open()
    await newer
      .table('settings')
      .put({ id: WL_IDbSettingID.SETTING_LOGIN_TOKEN, data: 'NEWER-TOKEN' })
    const newerNativeVersion = newer.backendDB().version
    newer.close()

    await expect(WeilaDB.init(userId, CURRENT_DB_VERSION)).rejects.toMatchObject({
      name: 'VersionError',
    })
    expect(() => WeilaDB.getInstance()).toThrow(/Refusing to downgrade/)

    const check = new Dexie(dbName)
    await check.open()
    await expect(check.table('settings').get(WL_IDbSettingID.SETTING_LOGIN_TOKEN)).resolves.toEqual(
      { id: WL_IDbSettingID.SETTING_LOGIN_TOKEN, data: 'NEWER-TOKEN' },
    )
    expect(check.backendDB().version).toBe(newerNativeVersion)
    check.close()
  })

  it('accepts a native version patched past the declared logical version', async () => {
    const userId = nextUserId()
    const dbName = `WL_${userId}_DB`
    const db = await openDb(userId, CURRENT_DB_VERSION)
    const session = makeSession('4600')
    await db.putSession(session)
    WeilaDB.close()

    const bumped = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, CURRENT_DB_VERSION * 10 + 10)

      request.addEventListener('upgradeneeded', () => {
        const transaction = request.transaction

        if (!transaction) {
          reject(new Error('missing upgrade transaction'))

          return
        }

        if (!transaction.db.objectStoreNames.contains('$meta')) {
          transaction.db.createObjectStore('$meta').add(CURRENT_DB_VERSION, 'version')
        }
      })

      request.addEventListener('success', () => resolve(request.result))
      request.addEventListener('error', () => reject(request.error))
    })

    bumped.close()

    const reopened = await openDb(userId, CURRENT_DB_VERSION)
    await expect(reopened.getSession(session.sessionId, session.sessionType)).resolves.toEqual(
      session,
    )
    expect(reopened.backendDB().version).toBe(CURRENT_DB_VERSION * 10 + 10)
  })
})
