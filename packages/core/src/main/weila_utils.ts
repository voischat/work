import { WL } from 'proto/weilapb'
import { createLogger } from 'log/weila_log'
import { WL_PttPayload } from 'main/weila_internal_data'
import { WL_IDbAudioData, WL_IDbMsgData } from 'db/weila_db_data'
import { WL_PttPackType } from 'main/weila_internal_data'
import type { WL_PttPacket } from 'main/weila_internal_data'
import { dbEnum } from 'db/db_enum'

const log = createLogger('UTIL')
const OPUS_FRAME_DURATION_SEC = 0.02

async function fetchWithTimeout(
  input: RequestInfo,
  init?: RequestInit,
  timeout?: number,
): Promise<Response> {
  const controller = new AbortController()
  const signal = controller.signal
  let timerId: ReturnType<typeof setTimeout> | undefined
  const localInit: RequestInit = init ?? {}
  localInit.signal = signal

  log.info('fetch url:', input)

  const timeoutPromise = (localTimeout: number) => {
    return new Promise<Response>((resolve, _reject) => {
      timerId = setTimeout(() => {
        log.error('获取URL:%s超时', input)
        resolve(new Response('timeout', { status: 504, statusText: 'timeout' }))
        controller.abort()
      }, localTimeout)
    })
  }

  const fetchPromise = () => {
    return new Promise<Response>((resolve, reject) => {
      log.info('输入URL', input)
      fetch(input, localInit)
        .then((value) => {
          clearTimeout(timerId)
          resolve(value)
        })
        .catch((reason) => {
          log.error('获取失败', reason)
          reject(reason)
        })
    })
  }

  return Promise.race<Response>([timeoutPromise(timeout ? timeout : 30000), fetchPromise()])
}

const RESULT_CODE_MESSAGES: Partial<Record<WL.Service.ResultCode, string>> = {
  [WL.Service.ResultCode.RESULT_SUCCESS]: '成功',
  [WL.Service.ResultCode.RESULT_FAILURE]: '失败',
  [WL.Service.ResultCode.RESULT_DISCONNECT]: '连接中断',
  [WL.Service.ResultCode.RESULT_NO_MSG_SERVER]: '未连接消息服务器',
  [WL.Service.ResultCode.RESULT_NO_DB_SERVER]: '未连接数据服务器',
  [WL.Service.ResultCode.RESULT_NO_CACHE_SERVER]: '未连接缓存服务器',
  [WL.Service.ResultCode.RESULT_NO_LOGIN_SERVER]: '未连接登录服务器',
  [WL.Service.ResultCode.RESULT_NO_ROUTE_SERVER]: '未连接路由服务器',
  [WL.Service.ResultCode.RESULT_DB_EXCEPTION]: '数据库异常',
  [WL.Service.ResultCode.RESULT_CACHE_EXCEPTION]: '缓存异常',
  [WL.Service.ResultCode.RESULT_SERVER_MAINTENANCE]: '服务器维护中',
  [WL.Service.ResultCode.RESULT_SERVER_EXCEPTION]: '服务器异常',
  [WL.Service.ResultCode.RESULT_PARAM_INVALID]: '参数错误',
  [WL.Service.ResultCode.RESULT_REQUEST_NOT_SUPPORT]: '请求不支持',
  [WL.Service.ResultCode.RESULT_REQUEST_LIMITED]: '请求受限',
  [WL.Service.ResultCode.RESULT_REQUEST_INVALID]: '请求已过期',
  [WL.Service.ResultCode.RESULT_VERSION_TOO_OLD]: 'APP版本太旧,需要更新',
  [WL.Service.ResultCode.RESULT_BLACKLIST_LIMITED]: '您已被拉黑',
  [WL.Service.ResultCode.RESULT_AUTH_INVALID]: '认证无效',
  [WL.Service.ResultCode.RESULT_PERMIT_LIMITED]: '权限受限',
  [WL.Service.ResultCode.RESULT_DATA_NOT_EXIST]: '数据不存在',
  [WL.Service.ResultCode.RESULT_DATA_INVALID]: '数据无效',
  [WL.Service.ResultCode.RESULT_VERIFICATION_CODE_ERROR]: '验证码错误',
  [WL.Service.ResultCode.RESULT_TOKEN_INVALID]: '授权失效',
  [WL.Service.ResultCode.RESULT_REQUEST_FREQUENTLY]: '请求太频繁',
  [WL.Service.ResultCode.RESULT_NUMBER_RESOURCE_USE_UP]: '号码资源耗尽',
  [WL.Service.ResultCode.RESULT_REQUEST_TIMEOUT]: '请求超时',
  [WL.Service.ResultCode.RESULT_TRANSMIT_TIMEOUT]: '网络传输超时',
  [WL.Service.ResultCode.RESULT_APP_ILLEGAL]: '应用未授权,请从官方渠道获取',
  [WL.Service.ResultCode.RESULT_PHONE_DUPLICATE]: '手机号已被使用',
  [WL.Service.ResultCode.RESULT_PHONE_INVALID]: '手机号无效',
  [WL.Service.ResultCode.RESULT_PHONE_HAS_BEEN_BANNED]: '手机号被封禁',
  [WL.Service.ResultCode.RESULT_PASSWORD_ERROR]: '密码错误',
  [WL.Service.ResultCode.RESULT_SEND_VERIFICATION_CODE_FAIL]: '发送验证码失败',
  [WL.Service.ResultCode.RESULT_LOGIN_FORBID_IP]:
    '用户IP被封 从forbidDuration获取剩余时长(设备不再自动登录)',
  [WL.Service.ResultCode.RESULT_LOGIN_FORBID_USER]:
    '用户被封号 从forbidDuration获取剩余时长(设备不再自动登录)',
  [WL.Service.ResultCode.RESULT_LOGIN_PASSWORD_ERROR_TOO_TIMES]:
    '密码输入错误次数太多,请待系统解封后再试(默认30分钟后才可登录) 从forbidDuration获取剩余时长(设备不再自动登录)',
  [WL.Service.ResultCode.RESULT_LOGIN_SYSTEM_FULL]: '在线用户达到系统容量',
  [WL.Service.ResultCode.RESULT_LOGIN_VERIFYCODE_INVALID]: '验证码无效',
  [WL.Service.ResultCode.RESULT_LOGIN_ACCOUNT_OR_PASSWD_ERROR]: '账号或密码错误(设备不再自动登录)',
  [WL.Service.ResultCode.RESULT_LOGIN_EXTENSION_HAS_BIND]: '用户已绑定设备',
  [WL.Service.ResultCode.RESULT_LOGIN_EXTENSION_BINDING]: '设备绑定中',
  [WL.Service.ResultCode.RESULT_LOGIN_EXTENSION_NOT_BIND]: '未绑定分机',
  [WL.Service.ResultCode.RESULT_LOGIN_EXTENSION_LAWLESSNESS]: '非法设备(设备不再自动登录)',
  [WL.Service.ResultCode.RESULT_LOGIN_EXTENSION_LICENSE_LIMITED]: '许可证用完(设备不再自动登录)',
  [WL.Service.ResultCode.RESULT_LOGIN_EXTENSION_ACCOUNT_ERROR]: '设备账号错误(设备不再自动登录)',
  [WL.Service.ResultCode.RESULT_LOGIN_EXTENSION_PASSWORD_ERROR]: '设备密码错误(设备不再自动登录)',
  [WL.Service.ResultCode.RESULT_LOGIN_EXTENSION_OFFLINE]: '设备不在线',
  [WL.Service.ResultCode.RESULT_USER_NOT_EXIST]: '用户不存在',
  [WL.Service.ResultCode.RESULT_USER_PERIPHERAL_UNAUTHORIZED]: '外设未授权',
  [WL.Service.ResultCode.RESULT_USER_PERIPHERAL_REPLICATED]: '外设被复制',
  [WL.Service.ResultCode.RESULT_USER_PERIPHERAL_MULTIDEVICE]: '外设在多设备上使用',
  [WL.Service.ResultCode.RESULT_USER_OFFLINE]: '用户不在线',
  [WL.Service.ResultCode.RESULT_FRIEND_NOT_FRIEND]: '不是好友',
  [WL.Service.ResultCode.RESULT_FRIEND_INVITE_NOT_EXIST]: '好友邀请已过期',
  [WL.Service.ResultCode.RESULT_FRIEND_IS_BLACKLIST]: '您已被对方加入黑名单  ',
  [WL.Service.ResultCode.RESULT_FRIEND_SHIELD_OPEN]: '好友已开启消息屏蔽   ',
  [WL.Service.ResultCode.RESULT_GROUP_NOT_EXIST]: '群组不存在',
  [WL.Service.ResultCode.RESULT_GROUP_ACCESS_LIMITED]: '访问受限,请明天再试(被踢或被封)',
  [WL.Service.ResultCode.RESULT_GROUP_YOU_ARE_NOT_OWNER]: '您不是群主',
  [WL.Service.ResultCode.RESULT_GROUP_YOU_ARE_NOT_ADMIN]: '您不是群管理员',
  [WL.Service.ResultCode.RESULT_GROUP_MEMBERS_FULL]: '成员数达到上限',
  [WL.Service.ResultCode.RESULT_GROUP_NUMBER_USEUP]: '群组号耗尽',
  [WL.Service.ResultCode.RESULT_GROUP_BROADCAST_EXIST]: '群组广播已存在',
  [WL.Service.ResultCode.RESULT_GROUP_BROADCAST_NOEXIST]: '群组广播不存在',
  [WL.Service.ResultCode.RESULT_GROUP_PASSWORD_ERROR]: '群密码错误',
  [WL.Service.ResultCode.RESULT_GROUP_OWNER_FULL]: '您创建的群组数达到上限',
  [WL.Service.ResultCode.RESULT_GROUP_BURST_OCCUPY]: '话权被占用',
  [WL.Service.ResultCode.RESULT_GROUP_USER_NOT_MEMBER]: '用户不是群成员',
  [WL.Service.ResultCode.RESULT_GROUP_MEMBER_LIMIT_MAX]: '群成员上限达到最大值',
  [WL.Service.ResultCode.RESULT_GROUP_MEMBER_IS_ADMIN]: '不能对管理员进行操作',
  [WL.Service.ResultCode.RESULT_GROUP_USER_IN_BLACKLIST]: '用户被加入群黑名单',
  [WL.Service.ResultCode.RESULT_GROUP_OWNER_CANNOT_EXIT]: '群主不能退群,请先转让群主或直接删除群',
  [WL.Service.ResultCode.RESULT_GROUP_YOU_ARE_SHUTUP]: '你已被禁言',
  [WL.Service.ResultCode.RESULT_GROUP_MEMBER_SHUTUP]: '群成员被禁言',
  [WL.Service.ResultCode.RESULT_GROUP_MEMBER_IS_OWNER]: '不能对群主进行操作',
  [WL.Service.ResultCode.RESULT_GROUP_BURST_REVOKE]: '话权被回收',
  [WL.Service.ResultCode.RESULT_GROUP_MEMBER_IS_EXTENSION]: '不能对设备用户进行操作',
  [WL.Service.ResultCode.RESULT_GROUP_COUNT_LIMIT]: '加群数量达到上限',
  [WL.Service.ResultCode.RESULT_GROUP_MEMBER_HAS_EXTENSION]: '成员中存在设备用户',
  [WL.Service.ResultCode.RESULT_GROUP_OWNER_CANNOT_EXTENSION]: '群主不能是设备用户',
  [WL.Service.ResultCode.RESULT_SESSION_BURST_MONITOR]: '设备正在被其他人监听,请稍后再试',
  [WL.Service.ResultCode.RESULT_ROOM_HAS_EXIST]: '房间已存在',
  [WL.Service.ResultCode.RESULT_ROOM_NOT_EXIST]: '房间不存在',
  [WL.Service.ResultCode.RESULT_ROOM_LOCK]: '房间处于锁定状态',
  [WL.Service.ResultCode.RESULT_ROOM_SPEAKING]: '有人在讲话',
  [WL.Service.ResultCode.RESULT_ROOM_CHANGE_CHARGE_LIMITED]: '房间未锁定或有访客不允许修改计费',
  [WL.Service.ResultCode.RESULT_ROOM_HONORED_GUEST_PERMIT]: '只有嘉宾才允许当前操作',
  [WL.Service.ResultCode.RESULT_ROOM_NOT_ENTRY]: '用户未进入房间',
  [WL.Service.ResultCode.RESULT_ROOM_YOU_ARE_HONORED_GUEST]: '您已经是嘉宾',
  [WL.Service.ResultCode.RESULT_ROOM_HONORED_GUEST_FULL]: '嘉宾数量达到上限',
  [WL.Service.ResultCode.RESULT_BUSINESS_SERVICE_CLOSED]: '服务已关闭',
  [WL.Service.ResultCode.RESULT_BUSINESS_STAFF_INVALID]: '不是客服号',
  [WL.Service.ResultCode.RESULT_BUSINESS_STAFF_NOT_ONLINE]: '客服不在线',
  [WL.Service.ResultCode.RESULT_BUSINESS_STAFF_BUSY]: '客服忙',
}

function getPbResultCodeMessage(resultCode: WL.Service.ResultCode): string {
  const msg = RESULT_CODE_MESSAGES[resultCode] ?? ''

  log.info('resultCode:', resultCode, 'msg:', msg)

  return msg
}

function getResultCodeFromError(errorMsg: string): number {
  const pattern = /RET_CODE:(.*)-MESSAGE:/i
  const result = errorMsg.match(pattern)

  if (result && result.length > 1) {
    return parseInt(result[1])
  }

  return -1
}

function getErrorMsg(errorMsg: string): string {
  const retCode = getResultCodeFromError(errorMsg)

  if (retCode !== -1) {
    return getPbResultCodeMessage(dbEnum<WL.Service.ResultCode>(retCode))
  }

  return errorMsg
}

/* oxlint-disable anti-slop/no-object-parameters, anti-slop/no-unknown-parameters -- method decorators receive the class prototype and the decorated function's own this/args, which only the decorated method can type */
function AsyncTime(notShow?: boolean) {
  return (_target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value

    if (!notShow) {
      descriptor.value = async function (this: unknown, ...args: unknown[]) {
        console.time(propertyKey)

        try {
          const ret = await method.apply(this, args)
          console.timeEnd(propertyKey)

          return ret
        } catch (e) {
          log.error(propertyKey, e)
          console.timeEnd(propertyKey)

          return Promise.reject(e)
        }
      }
    }
  }
}

/* oxlint-enable anti-slop/no-object-parameters, anti-slop/no-unknown-parameters */
/* oxlint-disable anti-slop/no-object-parameters, anti-slop/no-unknown-parameters -- same decorator boundary as AsyncTime */
function SyncTime(notShow?: boolean) {
  return (_target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value

    if (!notShow) {
      descriptor.value = function (this: unknown, ...args: unknown[]) {
        console.time(propertyKey)
        const ret = method.apply(this, args)
        console.timeEnd(propertyKey)

        return ret
      }
    }
  }
}

interface AppAuthInfo {
  appId: string | undefined
  appKey: string | undefined
}

/* oxlint-enable anti-slop/no-object-parameters, anti-slop/no-unknown-parameters */
function getAppKeyAndId(): AppAuthInfo {
  return {
    appId: process.env.APPID,
    appKey: process.env.APPKEY,
  }
}

interface WL_PttPackState {
  curMarker: WL_PttPackType
  seqOfPackage: number
  seq: number
}

interface WL_PttPackResult {
  packet: WL_PttPacket
  nextState: WL_PttPackState
}

function packPttPacket(
  frames: Uint8Array[],
  state: WL_PttPackState,
  lastPacket: boolean,
): WL_PttPackResult {
  let totalLen = 0
  const wlOpusList: Uint8Array[] = []

  for (const opusRawData of frames) {
    const wlOpusData = new Uint8Array(opusRawData.length + 4)
    const flag = opusRawData[0]
    let currentLen = 0

    wlOpusData[0] = flag

    if (flag & 0x80) {
      const wlOpusDataView = new DataView(wlOpusData.buffer)
      wlOpusDataView.setUint16(1, opusRawData.length - 1, false)
      wlOpusData.set(opusRawData.subarray(1), 3)
      totalLen += opusRawData.length + 2
      currentLen = opusRawData.length + 2
    } else {
      wlOpusData[1] = opusRawData.length - 1
      wlOpusData.set(opusRawData.subarray(1), 2)
      totalLen += opusRawData.length + 1
      currentLen = opusRawData.length + 1
    }

    wlOpusList.push(wlOpusData.subarray(0, currentLen))
  }

  const data = new Uint8Array(totalLen)
  let offset = 0

  for (const value of wlOpusList) {
    data.set(value, offset)
    offset += value.length
  }

  let mark = state.curMarker

  if (lastPacket) {
    mark =
      state.curMarker === WL_PttPackType.PTT_FIRST_PACK
        ? WL_PttPackType.PTT_WHOLE_PACK
        : WL_PttPackType.PTT_END_PACK
  }

  return {
    packet: {
      mark,
      data,
      sourceType: 5,
      frameCount: wlOpusList.length,
      seq: state.seq,
      seqInPackage: state.seqOfPackage,
    },
    nextState: {
      curMarker: lastPacket ? WL_PttPackType.PTT_END_PACK : WL_PttPackType.PTT_INTER_PACK,
      seqOfPackage: state.seqOfPackage + 1,
      seq: state.seq,
    },
  }
}

function getWebsocketAddr(): string {
  return process.env.WSS ?? ''
}

async function fetchAudioDataFromUrl(url: string): Promise<WL_IDbAudioData | undefined> {
  const audioData: WL_IDbAudioData = { frameCount: 0 }

  try {
    const result = await fetchWithTimeout(url, { method: 'GET', mode: 'cors' }, 5000)

    if (result.ok) {
      const data = await result.arrayBuffer()
      audioData.data = new Uint8Array(data.slice(10))
      audioData.frameCount = calculateOpusDataFrame(audioData.data)

      return audioData
    }

    log.error('获取音频数据失败 HTTP:%d 地址:%s', result.status, url)
  } catch (e) {
    log.error('获取数据异常', e)
  }

  return undefined
}

function decompositionAudioData(pttData: Uint8Array): WL_PttPayload[] {
  let offset = 0
  let sizeOfOpusData = 0
  const codedDataList: WL_PttPayload[] = []

  let frames = 0,
    prevFrames = 0

  let prevOffset = 0

  while (offset < pttData.length) {
    const flag = pttData[offset]
    offset += 1

    if (flag & 0x80) {
      const dataView = new DataView(pttData.buffer, pttData.byteOffset)
      sizeOfOpusData = dataView.getUint16(offset, false) + 1
      offset += 2
    } else {
      sizeOfOpusData = pttData[offset] + 1
      offset += 1
    }

    offset += sizeOfOpusData - 1
    frames++

    if ((frames + 1) % 25 === 0) {
      const payload: WL_PttPayload = {
        frameCount: frames - prevFrames,
        data: new Uint8Array(pttData.slice(prevOffset, offset)),
      }

      codedDataList.push(payload)
      prevOffset = offset
      prevFrames = frames
    }
  }

  if (prevOffset < offset) {
    const payload: WL_PttPayload = {
      frameCount: frames - prevFrames,
      data: new Uint8Array(pttData.slice(prevOffset, offset)),
    }

    codedDataList.push(payload)
  }

  return codedDataList
}

function getOpusDataFrameCount(pttData: Uint8Array): number {
  let frameCount = 0
  let offset = 0
  let sizeOfOpusData = 0

  while (offset < pttData.length) {
    const flag = pttData[offset]
    offset += 1

    if (flag & 0x80) {
      const dataView = new DataView(pttData.buffer, pttData.byteOffset)
      sizeOfOpusData = dataView.getUint16(offset, false) + 1
      offset += 2
    } else {
      sizeOfOpusData = pttData[offset] + 1
      offset += 1
    }

    offset += sizeOfOpusData - 1
    frameCount++
  }

  return frameCount
}

function getOpusDataListFromPttData(pttData: Uint8Array): Uint8Array[] {
  let offset = 0
  let sizeOfOpusData = 0
  const codedDataList: Uint8Array[] = []

  while (offset < pttData.length) {
    const flag = pttData[offset]
    offset += 1

    if (flag & 0x80) {
      const dataView = new DataView(pttData.buffer, pttData.byteOffset)
      sizeOfOpusData = dataView.getUint16(offset, false) + 1
      offset += 2
    } else {
      sizeOfOpusData = pttData[offset] + 1
      offset += 1
    }

    const codedData = new Uint8Array(sizeOfOpusData)
    codedData[0] = flag
    codedData.set(pttData.subarray(offset, offset + sizeOfOpusData - 1), 1)
    codedDataList.push(codedData)
    offset += sizeOfOpusData - 1
  }

  return codedDataList
}

function calculateOpusDataFrame(opusData: Uint8Array): number {
  let offset = 0
  let sizeOfOpusData = 0
  let frameCount = 0

  while (offset < opusData.length) {
    const flag = opusData[offset]
    offset += 1

    if (flag & 0x80) {
      const dataView = new DataView(opusData.buffer, opusData.byteOffset)
      sizeOfOpusData = dataView.getUint16(offset, false) + 1
      offset += 2
    } else {
      sizeOfOpusData = opusData[offset] + 1
      offset += 1
    }

    offset += sizeOfOpusData - 1
    frameCount++
  }

  return frameCount
}

function calculateAudioDuration(frameCount: number): number {
  if (!frameCount || frameCount <= 0) return 0

  return Math.max(1, Math.round(frameCount * OPUS_FRAME_DURATION_SEC))
}

function getMsgDataIdByCombo(msgData: WL_IDbMsgData, seq: number): string {
  if (msgData) {
    return msgData.sessionId + '_' + msgData.sessionType + '_' + msgData.msgId + '_' + seq
  }

  return ''
}

export {
  fetchWithTimeout,
  packPttPacket,
  fetchAudioDataFromUrl,
  getPbResultCodeMessage,
  getErrorMsg,
  AsyncTime,
  SyncTime,
  getAppKeyAndId,
  getOpusDataFrameCount,
  decompositionAudioData,
  getOpusDataListFromPttData,
  calculateOpusDataFrame,
  calculateAudioDuration,
  getWebsocketAddr,
  getMsgDataIdByCombo,
}
