/* oxlint-disable import/default -- worklet-inline-loader emits these as URL strings */
import PlayerWorklet from './weila_player.worklet.js'
import RecorderWorklet from './weila_recorder.worklet.js'
/* oxlint-enable import/default */

import {
  WLAudioEvent,
  WLAudioPlayerEvent,
  WLAudioRecorderEvent,
  WLPlayerType,
} from './weila_audio_data'
import CompoUint8Array from './weila_compositor_array'
import { WL_ConfigID, WLConfig } from 'main/weila_config'
import { TinyEmitter } from 'tiny-emitter'
import { createLogger } from 'log/weila_log'
import type { WL_AudioEventPayload } from 'audio/weila_audio_data'

const log = createLogger('AUDIO:core')

interface WLAudioCallback<Result> {
  resolve(value: Result): void
  reject?(reason: Error): void
  waitRspTimer: ReturnType<typeof setTimeout> | null
}

type WLAudioPendingCallback =
  | { kind: 'result'; callback: WLAudioCallback<boolean> }
  | { kind: 'frames'; callback: WLAudioCallback<number> }

interface WLEventCallback {
  (event: WLAudioEvent, data: WL_AudioEventPayload): void
}

interface WorkletPlayerRequest {
  sampleRate: number
}

interface WorkletRecorderRequest {
  sampleRate: number
  bitRate: number
}

interface WorkletRspData {
  result?: boolean
  errorMsg?: string
  frames?: number
  data?: Uint8Array | number[]
}

interface WorkletMessageData {
  event: WLAudioPlayerEvent | WLAudioRecorderEvent
  playerType?: WLPlayerType
  data?: WorkletRspData
}

const defaulSampleRate = 16000

enum WLPlayerState {
  WL_PLAYER_OPENING,
  WL_PLAYER_STOPPED,
  WL_PLAYER_STARTING,
  WL_PLAYER_STARTED,
  WL_PLAYER_STOPPING,
  WL_PLAYER_PAUSING,
  WL_PLAYER_PAUSED,
  WL_PLAYER_RESUMING,
  WL_PLAYER_CLOSING,
  WL_PLAYER_CLOSED,
}

enum WLRecorderState {
  WL_RECORDER_OPENING,
  WL_RECORDER_STOPPED,
  WL_RECORDER_STARTING,
  WL_RECORDER_STARTED,
  WL_RECORDER_STOPPING,
  WL_RECORDER_CLOSING,
  WL_RECORDER_CLOSED,
}

const wl_playerName = ['stream ptt', 'history ptt', 'single ptt']

const playRequestTimeoutState: Partial<Record<WLAudioPlayerEvent, WLPlayerState>> = {
  [WLAudioPlayerEvent.WL_WORKLET_NODE_OPEN_REQ]: WLPlayerState.WL_PLAYER_CLOSED,
  [WLAudioPlayerEvent.WL_WORKLET_NODE_START_REQ]: WLPlayerState.WL_PLAYER_STOPPED,
  [WLAudioPlayerEvent.WL_WORKLET_NODE_PAUSE_REQ]: WLPlayerState.WL_PLAYER_STARTED,
  [WLAudioPlayerEvent.WL_WORKLET_NODE_RESUME_REQ]: WLPlayerState.WL_PLAYER_PAUSED,
  [WLAudioPlayerEvent.WL_WORKLET_NODE_STOP_REQ]: WLPlayerState.WL_PLAYER_STOPPED,
  [WLAudioPlayerEvent.WL_WORKLET_NODE_CLOSE_REQ]: WLPlayerState.WL_PLAYER_CLOSED,
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function stopMediaStreamTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop())
}

function playerEventKey(playerType: number, event: WLAudioPlayerEvent): string {
  return `${playerType}:${event}`
}

function recorderEventKey(event: WLAudioRecorderEvent): string {
  return `recorder:${event}`
}

class WLAudio {
  private audioContext: AudioContext | null
  private playerWorkNode: (AudioWorkletNode | null)[]
  private recorderWorkNode: AudioWorkletNode | null
  private playerSource: (AudioBufferSourceNode | null)[]
  private sendingEventListMap: Map<string, WLAudioPendingCallback>
  private micMedia: MediaStream | null
  private micSource: MediaStreamAudioSourceNode | null
  private emitter: TinyEmitter
  private playSampleRate: number[]
  private playState: WLPlayerState[]
  private recordState: WLRecorderState
  private isInited: boolean

  constructor() {
    this.audioContext = null
    this.playerWorkNode = [null, null, null]
    this.recorderWorkNode = null
    this.playerSource = [null, null, null]
    this.sendingEventListMap = new Map()
    this.micMedia = null
    this.micSource = null
    this.emitter = new TinyEmitter()
    this.playSampleRate = [16000, 16000, 16000]
    this.playState = [
      WLPlayerState.WL_PLAYER_CLOSED,
      WLPlayerState.WL_PLAYER_CLOSED,
      WLPlayerState.WL_PLAYER_CLOSED,
    ]
    this.recordState = WLRecorderState.WL_RECORDER_CLOSED
    this.isInited = false
  }

  private requireAudioContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error('audio context is not initialized')
    }

    return this.audioContext
  }

  private requirePlayerWorkNode(playerType: WLPlayerType): AudioWorkletNode {
    const node = this.playerWorkNode[playerType]

    if (!node) {
      throw new Error('player worklet node is not initialized: ' + playerType)
    }

    return node
  }

  public async init(): Promise<boolean> {
    if (this.isInited && this.audioContext) {
      const state = this.audioContext.state

      if (state === 'running') {
        return true
      }

      if (state === 'suspended') {
        await this.audioContext.resume()

        return this.audioContext.state === 'running'
      }

      this.isInited = false
      this.audioContext = null
      this.playerWorkNode = [null, null, null]
      this.playerSource = [null, null, null]
      this.recorderWorkNode = null
    }

    if (!this.isInited) {
      const audioContext = new AudioContext({ sampleRate: defaulSampleRate })

      if (audioContext.state !== 'running') {
        await audioContext.resume()
      }

      log.info('audioContext:', audioContext)
      log.info('audioContext audioWorklet is :', audioContext.audioWorklet)

      try {
        await audioContext.audioWorklet.addModule(PlayerWorklet)
        await audioContext.audioWorklet.addModule(RecorderWorklet)
      } catch (error) {
        await audioContext.close().catch(() => {})
        throw error
      }

      this.audioContext = audioContext
      this.isInited = true
    }

    return true
  }

  public onAudioEvent(callback: WLEventCallback): void {
    this.emitter.on('event', callback)
  }

  public addAudioEventListener(callback: WLEventCallback): void {
    this.emitter.on('event', callback)
  }

  public removeAudioEventListener(callback: WLEventCallback): void {
    this.emitter.off('event', callback)
  }

  private sendAudioEvent(event: WLAudioEvent, data: WL_AudioEventPayload): void {
    this.emitter.emit('event', event, data)
  }

  private replyPlayRequest(
    playerType: number,
    rspEvent: WLAudioPlayerEvent,
    data: WorkletMessageData['data'],
  ): void {
    log.info('响应请求事件:%d, 数据:%O', rspEvent, data)
    const key = playerEventKey(playerType, rspEvent)
    const pending = this.sendingEventListMap.get(key)

    if (!pending || pending.kind !== 'result') {
      return
    }

    this.sendingEventListMap.delete(key)

    const callback = pending.callback

    if (callback.waitRspTimer) {
      clearTimeout(callback.waitRspTimer)
      callback.waitRspTimer = null
    }

    if (data?.result) {
      callback.resolve(true)
    } else if (callback.reject) {
      callback.reject(new Error(data?.errorMsg))
    }
  }

  private onPlayerMessage(event: { data: WorkletMessageData }): void {
    const ev = event.data
    log.info('播放器%d 处理事件:%d 数据:%O', ev.playerType, ev.event, ev.data)

    switch (ev.event) {
      case WLAudioPlayerEvent.WL_WORKLET_NODE_OPEN_RSP:
        {
          if (ev.playerType !== undefined) {
            const playerType = ev.playerType

            this.replyPlayRequest(playerType, ev.event, ev.data)

            if (this.playState[playerType] === WLPlayerState.WL_PLAYER_OPENING) {
              this.playState[playerType] = ev.data?.result
                ? WLPlayerState.WL_PLAYER_STOPPED
                : WLPlayerState.WL_PLAYER_CLOSED
            }
          }
        }

        break

      case WLAudioPlayerEvent.WL_WORKLET_NODE_STOP_RSP:
      case WLAudioPlayerEvent.WL_WORKLET_NODE_CLOSE_RSP:
      case WLAudioPlayerEvent.WL_WORKLET_NODE_PAUSE_RSP:
        {
          const playerType = ev.playerType ?? 0

          if (ev.playerType !== undefined) {
            if (ev.event === WLAudioPlayerEvent.WL_WORKLET_NODE_PAUSE_RSP) {
              this.playState[ev.playerType] = WLPlayerState.WL_PLAYER_PAUSED
            } else if (ev.event === WLAudioPlayerEvent.WL_WORKLET_NODE_STOP_RSP) {
              this.playState[ev.playerType] = WLPlayerState.WL_PLAYER_STOPPED
            } else {
              this.playState[ev.playerType] = WLPlayerState.WL_PLAYER_CLOSED
            }

            this.stopAudioSource(ev.playerType)
          }

          this.replyPlayRequest(playerType, ev.event, ev.data)
        }

        break

      case WLAudioPlayerEvent.WL_WORKLET_NODE_START_RSP:
      case WLAudioPlayerEvent.WL_WORKLET_NODE_RESUME_RSP:
        {
          const playerType = ev.playerType ?? 0

          if (ev.playerType !== undefined) {
            this.playState[ev.playerType] = WLPlayerState.WL_PLAYER_STARTED
          }

          this.replyPlayRequest(playerType, ev.event, ev.data)
        }

        break

      case WLAudioPlayerEvent.WL_WORKLET_NODE_FINISH_PLAY:
        {
          if (ev.playerType !== undefined) {
            this.sendAudioEvent(WLAudioEvent.WL_AUDIO_FINISH_PLAY_IND, ev.playerType)
          }
        }

        break

      case WLAudioPlayerEvent.WL_WORKLET_NODE_POS_RSP:
        {
          const key = playerEventKey(ev.playerType ?? 0, ev.event)
          const pending = this.sendingEventListMap.get(key)

          if (pending && pending.kind === 'frames') {
            this.sendingEventListMap.delete(key)

            const callback = pending.callback

            if (callback.waitRspTimer) {
              clearTimeout(callback.waitRspTimer)
              callback.waitRspTimer = null
            }

            callback.resolve(ev.data?.frames ?? 0)
          }
        }

        break
    }
  }

  private sendPlayerEvent(
    playerType: WLPlayerType,
    event: WLAudioPlayerEvent,
    data: WorkletPlayerRequest | null,
  ): void {
    const node = this.playerWorkNode[playerType]

    if (node) {
      log.info('发送播放器事件:', event)
      node.port.postMessage({ event: event, data: data })
    }
  }

  public async openPlayer(playerType: WLPlayerType, sampleRate: number): Promise<boolean> {
    log.info('打开播放器:%d 采样率:%d', playerType, sampleRate)

    if (this.playState[playerType] !== WLPlayerState.WL_PLAYER_CLOSED) {
      return Promise.reject(new Error('播放器状态不正确:' + this.playState))
    }

    try {
      if (this.playerWorkNode[playerType] === null) {
        const configData = await WLConfig.getConfigData(WL_ConfigID.WL_RES_DATA_OPUS_WASM_ID)

        if (!configData) {
          throw new Error('获取 opus wasm 配置失败')
        }

        const node = new AudioWorkletNode(this.requireAudioContext(), 'weila_player_processor', {
          channelCount: 2,
          processorOptions: {
            wasmData: configData.resource_data,
            workerName: wl_playerName[playerType],
            playerType: playerType,
          },
        })

        this.playerWorkNode[playerType] = node
        node.port.addEventListener('message', this.onPlayerMessage.bind(this))
        node.port.start()
      }

      this.playSampleRate[playerType] = sampleRate
      this.playState[playerType] = WLPlayerState.WL_PLAYER_OPENING
    } catch (e) {
      this.playState[playerType] = WLPlayerState.WL_PLAYER_CLOSED

      return Promise.reject(e)
    }

    return new Promise<boolean>((resolve, reject) => {
      const key = playerEventKey(playerType, WLAudioPlayerEvent.WL_WORKLET_NODE_OPEN_RSP)

      this.sendPlayerEvent(playerType, WLAudioPlayerEvent.WL_WORKLET_NODE_OPEN_REQ, {
        sampleRate: sampleRate,
      })
      const callback: WLAudioCallback<boolean> = { resolve, reject, waitRspTimer: null }
      callback.waitRspTimer = setTimeout(
        (cb) => {
          if (cb.reject) {
            this.playState[playerType] = WLPlayerState.WL_PLAYER_CLOSED
            this.sendingEventListMap.delete(key)
            cb.reject(new Error('请求超时 1'))
          }
        },
        5000,
        callback,
      )
      this.sendingEventListMap.set(key, { kind: 'result', callback })
    })
  }

  private playOperation(
    playerType: WLPlayerType,
    reqEvent: WLAudioPlayerEvent,
    rspEvent: WLAudioPlayerEvent,
    data: WorkletPlayerRequest | null,
  ): Promise<boolean> {
    log.info('播放器 %d 操作事件%d', playerType, reqEvent)

    return new Promise<boolean>((resolve, reject) => {
      const key = playerEventKey(playerType, rspEvent)

      this.sendPlayerEvent(playerType, reqEvent, data)

      if (this.playerWorkNode[playerType]) {
        const callback: WLAudioCallback<boolean> = { resolve, reject, waitRspTimer: null }
        callback.waitRspTimer = setTimeout(
          (cb) => {
            if (cb.reject) {
              this.playState[playerType] = playRequestTimeoutState[reqEvent]!
              this.sendingEventListMap.delete(key)
              cb.reject(new Error('请求超时'))
            }
          },
          5000,
          callback,
        )
        this.sendingEventListMap.set(key, { kind: 'result', callback })
      }
    })
  }

  private startAudioSource(playerType: WLPlayerType): void {
    if (this.playerSource[playerType] === null) {
      const audioContext = this.requireAudioContext()
      const audioBuffer = audioContext.createBuffer(1, 16000, this.playSampleRate[playerType])
      const source = audioContext.createBufferSource()
      this.playerSource[playerType] = source
      source.buffer = audioBuffer
      source.loop = true
      const playerNode = this.requirePlayerWorkNode(playerType)
      source.connect(playerNode)
      playerNode.connect(audioContext.destination)
      source.start()
    }
  }

  private stopAudioSource(playerType: WLPlayerType): void {
    const source = this.playerSource[playerType]

    if (source) {
      source.stop()
      source.disconnect()
      this.requirePlayerWorkNode(playerType).disconnect()
      source.buffer = null
      this.playerSource[playerType] = null
    }
  }

  public startPlay(playerType: WLPlayerType): Promise<boolean> {
    log.info('播放器:%d 开始播放:', playerType)

    if (this.playState[playerType] !== WLPlayerState.WL_PLAYER_STOPPED) {
      return Promise.reject(new Error('播放器状态不正确:' + this.playState[playerType]))
    }

    this.startAudioSource(playerType)
    this.playState[playerType] = WLPlayerState.WL_PLAYER_STARTING

    return this.playOperation(
      playerType,
      WLAudioPlayerEvent.WL_WORKLET_NODE_START_REQ,
      WLAudioPlayerEvent.WL_WORKLET_NODE_START_RSP,
      null,
    )
  }

  public pausePlay(playerType: WLPlayerType): Promise<boolean> {
    log.info('播放器:%d 暂停播放', playerType)

    if (this.playState[playerType] !== WLPlayerState.WL_PLAYER_STARTED) {
      return Promise.reject(new Error('播放器状态不正确:' + this.playState[playerType]))
    }

    this.playState[playerType] = WLPlayerState.WL_PLAYER_PAUSING

    return this.playOperation(
      playerType,
      WLAudioPlayerEvent.WL_WORKLET_NODE_PAUSE_REQ,
      WLAudioPlayerEvent.WL_WORKLET_NODE_PAUSE_RSP,
      null,
    )
  }

  public resumePlay(playerType: WLPlayerType): Promise<boolean> {
    log.info('播放器:%d 恢复播放', playerType)

    if (this.playState[playerType] !== WLPlayerState.WL_PLAYER_PAUSED) {
      return Promise.reject(new Error('播放器状态不正确:' + this.playState[playerType]))
    }

    this.startAudioSource(playerType)
    this.playState[playerType] = WLPlayerState.WL_PLAYER_RESUMING

    return this.playOperation(
      playerType,
      WLAudioPlayerEvent.WL_WORKLET_NODE_RESUME_REQ,
      WLAudioPlayerEvent.WL_WORKLET_NODE_RESUME_RSP,
      null,
    )
  }

  public stopPlay(playerType: WLPlayerType): Promise<boolean> {
    log.info('播放器:%d 停止播放', playerType)

    if (
      this.playState[playerType] !== WLPlayerState.WL_PLAYER_STARTING &&
      this.playState[playerType] !== WLPlayerState.WL_PLAYER_STARTED &&
      this.playState[playerType] !== WLPlayerState.WL_PLAYER_PAUSING &&
      this.playState[playerType] !== WLPlayerState.WL_PLAYER_PAUSED &&
      this.playState[playerType] !== WLPlayerState.WL_PLAYER_RESUMING
    ) {
      return Promise.reject(new Error('播放器状态不正确:' + this.playState[playerType]))
    }

    this.playState[playerType] = WLPlayerState.WL_PLAYER_STOPPING

    return this.playOperation(
      playerType,
      WLAudioPlayerEvent.WL_WORKLET_NODE_STOP_REQ,
      WLAudioPlayerEvent.WL_WORKLET_NODE_STOP_RSP,
      null,
    )
  }

  public isPlayerPaused(playerType: WLPlayerType): boolean {
    return this.playState[playerType] === WLPlayerState.WL_PLAYER_PAUSED
  }

  public isPlayerStarted(playerType: WLPlayerType): boolean {
    return this.playState[playerType] === WLPlayerState.WL_PLAYER_STARTED
  }

  public closePlayer(playerType: WLPlayerType): Promise<boolean> {
    log.info('播放器:%d 关闭播放器', playerType)

    if (
      this.playState[playerType] === WLPlayerState.WL_PLAYER_CLOSED ||
      this.playState[playerType] === WLPlayerState.WL_PLAYER_CLOSING
    ) {
      return Promise.reject(new Error('播放器状态不正确:' + this.playState))
    }

    this.playState[playerType] = WLPlayerState.WL_PLAYER_CLOSING

    return this.playOperation(
      playerType,
      WLAudioPlayerEvent.WL_WORKLET_NODE_CLOSE_REQ,
      WLAudioPlayerEvent.WL_WORKLET_NODE_CLOSE_RSP,
      null,
    )
  }

  public putPlayerOpusData(playerType: WLPlayerType, opusData: Uint8Array[] | null): void {
    if (opusData) {
      const compoArray = new CompoUint8Array()
      compoArray.putArrays(opusData)

      const compoBuffer = compoArray.getCompoArray()
      this.requirePlayerWorkNode(playerType).port.postMessage(
        {
          event: WLAudioPlayerEvent.WL_WORKLET_NODE_PUT_DATA,
          data: { buffer: compoBuffer, lengthList: compoArray.getCompoLengthList() },
        },
        [compoBuffer!.buffer],
      )
    } else {
      log.info('播放器:%d 播放最后一帧', playerType)
      this.sendPlayerEvent(playerType, WLAudioPlayerEvent.WL_WORKLET_NODE_END_DATA, null)
    }
  }

  public async getPlayerPlayedMs(playerType: WLPlayerType): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const key = playerEventKey(playerType, WLAudioPlayerEvent.WL_WORKLET_NODE_POS_RSP)

      this.sendPlayerEvent(playerType, WLAudioPlayerEvent.WL_WORKLET_NODE_POS_REQ, null)

      const callback: WLAudioCallback<number> = { resolve, reject, waitRspTimer: null }
      callback.waitRspTimer = setTimeout(
        (cb) => {
          if (cb.reject) {
            this.sendingEventListMap.delete(key)
            cb.reject(new Error('查询播放进度超时'))
          }
        },
        2000,
        callback,
      )
      this.sendingEventListMap.set(key, { kind: 'frames', callback })
    }).then((frames) => {
      return Math.round((frames / this.playSampleRate[playerType]) * 1000)
    })
  }

  private sendRecorderEvent(
    event: WLAudioRecorderEvent,
    data: WorkletRecorderRequest | null,
  ): void {
    log.info('发送录音器事件%d', event)

    if (this.recorderWorkNode) {
      this.recorderWorkNode.port.postMessage({ event: event, data: data })
    }
  }

  private replyRecordRequest(
    rspEvent: WLAudioRecorderEvent,
    data: WorkletMessageData['data'],
  ): void {
    log.info('回复录音器请求%d', rspEvent)
    const key = recorderEventKey(rspEvent)
    const pending = this.sendingEventListMap.get(key)

    if (!pending || pending.kind !== 'result') {
      return
    }

    this.sendingEventListMap.delete(key)

    const callback = pending.callback

    if (data?.result) {
      callback.resolve(true)
    } else if (callback.reject) {
      callback.reject(new Error(data?.errorMsg))
    }
  }

  private onRecorderMessage(event: { data: WorkletMessageData }): void {
    const ev = event.data
    log.info('录音器事件处理%d', ev.event)

    switch (ev.event) {
      case WLAudioRecorderEvent.WL_WORKLET_NODE_START_RSP:
      case WLAudioRecorderEvent.WL_WORKLET_NODE_OPEN_RSP:
        {
          if (ev.event === WLAudioRecorderEvent.WL_WORKLET_NODE_OPEN_RSP) {
            if (this.recordState === WLRecorderState.WL_RECORDER_OPENING) {
              this.recordState = WLRecorderState.WL_RECORDER_STOPPED
            }
          } else {
            this.recordState = WLRecorderState.WL_RECORDER_STARTED
          }

          this.replyRecordRequest(ev.event, ev.data)
        }

        break

      case WLAudioRecorderEvent.WL_WORKLET_NODE_STOP_RSP:
        {
          this.recordState = WLRecorderState.WL_RECORDER_STOPPED

          if (this.recorderWorkNode && this.micSource) {
            this.recorderWorkNode.disconnect()
            this.micSource.disconnect()
          }

          this.replyRecordRequest(ev.event, ev.data)
        }

        break

      case WLAudioRecorderEvent.WL_WORKLET_NODE_CLOSE_RSP:
        {
          this.recordState = WLRecorderState.WL_RECORDER_CLOSED

          if (this.micSource) {
            this.micSource.disconnect()
            this.micSource = null
          }

          if (this.micMedia) {
            stopMediaStreamTracks(this.micMedia)
            this.micMedia = null
          }

          const recorderWorkNode = this.recorderWorkNode

          if (!recorderWorkNode) {
            throw new Error('recorder worklet node is not initialized')
          }

          recorderWorkNode.disconnect()
          this.replyRecordRequest(ev.event, ev.data)
        }

        break

      case WLAudioRecorderEvent.WL_WORKLET_NODE_DATA_IND:
        {
          const coded = ev.data?.data

          if (coded instanceof Uint8Array || Array.isArray(coded)) {
            this.sendAudioEvent(WLAudioEvent.WL_AUDIO_OPUS_CODED_DATA_IND, new Uint8Array(coded))
          }
        }

        break
    }
  }

  public async openRecorder(sampleRate: number, bitRate: number): Promise<boolean> {
    log.info('开启录音器, 采样率:%d 位宽:%d', sampleRate, bitRate)

    if (this.recordState !== WLRecorderState.WL_RECORDER_CLOSED) {
      log.error('openRecorder error:', new Error('录音器状态不正确:' + this.playState))

      return Promise.reject(new Error('录音器状态不正确:' + this.playState))
    }

    try {
      log.info('浏览器:' + navigator.userAgent)

      if (this.recorderWorkNode === null) {
        const configData = await WLConfig.getConfigData(WL_ConfigID.WL_RES_DATA_OPUS_WASM_ID)

        if (!configData) {
          throw new Error('获取 opus wasm 配置失败')
        }

        const node = new AudioWorkletNode(this.requireAudioContext(), 'weila_recorder_processor', {
          processorOptions: { wasmData: configData.resource_data },
        })

        this.recorderWorkNode = node
        node.port.addEventListener('message', this.onRecorderMessage.bind(this))
        node.port.start()
      }

      this.recordState = WLRecorderState.WL_RECORDER_OPENING
    } catch (e) {
      log.error('openRecorder error:', e)
      this.recordState = WLRecorderState.WL_RECORDER_CLOSED

      return Promise.reject(e)
    }

    let mediaPromise: Promise<MediaStream> | undefined
    let mediaStream: MediaStream

    try {
      mediaPromise = navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStream = await withTimeout(mediaPromise, 10_000, '打开麦克风超时')
    } catch (error) {
      log.error('getUserMedia', error)

      if (mediaPromise) {
        void mediaPromise
          .then((stream) => {
            stopMediaStreamTracks(stream)
          })
          .catch(() => {})
      }

      void this.closeRecorder()
      throw error
    }

    this.micMedia = mediaStream
    this.micSource = this.requireAudioContext().createMediaStreamSource(this.micMedia)
    this.sendRecorderEvent(WLAudioRecorderEvent.WL_WORKLET_NODE_OPEN_REQ, {
      sampleRate: sampleRate,
      bitRate: bitRate,
    })

    return new Promise<boolean>((resolve, reject) => {
      const key = recorderEventKey(WLAudioRecorderEvent.WL_WORKLET_NODE_OPEN_RSP)

      const callback: WLAudioCallback<boolean> = { resolve, reject, waitRspTimer: null }
      callback.waitRspTimer = setTimeout(
        (cb) => {
          if (cb.reject) {
            this.recordState = WLRecorderState.WL_RECORDER_CLOSED
            this.sendingEventListMap.delete(key)
            cb.reject(new Error('请求超时'))
          }
        },
        5000,
        callback,
      )
      this.sendingEventListMap.set(key, { kind: 'result', callback })
    })
  }

  private recordOperation(
    reqEvent: WLAudioRecorderEvent,
    rspEvent: WLAudioRecorderEvent,
    data: WorkletRecorderRequest | null,
  ): Promise<boolean> {
    log.info('录音器操作:%d', reqEvent)

    return new Promise<boolean>((resolve, reject) => {
      this.sendRecorderEvent(reqEvent, data)

      if (this.recorderWorkNode) {
        const key = recorderEventKey(rspEvent)
        const callback: WLAudioCallback<boolean> = { resolve, reject, waitRspTimer: null }
        callback.waitRspTimer = setTimeout(
          (cb) => {
            if (cb.reject) {
              this.sendingEventListMap.delete(key)
              cb.reject(new Error('请求超时'))
            }
          },
          5000,
          callback,
        )
        this.sendingEventListMap.set(key, { kind: 'result', callback })
      }
    })
  }

  public startRecord(): Promise<boolean> {
    log.info('开始录音')

    if (this.recordState !== WLRecorderState.WL_RECORDER_STOPPED) {
      return Promise.reject(new Error('录音器状态不正确:' + this.playState))
    }

    if (this.micSource && this.recorderWorkNode) {
      this.micSource.connect(this.recorderWorkNode)
      this.recorderWorkNode.connect(this.requireAudioContext().destination)
    }

    this.recordState = WLRecorderState.WL_RECORDER_STARTING

    return this.recordOperation(
      WLAudioRecorderEvent.WL_WORKLET_NODE_START_REQ,
      WLAudioRecorderEvent.WL_WORKLET_NODE_START_RSP,
      null,
    )
  }

  public stopRecord(): Promise<boolean> {
    log.info('停止录音')

    if (
      this.recordState !== WLRecorderState.WL_RECORDER_STARTING &&
      this.recordState !== WLRecorderState.WL_RECORDER_STARTED
    ) {
      return Promise.reject(new Error('录音器状态不正确:' + this.playState))
    }

    this.recordState = WLRecorderState.WL_RECORDER_STOPPING

    return this.recordOperation(
      WLAudioRecorderEvent.WL_WORKLET_NODE_STOP_REQ,
      WLAudioRecorderEvent.WL_WORKLET_NODE_STOP_RSP,
      null,
    )
  }

  public closeRecorder(): Promise<boolean> {
    log.info('关闭录音器')

    if (
      this.recordState === WLRecorderState.WL_RECORDER_CLOSING ||
      this.recordState === WLRecorderState.WL_RECORDER_CLOSED
    ) {
      return Promise.reject(new Error('录音器状态不正确:' + this.playState))
    }

    this.recordState = WLRecorderState.WL_RECORDER_CLOSING

    return this.recordOperation(
      WLAudioRecorderEvent.WL_WORKLET_NODE_CLOSE_REQ,
      WLAudioRecorderEvent.WL_WORKLET_NODE_CLOSE_RSP,
      null,
    )
  }
}

export { WLAudio }
