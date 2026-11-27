import {
  WL_NetworkEvent,
  WL_NetworkEventID,
  WL_NetworkState,
  WL_PbMsgData,
} from 'main/weila_internal_data'
import WeilaMsgHeader from 'proto/weilapb_msg_header'
import { getWebsocketAddr } from 'main/weila_utils'

interface WL_WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  postMessage(message: WL_NetworkEvent, options?: StructuredSerializeOptions): void
}

function getWorkerScope(): WL_WorkerScope {
  return {
    addEventListener: (type, listener) => self.addEventListener(type, listener),
    postMessage: (message, options) => self.postMessage(message, options),
  }
}

function isWebsockAddr(value: unknown): value is string {
  return typeof value === 'string'
}

class Network {
  private readonly ctx = getWorkerScope()
  private readonly maxRecvBufSize = 1024 * 1024
  private socket?: WebSocket
  private recvBuffer: Uint8Array
  private currentRecv: number
  private isConnected: boolean
  private sendingPbMsgList: Uint8Array<ArrayBuffer>[]
  private webSockAddr?: string

  constructor() {
    this.recvBuffer = new Uint8Array(this.maxRecvBufSize)
    this.currentRecv = 0
    this.isConnected = false
    this.sendingPbMsgList = []
  }

  public start() {
    this.ctx.addEventListener('message', this.onMessage.bind(this))
  }

  private onSocketOpen(_event: Event): void {
    if (this.socket) {
      let eventData: WL_NetworkState | undefined

      if (this.socket.readyState === WebSocket.CONNECTING) {
        eventData = WL_NetworkState.NET_CONNECTING_STATE
      } else if (this.socket.readyState === WebSocket.OPEN) {
        eventData = WL_NetworkState.NET_CONNECTED_STATE
        this.isConnected = true

        setTimeout(this.processSending.bind(this), 0)
      }

      const netEvent: WL_NetworkEvent = {
        eventId: WL_NetworkEventID.NET_STATE_IND_EVT,
        eventData,
      }

      this.ctx.postMessage(netEvent, { transfer: [] })
    }
  }

  private onSocketRecv(event: MessageEvent): void {
    if (this.currentRecv < this.maxRecvBufSize) {
      const recvData = new Uint8Array(event.data)

      if (recvData.length > 0) {
        this.recvBuffer.set(recvData, this.currentRecv)
        this.currentRecv += recvData.length

        while (this.currentRecv >= WeilaMsgHeader.msgHeaderLen) {
          const weilaHeader = WeilaMsgHeader.parseFromBuffer(this.recvBuffer)

          if (weilaHeader) {
            const headerValue = weilaHeader.getValue()

            if (this.currentRecv >= headerValue.length) {
              const wlMsgData: WL_PbMsgData = {
                header: headerValue,
                pbMsgData: this.recvBuffer.slice(WeilaMsgHeader.msgHeaderLen, headerValue.length),
              }

              this.recvBuffer.copyWithin(0, headerValue.length, this.currentRecv)
              this.currentRecv -= headerValue.length

              const netEvent: WL_NetworkEvent = {
                eventId: WL_NetworkEventID.NET_MSG_RECV_IND_EVT,
                eventData: wlMsgData,
              }

              this.ctx.postMessage(netEvent, { transfer: [] })
            } else {
              break
            }
          }
        }
      }
    }
  }

  private onSocketClose(_event: CloseEvent): void {
    if (this.socket) {
      this.socket = undefined
    }

    const netEvent: WL_NetworkEvent = {
      eventId: WL_NetworkEventID.NET_STATE_IND_EVT,
      eventData: WL_NetworkState.NET_DISCONNECTED_STATE,
    }

    this.isConnected = false
    this.ctx.postMessage(netEvent, { transfer: [] })
  }

  private disconnect(code: number, reason?: string) {
    if (this.socket) {
      const netEvent: WL_NetworkEvent = {
        eventId: WL_NetworkEventID.NET_STATE_IND_EVT,
        eventData: WL_NetworkState.NET_DISCONNECTING_STATE,
      }

      this.ctx.postMessage(netEvent, { transfer: [] })

      this.socket.close(code, reason || 'normal close')
      this.socket = undefined
      this.isConnected = false

      this.sendingPbMsgList = []
    }
  }

  private onSocketError(event: Event): void {
    this.disconnect(3000, JSON.stringify(event))

    const netEvent: WL_NetworkEvent = {
      eventId: WL_NetworkEventID.NET_EXCEPTION_IND_EVT,
      eventData: JSON.stringify(event),
    }

    this.isConnected = false
    this.ctx.postMessage(netEvent, { transfer: [] })
  }

  private connect() {
    try {
      if (this.socket === undefined) {
        this.socket = new WebSocket(this.webSockAddr ? this.webSockAddr : getWebsocketAddr())

        this.socket.binaryType = 'arraybuffer'
        this.socket.addEventListener('open', this.onSocketOpen.bind(this))
        this.socket.addEventListener('message', this.onSocketRecv.bind(this))
        this.socket.addEventListener('close', this.onSocketClose.bind(this))
        this.socket.addEventListener('error', this.onSocketError.bind(this))
      }
    } catch (e) {
      this.socket = undefined

      const netEvent: WL_NetworkEvent = {
        eventId: WL_NetworkEventID.NET_EXCEPTION_IND_EVT,
        eventData: e,
      }

      this.isConnected = false
      this.ctx.postMessage(netEvent, { transfer: [] })
    }
  }

  private processSending(): void {
    const socket = this.socket

    if (!this.isConnected || !socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    const data = this.sendingPbMsgList.shift()

    if (data !== undefined) {
      socket.send(data)
      setTimeout(this.processSending.bind(this), 0)
    }
  }

  private onMessage(event: MessageEvent): void {
    const netEvent: WL_NetworkEvent = event.data

    switch (netEvent.eventId) {
      case WL_NetworkEventID.NET_WEBSOCK_ADDR_SET_EVT:
        {
          const addr = netEvent.eventData
          this.webSockAddr = isWebsockAddr(addr) ? addr : undefined
        }

        break

      case WL_NetworkEventID.NET_CONNECT_EVT:
        {
          this.connect()
        }

        break

      case WL_NetworkEventID.NET_DISCONNECT_EVT:
        {
          this.disconnect(1000, '正常断网')
        }

        break

      case WL_NetworkEventID.NET_SEND_DATA_EVT:
        {
          const payload = netEvent.eventData
          const bytes = payload instanceof Uint8Array ? new Uint8Array(payload) : new Uint8Array()
          this.sendingPbMsgList.push(bytes)
          setTimeout(this.processSending.bind(this), 0)
        }

        break
    }
  }
}

const network = new Network()

network.start()
