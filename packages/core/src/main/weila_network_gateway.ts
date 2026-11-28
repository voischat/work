import { WL } from 'proto/weilapb'
import { fsmEvents } from 'fsm/weila_fsm_script'
import type { MainFsmUserEvent } from 'fsm/weila_fsm_script'
import type WeilaPbDispatcher from 'main/weila_pb_dispatcher'
import {
  WL_NetworkEvent,
  WL_NetworkEventID,
  WL_NetworkState,
  WL_PbMsgData,
  WL_PbMsgHandler,
} from 'main/weila_internal_data'

interface WorkerPbMsgData {
  header: WL_PbMsgData['header']
  pbMsgData: ArrayBufferView
}

function isPbMsgData(value: unknown): value is WorkerPbMsgData {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('header' in value) ||
    !('pbMsgData' in value)
  ) {
    return false
  }

  return ArrayBuffer.isView(value.pbMsgData)
}

interface WeilaNetworkGatewayDeps {
  sendToFsm(event: MainFsmUserEvent): void
  dispatcher: WeilaPbDispatcher
  pbMsgHandlers: Map<number, WL_PbMsgHandler>
}

export default class WeilaNetworkGateway {
  constructor(private readonly deps: WeilaNetworkGatewayDeps) {}

  onNetworkMessage(event: { data: WL_NetworkEvent }): void {
    const netEvent = event.data

    switch (netEvent.eventId) {
      case WL_NetworkEventID.NET_STATE_IND_EVT:
        {
          const netState = netEvent.eventData

          if (netState === WL_NetworkState.NET_CONNECTED_STATE) {
            this.deps.sendToFsm({ type: fsmEvents.FSM_NET_CONNECTED_IND_EVT })
          } else if (netState === WL_NetworkState.NET_CONNECTING_STATE) {
            this.deps.sendToFsm({ type: fsmEvents.FSM_NET_CONNECTING_IND_EVT })
          } else if (netState === WL_NetworkState.NET_DISCONNECTED_STATE) {
            this.deps.sendToFsm({ type: fsmEvents.FSM_NET_DISCONNECT_IND_EVT })
            this.deps.dispatcher.rejectAll('网络失去连接')
          }
        }

        break

      case WL_NetworkEventID.NET_MSG_RECV_IND_EVT:
        {
          const msgData = netEvent.eventData

          if (!isPbMsgData(msgData)) break

          const serverMessage = WL.Service.ServiceMessage.decode(
            new Uint8Array(
              msgData.pbMsgData.buffer,
              msgData.pbMsgData.byteOffset,
              msgData.pbMsgData.byteLength,
            ),
          )

          const serviceHead = serverMessage.serviceHead
          const serviceId = serviceHead?.serviceId ?? 0

          if (serviceHead && this.deps.pbMsgHandlers.has(serviceId)) {
            const handler = this.deps.pbMsgHandlers.get(serviceId)

            if (handler) handler(serverMessage)
          }
        }

        break

      case WL_NetworkEventID.NET_EXCEPTION_IND_EVT:
        {
          this.deps.sendToFsm({ type: fsmEvents.FSM_NET_EXCEPTION_IND_EVT })
        }

        break
    }
  }
}
