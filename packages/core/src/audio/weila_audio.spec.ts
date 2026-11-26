import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WLConfig } from 'main/weila_config'
import { WLAudio } from './weila_audio'
import { WLAudioPlayerEvent, WLPlayerType } from './weila_audio_data'

interface WorkletRequest {
  event: WLAudioPlayerEvent
  data?: { sampleRate?: number }
}

interface WorkletReply {
  playerType: number
  event: WLAudioPlayerEvent
  data: { playerType: number; result: boolean; errorMsg?: string }
}

interface WorkletNodeOptions {
  processorOptions?: { playerType?: number }
}

class FakeMessagePort {
  private listeners: Array<(event: { data: WorkletReply }) => void> = []
  private pending: WorkletReply[] = []
  private started = false
  public playerType = 0

  public addEventListener(type: string, listener: (event: { data: WorkletReply }) => void): void {
    if (type === 'message') this.listeners.push(listener)
  }

  public start(): void {
    this.started = true

    for (const message of this.pending.splice(0)) this.deliver(message)
  }

  public postMessage(message: WorkletRequest): void {
    if (message.event === WLAudioPlayerEvent.WL_WORKLET_NODE_OPEN_REQ) {
      this.enqueue({
        playerType: this.playerType,
        event: WLAudioPlayerEvent.WL_WORKLET_NODE_OPEN_RSP,
        data: { playerType: this.playerType, result: true },
      })
    }
  }

  private enqueue(message: WorkletReply): void {
    if (this.started) this.deliver(message)
    else this.pending.push(message)
  }

  private deliver(message: WorkletReply): void {
    queueMicrotask(() => {
      for (const listener of this.listeners) listener({ data: message })
    })
  }
}

class FakeAudioWorkletNode {
  public port = new FakeMessagePort()

  constructor(_context: BaseAudioContext, _name: string, options?: WorkletNodeOptions) {
    this.port.playerType = options?.processorOptions?.playerType ?? 0
  }
}

class FakeAudioContext {
  public state = 'running'
  public sampleRate = 16000
  public destination = {}
  public audioWorklet = { addModule: vi.fn(async () => {}) }
  public resume = vi.fn(async () => {})
  public close = vi.fn(async () => {})
}

describe('wlaudio worklet message port', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode)
    vi.spyOn(WLConfig, 'getConfigData').mockResolvedValue({
      resource_data: new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
      version: 1,
      latestTime: 0,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts the player port so the open response reaches the SDK', async () => {
    const audio = new WLAudio()

    await audio.init()

    await expect(audio.openPlayer(WLPlayerType.WL_PTT_SINGLE_PLAYER, 16000)).resolves.toBe(true)
  }, 7000)
})
