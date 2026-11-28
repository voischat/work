import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { fsmEvents } from 'fsm/weila_fsm_script'
import { WL_NetworkEventID, type WL_LoginParam } from 'main/weila_internal_data'
import { WL_ExtEventID } from 'main/weila_external_data'
import type { WL_IDbUserInfo } from 'db/weila_db_data'

function testUserInfo(): WL_IDbUserInfo {
  return {
    userId: 42,
    weilaNum: '70009790',
    sex: 0,
    nick: 'qa',
    pinyinName: 'qa',
    avatar: '',
    status: 0,
    userType: 0,
    created: 0,
  }
}

import WeilaMainFsmHost from 'main/weila_main_fsm_host'

function makeDeps() {
  const deps = {
    loadResource: vi.fn(async () => true),
    sendNetworkEvent: vi.fn(),
    sendExtEvent: vi.fn(),
    sendToFsm: vi.fn(),
    setLoginUserInfo: vi.fn(),
    setLoginReady: vi.fn(),
    requestLogout: vi.fn(async () => true),
    checkWaitingTimeouts: vi.fn(),
    maxRetryLoginTimes: 2,
    loginModule: {
      loginReq: vi.fn(async () => testUserInfo()),
      logoutReq: vi.fn(async () => true),
      sendHeartbeat: vi.fn(async () => true),
      refreshToken: vi.fn(async () => true),
      initExtension: vi.fn(async () => true),
    },
    friendModule: { initFriends: vi.fn(async () => true) },
    groupModule: { initGroups: vi.fn(async () => true) },
    businessModule: { initService: vi.fn(async () => true) },
    sessionModule: {
      initSessions: vi.fn(async () => true),
      getSessionList: vi.fn(() => []),
    },
  }

  deps.sendNetworkEvent.mockImplementation((eventId: WL_NetworkEventID) => {
    if (eventId === WL_NetworkEventID.NET_CONNECT_EVT) {
      queueMicrotask(() => {
        deps.sendToFsm({ type: fsmEvents.FSM_NET_CONNECTED_IND_EVT })
      })
    }
  })

  return deps
}

function loginParam(): WL_LoginParam {
  return {
    retryCount: 0,
    account: '70009790',
    password: 'pw',
    countryCode: '0',
    md5: false,
    callback: { resolve: vi.fn(), reject: vi.fn() },
  }
}

async function startActor(deps: ReturnType<typeof makeDeps>) {
  const host = new WeilaMainFsmHost(deps)
  const actor = createActor(host.buildMachine(), { input: { loginParam: null, core: null } })

  deps.sendToFsm.mockImplementation((event: Parameters<typeof actor.send>[0]) => {
    actor.send(event)
  })

  actor.start()

  const resourceCallback = { resolve: vi.fn(), reject: vi.fn() }
  actor.send({ type: fsmEvents.FSM_LOAD_RESOURCE_EVT, data: resourceCallback })

  await vi.waitFor(() => {
    if (!actor.getSnapshot().matches('inited')) throw new Error('not inited yet')
  })

  return { actor, resourceCallback }
}

describe('WeilaMainFsmHost', () => {
  it('loads resources, logs in and reaches ready end to end', async () => {
    const deps = makeDeps()
    const { actor, resourceCallback } = await startActor(deps)

    const param = loginParam()
    actor.send({ type: fsmEvents.FSM_LOGIN_SERVER_EVT, data: param })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().matches('ready')).toBe(true)
    })

    expect(resourceCallback.resolve).toHaveBeenCalledWith(true)
    expect(deps.setLoginUserInfo).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, nick: 'qa' }),
    )
    expect(param.callback.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, nick: 'qa' }),
    )
    expect(deps.setLoginReady).toHaveBeenCalledWith(true)
    expect(deps.friendModule.initFriends).toHaveBeenCalledTimes(1)
    expect(deps.groupModule.initGroups).toHaveBeenCalledTimes(1)
    expect(deps.sessionModule.initSessions).toHaveBeenCalledTimes(1)
    expect(deps.loginModule.initExtension).toHaveBeenCalledTimes(1)
    expect(deps.businessModule.initService).toHaveBeenCalledWith([])

    const prepareInds = deps.sendExtEvent.mock.calls.filter(
      (call) => call[0] === WL_ExtEventID.WL_EXT_DATA_PREPARE_IND,
    )

    expect(prepareInds.length).toBeGreaterThanOrEqual(5)

    actor.stop()
  })

  it('rejects the callback after exhausting login retries', async () => {
    const deps = makeDeps()
    deps.loginModule.loginReq = vi.fn(async () => {
      throw new Error('server down')
    })
    const { actor } = await startActor(deps)

    const param = loginParam()
    actor.send({ type: fsmEvents.FSM_LOGIN_SERVER_EVT, data: param })

    await vi.waitFor(
      () => {
        expect(param.callback.reject).toHaveBeenCalled()
      },
      { timeout: 8000 },
    )

    expect(deps.loginModule.loginReq).toHaveBeenCalledTimes(deps.maxRetryLoginTimes)
    expect(param.callback.reject).toHaveBeenCalledWith(new Error('登陆尝试多次失败'))

    actor.stop()
  })

  it('treats a definitive rejection as final without retry', async () => {
    const deps = makeDeps()
    deps.loginModule.loginReq = vi.fn(async () => {
      throw new Error('RET_CODE:42-MESSAGE:blocked:END')
    })
    const { actor } = await startActor(deps)

    const param = loginParam()
    actor.send({ type: fsmEvents.FSM_LOGIN_SERVER_EVT, data: param })

    await vi.waitFor(
      () => {
        expect(param.callback.reject).toHaveBeenCalled()
      },
      { timeout: 8000 },
    )

    expect(deps.loginModule.loginReq).toHaveBeenCalledTimes(1)
    expect(param.callback.reject).toHaveBeenCalledWith(new Error('RET_CODE:42-MESSAGE:blocked:END'))

    actor.stop()
  })

  it('runs the heartbeat on a timer in ready and stops it after logout', async () => {
    vi.useFakeTimers()
    const deps = makeDeps()
    const { actor } = await startActor(deps)

    const param = loginParam()
    actor.send({ type: fsmEvents.FSM_LOGIN_SERVER_EVT, data: param })

    await vi.advanceTimersByTimeAsync(50)
    expect(actor.getSnapshot().matches('ready')).toBe(true)
    expect(deps.loginModule.sendHeartbeat).toHaveBeenCalledTimes(0)

    await vi.advanceTimersByTimeAsync(59000)
    expect(deps.loginModule.sendHeartbeat).toHaveBeenCalledTimes(1)

    actor.send({ type: fsmEvents.FSM_LOGOUT_EVT })
    await vi.advanceTimersByTimeAsync(120000)
    expect(deps.loginModule.sendHeartbeat).toHaveBeenCalledTimes(1)
    expect(deps.loginModule.logoutReq).toHaveBeenCalledTimes(1)
    expect(deps.setLoginReady).toHaveBeenCalledWith(false)

    actor.stop()
    vi.useRealTimers()
  })
})
