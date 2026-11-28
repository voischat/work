import type {
  WL_ExtEventCallback,
  WL_IDbGroupMember,
  WL_IDbMsgData,
  WL_IDbSession,
} from '@vois/weila-sdk-core'
import {
  WL_ExtEventID,
  WL_IDbMsgDataStatus,
  WL_IDbMsgDataType,
  WL_IDbSessionStatus,
} from '@vois/weila-sdk-core'
import { effectScope, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMessageHistory } from './useMessageHistory'

function makeSession(): WL_IDbSession {
  return {
    combo_id_type: '1_1',
    sessionId: '1',
    sessionType: 1,
    sessionName: 'tester',
    sessionAvatar: '',
    readMsgId: 0,
    lastMsgId: 0,
    latestUpdate: 0,
    status: WL_IDbSessionStatus.SESSION_ACTIVATE,
  }
}

function makeMessage(msgId: number): WL_IDbMsgData {
  return {
    combo_id: `1_1_${msgId}`,
    senderId: 7,
    sessionId: '1',
    sessionType: 1,
    msgId,
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE,
    created: msgId,
    autoReply: 0,
    status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_READ,
    textData: `message ${msgId}`,
  }
}

class TestCore {
  public weila_getMsgDatas = async (
    _sessionId: string,
    _sessionType: number,
    cursor: number,
    count: number,
  ): Promise<WL_IDbMsgData[]> => {
    const end = cursor === 0 ? 400 : cursor
    const start = Math.max(1, end - count + 1)

    return Array.from({ length: end - start + 1 }, (_, index) => makeMessage(start + index))
  }

  public weila_getUserInfo = async (_userId: number): Promise<undefined> => undefined
  public weila_getGroupMembers = async (_groupId: string): Promise<WL_IDbGroupMember[]> => []
  public weila_onEvent = (handler: WL_ExtEventCallback): void => {
    handlers.push(handler)
  }

  public weila_offEvent = (): void => {
    void 0
  }
}

const handlers: WL_ExtEventCallback[] = []

describe('useMessageHistory retention', () => {
  afterEach(() => {
    handlers.length = 0
    vi.restoreAllMocks()
  })

  it('keeps the oldest 300 messages while loading older pages', async () => {
    const scope = effectScope()
    const session = makeSession()
    const core = new TestCore()
    let history!: ReturnType<typeof useMessageHistory>

    scope.run(() => {
      history = useMessageHistory(
        () => core,
        () => session,
      )
    })

    await vi.waitFor(() => expect(history.messages.value).toHaveLength(20))

    for (let index = 0; index < 15; index++) await history.loadMore()

    expect(history.messages.value).toHaveLength(300)
    expect(history.messages.value[0]?.msgId).toBe(81)
    expect(history.messages.value.at(-1)?.msgId).toBe(380)

    scope.stop()
  })

  it('keeps the newest 300 messages when a live message arrives', async () => {
    const scope = effectScope()
    const session = makeSession()
    const core = new TestCore()
    let history!: ReturnType<typeof useMessageHistory>

    scope.run(() => {
      history = useMessageHistory(
        () => core,
        () => session,
      )
    })

    await vi.waitFor(() => expect(history.messages.value).toHaveLength(20))

    for (let index = 0; index < 15; index++) await history.loadMore()

    handlers[0]?.(WL_ExtEventID.WL_EXT_NEW_MSG_RECV_IND, makeMessage(401))
    await nextTick()

    await vi.waitFor(() => expect(history.messages.value.at(-1)?.msgId).toBe(401))

    expect(history.messages.value).toHaveLength(300)
    expect(history.messages.value[0]?.msgId).toBe(82)

    scope.stop()
  })

  it('ignores a second loadMore while one is already in flight', async () => {
    const scope = effectScope()
    const session = makeSession()
    const core = new TestCore()
    let history!: ReturnType<typeof useMessageHistory>

    scope.run(() => {
      history = useMessageHistory(
        () => core,
        () => session,
      )
    })

    await vi.waitFor(() => expect(history.messages.value).toHaveLength(20))

    let release!: () => void
    const getMsgDatas = vi.spyOn(core, 'weila_getMsgDatas').mockImplementationOnce(
      () =>
        new Promise<WL_IDbMsgData[]>((resolve) => {
          release = () =>
            resolve(Array.from({ length: 20 }, (_, index) => makeMessage(361 + index)))
        }),
    )

    const first = history.loadMore()
    const second = history.loadMore()

    expect(history.loading.value).toBe(true)
    expect(getMsgDatas).toHaveBeenCalledTimes(1)

    release()
    await Promise.all([first, second])

    expect(history.messages.value).toHaveLength(40)
    expect(getMsgDatas).toHaveBeenCalledTimes(1)

    scope.stop()
  })
})
