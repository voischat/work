import 'fake-indexeddb/auto'
import type { WL_IDbMsgData } from './weila_db_data'
import { afterEach, describe, expect, it } from 'vitest'
import { WeilaDB } from './weila_db'
import { WL_IDbMsgDataStatus, WL_IDbMsgDataType } from './weila_db_data'

const SESSION_ID = '9001'
const SESSION_TYPE = 18
const TOTAL = 10_000
const SESSIONS = 100
const RUNS = 20

function makeMessage(msgId: number, sessionId: string): WL_IDbMsgData {
  return {
    combo_id: `${sessionId}_${SESSION_TYPE}_${msgId}`,
    senderId: 7,
    sessionId,
    sessionType: SESSION_TYPE,
    msgId,
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE,
    created: msgId,
    autoReply: 0,
    status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_READ,
    textData: `message ${msgId}`,
  }
}

function percentile(samples: number[], ratio: number): number {
  const sorted = samples.toSorted((left, right) => left - right)

  return sorted[Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))] ?? 0
}

function report(label: string, samples: number[]): void {
  const max = samples.reduce((value, sample) => Math.max(value, sample), 0)

  process.stdout.write(
    `${label}: p50=${percentile(samples, 0.5).toFixed(2)}ms p95=${percentile(samples, 0.95).toFixed(2)}ms max=${max.toFixed(2)}ms\n`,
  )
}

describe.skipIf(!process.env.WEILA_DB_BENCH)('WeilaDB message history benchmark', () => {
  afterEach(() => {
    WeilaDB.close()
  })

  it('measures the session history scan', async () => {
    await WeilaDB.init('bench-user', 3)
    const db = WeilaDB.getInstance()
    const rows: WL_IDbMsgData[] = []

    for (let index = 0; index < TOTAL; index++) {
      const sessionId = String(9000 + (index % SESSIONS))
      rows.push(makeMessage(index + 1, sessionId))
    }

    await db.putMsgDatas(rows)

    const target = rows.filter((row) => row.sessionId === SESSION_ID)
    const lastMsgId = target.at(-1)?.msgId ?? 0
    const scanSamples: number[] = []
    const lastSamples: number[] = []

    for (let index = 0; index < RUNS; index++) {
      const scanStart = performance.now()
      await db.getMsgDatasWithRange(SESSION_ID, SESSION_TYPE, lastMsgId, 20)
      scanSamples.push(performance.now() - scanStart)

      const lastStart = performance.now()
      await db.getLastMsgDatas(SESSION_ID, SESSION_TYPE, 20)
      lastSamples.push(performance.now() - lastStart)
    }

    process.stdout.write(
      `total=${TOTAL} sessions=${SESSIONS} target=${target.length} runs=${RUNS}\n`,
    )
    report('getMsgDatasWithRange', scanSamples)
    report('getLastMsgDatas', lastSamples)

    expect(scanSamples).toHaveLength(RUNS)
  }, 60_000)
})
