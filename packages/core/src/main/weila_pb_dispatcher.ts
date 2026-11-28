import { createLogger } from 'log/weila_log'
import { getPbResultCodeMessage } from 'main/weila_utils'
import { dbEnum } from 'db/db_enum'
import { WL } from 'proto/weilapb'
import type { WLBuildMsgRet } from 'proto/weilapb_wrapper_data'
import { WL_PbMsgData, WL_PbMsgResponse } from 'main/weila_internal_data'

const log = createLogger('CORE')

interface WL_WaitingRspPbMsgInfo<Response extends WL_PbMsgResponse = WL_PbMsgResponse> {
  resolve(value: Response): void
  reject(reason: Error): void
  pbMsgData: WL_PbMsgData
  timeout: number
}

interface WL_SendingPbMsgInfo<Response extends WL_PbMsgResponse = WL_PbMsgResponse> {
  resolve(value: Response): void
  reject(reason: Error): void
  buildPbMsg: WLBuildMsgRet
  timeout?: number
}

export default class WeilaPbDispatcher {
  private readonly waitingRspMap = new Map<number, WL_WaitingRspPbMsgInfo>()
  private readonly sendingPbMsgList: WL_SendingPbMsgInfo[] = []

  constructor(private readonly sendNetworkData: (reqData: WLBuildMsgRet['reqData']) => void) {}

  sendPbMsg<T extends WL_PbMsgResponse = WL_PbMsgResponse>(
    buildPbMsg: WLBuildMsgRet,
    timeout?: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const sendingItem: WL_SendingPbMsgInfo<T> = {
        resolve,
        reject,
        buildPbMsg,
        timeout: timeout ? timeout : 6000,
      }

      this.sendingPbMsgList.push(sendingItem)
      setTimeout(this.processSendingPbMsg.bind(this), 0)
    })
  }

  rspPbMsg(seq: number, resultCode: number, data: WL_PbMsgResponse): void {
    if (this.waitingRspMap.has(seq)) {
      const sendingItem = this.waitingRspMap.get(seq)
      this.waitingRspMap.delete(seq)

      if (sendingItem) {
        if (resultCode === 0) {
          sendingItem.resolve(data)
        } else {
          let errorMessage = 'RET_CODE:' + resultCode + '-MESSAGE:'
          const msg = getPbResultCodeMessage(dbEnum<WL.Service.ResultCode>(resultCode))
          errorMessage += msg ? msg : '未知错误码'
          errorMessage += ':END'
          sendingItem.reject(new Error(errorMessage))
        }
      }
    }
  }

  rejectAll(reason: string): void {
    for (const key of this.waitingRspMap.keys()) {
      const waitingRsp = this.waitingRspMap.get(key)

      if (waitingRsp) {
        waitingRsp.reject(new Error(reason))
        this.waitingRspMap.delete(key)
      }
    }
  }

  checkTimeouts(): void {
    if (this.waitingRspMap.size === 0) return

    log.info('--------->onSysTimeChecking', this.waitingRspMap.size)

    const timeoutKeyList: number[] = []

    const now = new Date().getTime()

    this.waitingRspMap.forEach((value, key) => {
      log.info('checkSendingMsgItemTimeout:', value.timeout, now)

      if (value.timeout <= now) {
        timeoutKeyList.push(key)
      }
    })

    timeoutKeyList.forEach((key) => {
      const waitingPbMsg = this.waitingRspMap.get(key)

      if (waitingPbMsg) {
        waitingPbMsg.reject(new Error('消息超时'))
        this.waitingRspMap.delete(key)
      }
    })
  }

  private processSendingPbMsg(): void {
    log.info('处理PB消息，队列有%d个等待发送消息', this.sendingPbMsgList.length)

    if (this.sendingPbMsgList.length > 0) {
      const sendingItem = this.sendingPbMsgList.shift()!
      const weilaMsgHeader = sendingItem.buildPbMsg.weilaMsgHeader

      if (!weilaMsgHeader) return

      const waitingItem: WL_WaitingRspPbMsgInfo = {
        resolve: (value) => sendingItem.resolve(value),
        reject: (reason) => sendingItem.reject(reason),
        pbMsgData: {
          header: weilaMsgHeader,
          pbMsgData: sendingItem.buildPbMsg.reqData,
        },
        timeout: new Date().getTime() + (sendingItem.timeout ?? 0),
      }

      this.waitingRspMap.set(weilaMsgHeader.seqNum, waitingItem)
      this.sendNetworkData(sendingItem.buildPbMsg.reqData)
    }

    if (this.sendingPbMsgList.length > 0) {
      setTimeout(this.processSendingPbMsg.bind(this), 0)
    }
  }
}
