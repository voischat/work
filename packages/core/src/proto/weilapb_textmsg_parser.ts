import { enc, lib, AES, mode, pad } from 'crypto-js'
import {
  getStringFromBase64,
  hexStr2Uint8Array,
  uint8Array2HexStr,
  uint8Array2Utf8Str,
} from './weilapb_utils'
import { WL_IDbFileData, WL_IDbLocationShared, WL_IDbMsgDataType } from 'db/weila_db_data'
import type { WL_MsgContent } from 'db/weila_db_data'
import { createMediaMsgContent } from 'main/weila_msg_content'

interface ParsedTextMsgData {
  msgType: WL_IDbMsgDataType
  textData?: string
  location?: WL_IDbLocationShared
  fileInfo?: WL_IDbFileData
  command?: string
}

type EncodeTextMsgPayload =
  | {
      dataType:
        | WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE
        | WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE
      data: string
    }
  | {
      dataType:
        | WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE
        | WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE
      data: WL_IDbFileData
    }
  | {
      dataType: WL_IDbMsgDataType.WL_DB_MSG_DATA_LOCATION_TYPE
      data: WL_IDbLocationShared
    }
  | {
      dataType: WL_IDbMsgDataType.WL_DB_MSG_DATA_COMMAND_TYPE
      data?: undefined
    }

function ensureLocation(dbMsgData: ParsedTextMsgData): WL_IDbLocationShared {
  if (!dbMsgData.location) {
    dbMsgData.location = { locationType: '', latitude: 0, longitude: 0 }
  }

  return dbMsgData.location
}

function ensureFileInfo(dbMsgData: ParsedTextMsgData): WL_IDbFileData {
  if (!dbMsgData.fileInfo) {
    dbMsgData.fileInfo = { fileSize: 0 }
  }

  return dbMsgData.fileInfo
}

function decodeParam(value: string): string {
  if (!/%[0-9a-f]{2}/i.test(value)) {
    return value
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function toMsgContent(parsed: ParsedTextMsgData): WL_MsgContent | undefined {
  switch (parsed.msgType) {
    case WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE:
      return parsed.textData === undefined
        ? undefined
        : { msgType: parsed.msgType, textData: parsed.textData }
    case WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE:
    case WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE:
    case WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE:
      return parsed.fileInfo === undefined
        ? undefined
        : createMediaMsgContent(parsed.msgType, parsed.fileInfo)
    case WL_IDbMsgDataType.WL_DB_MSG_DATA_LOCATION_TYPE:
      return parsed.location === undefined
        ? undefined
        : { msgType: parsed.msgType, location: parsed.location }
    case WL_IDbMsgDataType.WL_DB_MSG_DATA_COMMAND_TYPE:
      return parsed.command === undefined
        ? undefined
        : { msgType: parsed.msgType, command: parsed.command }
    case WL_IDbMsgDataType.WL_DB_MSG_DATA_UNKNOWN_TYPE:
      return { msgType: parsed.msgType }
    default:
      return undefined
  }
}

const TextMsgDataParser = {
  BASE_FILE_TYPE_URL: 'https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/file/',
  FILE_TYPE_DOC: 'DOC.png',
  FILE_TYPE_HTML: 'HTML.png',
  FILE_TYPE_MP3: 'MP3.png',
  FILE_TYPE_PDF: 'PDF.png',
  FILE_TYPE_PPT: 'PPT.png',
  FILE_TYPE_RAR: 'RAR.png',
  FILE_TYPE_RAW: 'RAW.png',
  FILE_TYPE_TXT: 'TXT.png',
  FILE_TYPE_XLS: 'XLS.png',
  FILE_TYPE_ZIP: 'ZIP.png',
  FILE_TYPE_WAV: 'WAV.png',
  FILE_TYPE_VIDEO: 'video.jpg',
  FILE_TYPE_UNKOWN: 'UNKOWN.png',

  EXTEND_START_FLAG: '&$#@~^@[{:',
  EXTEND_END_FLAG: ':}]&$~@#@',
  EXTEND_MSG_PATTERN: /&\$#@~\^@\[{:(.*):}\]&\$~@#@/,
  CMD_MSG_PATTERN: /\*&\^@~\^\(\[{:(.*):}\]\)\^\*#@#@/,
  SERVICE_TYPE_KEY: 'serviceType',
  SERVICE_TYPE_LOCATION: 'location',
  LOCATION_TYPE_KEY: 'locationType',
  LATITUDE_KEY: 'latitude',
  LONGITUDE_KEY: 'longitude',
  LOCATION_NAME_KEY: 'name',
  LOCATION_ADDRESS_KEY: 'address',
  SERVICE_TYPE_VIDEO: 'video',
  SERVICE_TYPE_FILE: 'file',
  FILE_URL_KEY: 'fileUrl',
  FILE_SIZE_KEY: 'fileSize',
  FILE_NAME_KEY: 'fileName',
  SERVICE_TYPE_QR_CODE: 'qrcode',
  QR_CODE_NAME_KEY: 'qrName',
  QR_CODE_DESC_KEY: 'qrDesc',
  QR_CODE_SESSION_TYPE_KEY: 'qrSessionType',
  QR_CODE_PEER_ID_KEY: 'qrPeerId',
  NORMAL_BUSINESS_SERVICE_TYPE: 'business',
  DEFAULT_BUSINESS_SERVICE_TYPE: 'order',

  getCK(): lib.WordArray {
    const k = []

    for (let j = 0; j < 3; j++) {
      for (let i = 1; i < 11; i++) {
        if (i === 10) {
          k.push(0)
        } else {
          k.push(i)
        }
      }
    }

    k.push(1)
    k.push(2)

    return enc.Utf8.parse(k.join(''))
  },

  getFileExt(filePath: string): string | undefined {
    const extPattern = /\.[a-zA-Z0-9]{1,5}$/

    if (extPattern.test(filePath)) {
      return extPattern.exec(filePath)![0]
    } else {
      return undefined
    }
  },

  getExtendFileFormatUrl(filePath: string): string {
    let extStr = this.getFileExt(filePath)
    let fileFormatUrl = this.BASE_FILE_TYPE_URL

    if (extStr === undefined) {
      extStr = ''
    }

    extStr = extStr.toLowerCase()

    switch (extStr) {
      case '.txt':
        {
          fileFormatUrl += this.FILE_TYPE_TXT
        }

        break

      case '.doc':
      case '.docx':
        {
          fileFormatUrl += this.FILE_TYPE_DOC
        }

        break

      case '.ppt':
        {
          fileFormatUrl += this.FILE_TYPE_PPT
        }

        break

      case '.pdf':
        {
          fileFormatUrl += this.FILE_TYPE_PDF
        }

        break

      case '.xls':
        {
          fileFormatUrl += this.FILE_TYPE_XLS
        }

        break

      case '.mp3':
        {
          fileFormatUrl += this.FILE_TYPE_MP3
        }

        break

      case '.wav':
        {
          fileFormatUrl += this.FILE_TYPE_WAV
        }

        break

      case '.html':
        {
          fileFormatUrl += this.FILE_TYPE_HTML
        }

        break

      case '.rar':
        {
          fileFormatUrl += this.FILE_TYPE_RAR
        }

        break

      case '.zip':
        {
          fileFormatUrl += this.FILE_TYPE_ZIP
        }

        break

      case '.raw':
        {
          fileFormatUrl += this.FILE_TYPE_RAW
        }

        break

      default:
        {
          fileFormatUrl += this.FILE_TYPE_UNKOWN
        }

        break
    }

    return fileFormatUrl
  },

  getExtendFileInfo(
    filePath: string,
    fileUrl: string,
    fileSize: number,
    serviceType: string,
  ): string {
    const fileFormatUrl = this.getExtendFileFormatUrl(filePath)

    let filename = '未知文件'

    if (filePath !== '') {
      filename = enc.Base64.stringify(enc.Utf8.parse(filePath))
    } else {
      filename = enc.Base64.stringify(enc.Utf8.parse(filename))
    }

    let extendString = this.EXTEND_START_FLAG
    extendString += fileFormatUrl + '?'
    extendString += this.SERVICE_TYPE_KEY + '=' + serviceType + '&'
    extendString += this.FILE_URL_KEY + '=' + fileUrl + '&'
    extendString += this.FILE_SIZE_KEY + '=' + fileSize
    extendString += '&' + this.FILE_NAME_KEY + '=' + filename
    extendString += this.EXTEND_END_FLAG

    return extendString
  },

  encodeSessionTextMsg(payload: EncodeTextMsgPayload): string | undefined {
    let extendText: string | undefined = undefined

    switch (payload.dataType) {
      case WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE:
        {
          extendText = payload.data
        }

        break

      case WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE:
        {
          extendText = this.EXTEND_START_FLAG + payload.data + this.EXTEND_END_FLAG
        }

        break

      case WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE:
        {
          const fileInfo = payload.data
          fileInfo.fileThumbnail = this.getExtendFileFormatUrl(fileInfo.fileName ?? '')
          extendText = this.getExtendFileInfo(
            fileInfo.fileName ?? '',
            fileInfo.fileUrl ?? '',
            fileInfo.fileSize,
            this.SERVICE_TYPE_VIDEO,
          )
        }

        break

      case WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE:
        {
          const fileInfo = payload.data
          fileInfo.fileThumbnail = this.getExtendFileFormatUrl(fileInfo.fileName ?? '')
          extendText = this.getExtendFileInfo(
            fileInfo.fileName ?? '',
            fileInfo.fileUrl ?? '',
            fileInfo.fileSize,
            this.SERVICE_TYPE_FILE,
          )
        }

        break

      case WL_IDbMsgDataType.WL_DB_MSG_DATA_LOCATION_TYPE:
        {
          const locationInfo = payload.data
          extendText = this.EXTEND_START_FLAG + (locationInfo.mapUrl ?? '') + '?'
          extendText += this.SERVICE_TYPE_KEY + '=' + this.SERVICE_TYPE_LOCATION
          extendText += '&' + this.LOCATION_TYPE_KEY + '=' + locationInfo.locationType
          extendText += '&' + this.LATITUDE_KEY + '=' + locationInfo.latitude
          extendText += '&' + this.LONGITUDE_KEY + '=' + locationInfo.longitude
          extendText +=
            '&' +
            this.LOCATION_NAME_KEY +
            '=' +
            enc.Base64.stringify(enc.Utf8.parse(locationInfo.name ?? ''))
          extendText +=
            '&' +
            this.LOCATION_ADDRESS_KEY +
            '=' +
            enc.Base64.stringify(enc.Utf8.parse(locationInfo.address ?? ''))
          extendText += this.EXTEND_END_FLAG
        }

        break

      case WL_IDbMsgDataType.WL_DB_MSG_DATA_COMMAND_TYPE:
        {
        }

        break
    }

    if (extendText) {
      const textWordArray = enc.Utf8.parse(extendText)
      const bufferLen = textWordArray.sigBytes + 4
      let left = 0

      if (bufferLen % 16 > 0) {
        left = 16 - (bufferLen % 16)
      }

      const lenDataBuffer = new ArrayBuffer(4 + left)
      const lenDataView = new DataView(lenDataBuffer)
      lenDataView.setInt32(lenDataBuffer.byteLength - 4, textWordArray.sigBytes)
      const lenDataHexStr = uint8Array2HexStr(new Uint8Array(lenDataBuffer))
      const lenDataWordArray = enc.Hex.parse(lenDataHexStr)

      try {
        const encrypted = AES.encrypt(textWordArray.concat(lenDataWordArray), this.getCK(), {
          mode: mode.ECB,
          padding: pad.ZeroPadding,
        })

        return encrypted.toString()
      } catch {}
    }

    return undefined
  },

  decodeSessionTextMsg(data: string): WL_MsgContent | undefined {
    const dbMsgData: ParsedTextMsgData = {
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_UNKNOWN_TYPE,
    }

    let extendText = ''

    let decryptedHexText

    try {
      decryptedHexText = AES.decrypt(data, this.getCK(), {
        mode: mode.ECB,
        padding: pad.ZeroPadding,
      })
    } catch {
      return undefined
    }

    const textUnit8Data = hexStr2Uint8Array(enc.Hex.stringify(decryptedHexText))

    if (textUnit8Data && textUnit8Data.length > 0) {
      const textDataLen = new DataView(textUnit8Data.buffer).getInt32(textUnit8Data.length - 4)
      extendText = uint8Array2Utf8Str(textUnit8Data.subarray(0, textDataLen))
    } else {
      return undefined
    }

    if (extendText === '') {
      return undefined
    }

    if (this.EXTEND_MSG_PATTERN.test(extendText)) {
      const result = this.EXTEND_MSG_PATTERN.exec(extendText)
      this.EXTEND_MSG_PATTERN.exec('')

      if (result && result[1]) {
        const content = result[1]
        const paramStart = content.lastIndexOf('?')

        if (paramStart !== -1) {
          const fileUrl = content.slice(0, paramStart)
          const params = content.slice(paramStart + 1).split('&')

          for (const param of params) {
            const separator = param.indexOf('=')

            if (separator <= 0) {
              continue
            }

            const key = param.slice(0, separator)
            const value = param.slice(separator + 1)

            switch (key) {
              case this.SERVICE_TYPE_KEY:
                {
                  if (value === this.SERVICE_TYPE_LOCATION) {
                    dbMsgData.msgType = WL_IDbMsgDataType.WL_DB_MSG_DATA_LOCATION_TYPE
                    dbMsgData.location = {
                      locationType: '',
                      latitude: 0,
                      longitude: 0,
                      mapUrl: fileUrl,
                    }
                  } else if (value === this.SERVICE_TYPE_VIDEO) {
                    dbMsgData.msgType = WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE
                    const fileInfo = ensureFileInfo(dbMsgData)
                    fileInfo.fileUrl ||= fileUrl
                  } else if (value === this.SERVICE_TYPE_FILE) {
                    dbMsgData.msgType = WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE
                    const fileInfo = ensureFileInfo(dbMsgData)
                    fileInfo.fileUrl ||= fileUrl
                  }
                }

                break

              case this.LOCATION_TYPE_KEY:
                {
                  ensureLocation(dbMsgData).locationType = value
                }

                break

              case this.LATITUDE_KEY:
                {
                  ensureLocation(dbMsgData).latitude = Number.parseFloat(value) || 0
                }

                break

              case this.LONGITUDE_KEY:
                {
                  ensureLocation(dbMsgData).longitude = Number.parseFloat(value) || 0
                }

                break

              case this.LOCATION_NAME_KEY:
                {
                  ensureLocation(dbMsgData).name = getStringFromBase64(value)
                }

                break

              case this.LOCATION_ADDRESS_KEY:
                {
                  ensureLocation(dbMsgData).address = getStringFromBase64(value)
                }

                break

              case this.FILE_URL_KEY:
                {
                  ensureFileInfo(dbMsgData).fileUrl = decodeParam(value)
                }

                break

              case this.FILE_NAME_KEY:
                {
                  const fileInfo = ensureFileInfo(dbMsgData)
                  fileInfo.fileName = enc.Base64.parse(decodeParam(value)).toString(enc.Utf8)
                  fileInfo.fileThumbnail = this.getExtendFileFormatUrl(fileInfo.fileName)
                }

                break

              case this.FILE_SIZE_KEY:
                {
                  const size = Number.parseInt(value, 10)
                  ensureFileInfo(dbMsgData).fileSize = Number.isFinite(size) ? size : 0
                }

                break
            }
          }
        } else {
          dbMsgData.msgType = WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE
          dbMsgData.fileInfo = { fileSize: 0, fileUrl: content, fileName: '' }
        }
      }
    } else if (this.CMD_MSG_PATTERN.test(extendText)) {
      const result = this.CMD_MSG_PATTERN.exec(extendText)
      this.CMD_MSG_PATTERN.exec('')

      if (result && result[1]) {
        dbMsgData.msgType = WL_IDbMsgDataType.WL_DB_MSG_DATA_COMMAND_TYPE
        dbMsgData.command = result[1]
      }
    } else {
      dbMsgData.msgType = WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE
      dbMsgData.textData = extendText
    }

    return toMsgContent(dbMsgData)
  },
}

export { TextMsgDataParser }
