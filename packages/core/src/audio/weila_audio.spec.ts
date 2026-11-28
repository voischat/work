import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WLConfig } from 'main/weila_config'
import { WLAudio } from './weila_audio'
import { WLAudioPlayerEvent, WLAudioRecorderEvent, WLPlayerType } from './weila_audio_data'

interface WorkletRequest {
  event: WLAudioPlayerEvent | WLAudioRecorderEvent
  data?: { sampleRate?: number }
}

interface WorkletReply {
  playerType?: number
  event: WLAudioPlayerEvent | WLAudioRecorderEvent
  data: { playerType?: number; result: boolean; errorMsg?: string }
}

interface WorkletNodeOptions {
  processorOptions?: { playerType?: number }
}

class FakeMessagePort {
  private listeners: Array<(event: { data: WorkletReply }) => void> = []
  private pending: WorkletReply[] = []
  private started = false
  public playerType = 0
  public isRecorder = false

  public addEventListener(type: string, listener: (event: { data: WorkletReply }) => void): void {
    if (type === 'message') this.listeners.push(listener)
  }

  public start(): void {
    this.started = true

    for (const message of this.pending.splice(0)) this.deliver(message)
  }

  public postMessage(message: WorkletRequest): void {
    if (this.isRecorder) {
      if (message.event === WLAudioRecorderEvent.WL_WORKLET_NODE_OPEN_REQ) {
        this.enqueue({
          event: WLAudioRecorderEvent.WL_WORKLET_NODE_OPEN_RSP,
          data: { result: true },
        })
      } else if (message.event === WLAudioRecorderEvent.WL_WORKLET_NODE_CLOSE_REQ) {
        this.enqueue({
          event: WLAudioRecorderEvent.WL_WORKLET_NODE_CLOSE_RSP,
          data: { result: true },
        })
      }

      return
    }

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
  public disconnect = vi.fn()

  constructor(_context: BaseAudioContext, name: string, options?: WorkletNodeOptions) {
    this.port.playerType = options?.processorOptions?.playerType ?? 0
    this.port.isRecorder = name === 'weila_recorder_processor'
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []

  public state = 'running'
  public sampleRate = 16000
  public destination = {}
  public audioWorklet = { addModule: vi.fn(async () => {}) }
  public resume = vi.fn(async () => {
    this.state = 'running'
  })
  public close = vi.fn(async () => {})
  public createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }))

  constructor() {
    FakeAudioContext.instances.push(this)
  }
}

function fakeStream(stop: () => void) {
  const track: Pick<MediaStreamTrack, 'stop'> = { stop }

  return { getTracks: () => [track] }
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
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts the player port so the open response reaches the SDK', async () => {
    const audio = new WLAudio()

    await audio.init()

    await expect(audio.openPlayer(WLPlayerType.WL_PTT_SINGLE_PLAYER, 16000)).resolves.toBe(true)
  }, 7000)

  it('keeps concurrent player responses separate', async () => {
    const audio = new WLAudio()

    await audio.init()

    await expect(
      Promise.all([
        audio.openPlayer(WLPlayerType.WL_PTT_SINGLE_PLAYER, 16000),
        audio.openPlayer(WLPlayerType.WL_PTT_STREAM_PLAYER, 16000),
      ]),
    ).resolves.toEqual([true, true])
  }, 7000)

  it('resumes a suspended context instead of reporting it ready', async () => {
    const audio = new WLAudio()

    await audio.init()

    const context = FakeAudioContext.instances.at(-1)

    if (!context) throw new Error('audio context was not created')

    context.state = 'suspended'

    await expect(audio.init()).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalled()
  }, 7000)

  it('stops microphone tracks when the recorder closes', async () => {
    const stop = vi.fn()
    const stream = fakeStream(stop)
    const getUserMedia = vi.fn(async () => stream)

    vi.stubGlobal('navigator', {
      userAgent: 'test',
      mediaDevices: { getUserMedia },
    })

    const audio = new WLAudio()

    await audio.init()
    await expect(audio.openRecorder(16000, 20000)).resolves.toBe(true)
    await expect(audio.closeRecorder()).resolves.toBe(true)

    expect(stop).toHaveBeenCalledTimes(1)
  }, 7000)

  it('stops a microphone stream that resolves after the open timeout', async () => {
    vi.useFakeTimers()

    const stop = vi.fn()
    const stream = fakeStream(stop)

    let resolveMedia!: (value: ReturnType<typeof fakeStream>) => void

    const mediaPromise = new Promise<ReturnType<typeof fakeStream>>((resolve) => {
      resolveMedia = resolve
    })

    vi.stubGlobal('navigator', {
      userAgent: 'test',
      mediaDevices: { getUserMedia: () => mediaPromise },
    })

    const audio = new WLAudio()

    await audio.init()

    const opening = audio.openRecorder(16000, 20000)
    const rejection = expect(opening).rejects.toThrow('打开麦克风超时')

    await vi.advanceTimersByTimeAsync(10_000)

    await rejection

    resolveMedia(stream)
    await vi.advanceTimersByTimeAsync(0)

    expect(stop).toHaveBeenCalledTimes(1)
  }, 7000)
})
