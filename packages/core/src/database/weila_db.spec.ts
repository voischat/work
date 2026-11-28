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
  WL_ServiceStatus,
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

const VIDEO_SERVICE_DATA = JSON.stringify({
  service_type: 'video',
  content: {
    url: 'https://cdn.example.com/clip.mp4',
    thumb: 'https://cdn.example.com/clip.jpg',
    name: 'clip.mp4',
    size: 2048,
  },
})

const QRCODE_SERVICE_DATA = JSON.stringify({
  service_type: 'qrcode',
  content: {
    url: 'https://cdn.example.com/qr.png',
    name: 'My Card',
    desc: 'Scan me',
    session_id: '80001922',
    session_type: 1,
  },
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

interface LegacyServiceRow {
  combo_id: string
  senderId: number
  sessionId: string
  sessionType: number
  msgId: number
  msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE
  created: number
  autoReply: number
  status: WL_IDbMsgDataStatus
  serviceData: string
}

function makeLegacyServiceMessage(
  sessionId: string,
  msgId: number,
  serviceData: string,
): LegacyServiceRow {
  return {
    combo_id: `${sessionId}_${WL.Common.SessionType.SESSION_TYPE_SINGLE}_${msgId}`,
    senderId: 7,
    sessionId,
    sessionType: WL.Common.SessionType.SESSION_TYPE_SINGLE,
    msgId,
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
    created: 2000 + msgId,
    autoReply: 0,
    status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_READ,
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
    expect(messages[0]).toMatchObject({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE,
      fileInfo: { fileUrl: CAPTURED_IMAGE_URL },
    })
    expect(messages[0]).not.toHaveProperty('serviceData')
  })

  it('converts a video service message into a video message', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)

    const messages = db.convertFromMsgDataRaws([makeServiceRaw('4750', 25, VIDEO_SERVICE_DATA)], 7)

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE,
      fileInfo: {
        fileUrl: 'https://cdn.example.com/clip.mp4',
        fileThumbnail: 'https://cdn.example.com/clip.jpg',
        fileName: 'clip.mp4',
        fileSize: 2048,
      },
    })
    expect(messages[0]).not.toHaveProperty('serviceData')
  })

  it('migrates a legacy service session extra into the serviceSession key', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)

    const session = makeSession('5001')
    session.combo_id_type = `5001_${WL.Common.SessionType.SESSION_TYPE_SERVICE}`
    session.sessionType = WL.Common.SessionType.SESSION_TYPE_SERVICE
    session.extra = {
      serviceId: 9,
      customerId: 7,
      staffIds: [7, 8],
      serviceStatus: WL_ServiceStatus.SERVICE_STATUS_FINISH,
      createdTime: 100,
      updatedTime: 200,
    }

    await db.sessions.put(session)

    await expect(db.migrateServiceSessionExtra()).resolves.toBe(1)

    const migrated = await db.getSession(session.sessionId, session.sessionType)
    expect(migrated?.extra).toEqual({
      serviceSession: {
        serviceId: 9,
        customerId: 7,
        staffIds: [7, 8],
        serviceStatus: WL_ServiceStatus.SERVICE_STATUS_FINISH,
        createdTime: 100,
        updatedTime: 200,
      },
    })

    await expect(db.migrateServiceSessionExtra()).resolves.toBe(0)
  })

  it('leaves non-service and already-migrated session extras alone', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)

    const plain = makeSession('5002')
    plain.extra = { memberCount: 5 }

    const migrated = makeSession('5003')
    migrated.combo_id_type = `5003_${WL.Common.SessionType.SESSION_TYPE_SERVICE}`
    migrated.sessionType = WL.Common.SessionType.SESSION_TYPE_SERVICE
    migrated.extra = {
      serviceSession: {
        serviceId: 9,
        customerId: 7,
        staffIds: [7],
        serviceStatus: WL_ServiceStatus.SERVICE_STATUS_FINISH,
        createdTime: 100,
        updatedTime: 200,
      },
    }

    await db.sessions.bulkPut([plain, migrated])

    await expect(db.migrateServiceSessionExtra()).resolves.toBe(0)

    const unchangedPlain = await db.getSession(plain.sessionId, plain.sessionType)
    expect(unchangedPlain?.extra).toEqual({ memberCount: 5 })

    const unchangedMigrated = await db.getSession(migrated.sessionId, migrated.sessionType)
    expect(unchangedMigrated?.extra).toEqual(migrated.extra)
  })

  it('repairs service messages already stored as legacy rows', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)

    const legacyMessage: LegacyServiceRow = {
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

    await db.table<LegacyServiceRow, string>('msgDatas').put(legacyMessage)
    await db
      .table<Omit<WL_IDbSession, 'lastMsgData'> & { lastMsgData: LegacyServiceRow }, string>(
        'sessions',
      )
      .put({ ...session, lastMsgData: { ...legacyMessage } })

    await expect(db.repairLegacyServiceMsgDatas()).resolves.toBe(1)

    const repairedMessage = await db.getMsgData(legacyMessage.combo_id)
    expect(repairedMessage).toMatchObject({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE,
      fileInfo: { fileUrl: CAPTURED_IMAGE_URL },
    })
    expect(repairedMessage).not.toHaveProperty('serviceData')

    const repairedSession = await db.getSession(session.sessionId, session.sessionType)
    expect(repairedSession?.lastMsgData).toMatchObject({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE,
      fileInfo: { fileUrl: CAPTURED_IMAGE_URL },
    })
    expect(repairedSession?.lastMsgData).not.toHaveProperty('serviceData')

    await expect(db.repairLegacyServiceMsgDatas()).resolves.toBe(0)
  })

  it('repairs legacy video and qrcode rows in one pass', async () => {
    const db = await openDb(nextUserId(), CURRENT_DB_VERSION)

    const legacyVideo = makeLegacyServiceMessage('4810', 31, VIDEO_SERVICE_DATA)
    const legacyQrcode = makeLegacyServiceMessage('4810', 32, QRCODE_SERVICE_DATA)

    await db.table<LegacyServiceRow, string>('msgDatas').bulkPut([legacyVideo, legacyQrcode])

    await expect(db.repairLegacyServiceMsgDatas()).resolves.toBe(2)

    const repairedVideo = await db.getMsgData(legacyVideo.combo_id)
    expect(repairedVideo).toMatchObject({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE,
      fileInfo: {
        fileUrl: 'https://cdn.example.com/clip.mp4',
        fileThumbnail: 'https://cdn.example.com/clip.jpg',
        fileName: 'clip.mp4',
        fileSize: 2048,
      },
    })
    expect(repairedVideo).not.toHaveProperty('serviceData')

    const repairedQrcode = await db.getMsgData(legacyQrcode.combo_id)
    expect(repairedQrcode).toMatchObject({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
      servicePayload: {
        type: 'qrcode',
        url: 'https://cdn.example.com/qr.png',
        name: 'My Card',
        desc: 'Scan me',
        sessionId: '80001922',
        sessionType: 1,
      },
    })
    expect(repairedQrcode).not.toHaveProperty('serviceData')

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
