import { AES, enc, mode, pad } from 'crypto-js'
import { describe, expect, it } from 'vitest'
import { WL_IDbMsgDataType } from 'db/weila_db_data'
import { TextMsgDataParser } from './weilapb_textmsg_parser'
import { uint8Array2HexStr } from './weilapb_utils'

function encryptExtendText(extendText: string): string {
  const textWordArray = enc.Utf8.parse(extendText)
  const bufferLen = textWordArray.sigBytes + 4
  const left = bufferLen % 16 > 0 ? 16 - (bufferLen % 16) : 0
  const lenDataBuffer = new ArrayBuffer(4 + left)
  const lenDataView = new DataView(lenDataBuffer)
  lenDataView.setInt32(lenDataBuffer.byteLength - 4, textWordArray.sigBytes)
  const lenDataWordArray = enc.Hex.parse(uint8Array2HexStr(new Uint8Array(lenDataBuffer)))

  return AES.encrypt(textWordArray.concat(lenDataWordArray), TextMsgDataParser.getCK(), {
    mode: mode.ECB,
    padding: pad.ZeroPadding,
  }).toString()
}

function wrapExtendText(content: string): string {
  return TextMsgDataParser.EXTEND_START_FLAG + content + TextMsgDataParser.EXTEND_END_FLAG
}

const MOBILE_VIDEO_CONTENT =
  'https://weilacache.oss-cn-shenzhen.aliyuncs.com/media/cg/80001331/20261128/1532249_132215_4.mp4?x-oss-process=video/snapshot,t_0,f_jpg,m_fast,w_320,ar_auto?fileName=MTc5NTg0MzMzMTM2MC5tcDQ%3D&fileSize=1719596&fileUrl=https%3A%2F%2Fweilacache.oss-cn-shenzhen.aliyuncs.com%2Fmedia%2Fcg%2F80001331%2F20261128%2F1532249_132215_4.mp4&serviceType=video'

const MOBILE_VIDEO_URL =
  'https://weilacache.oss-cn-shenzhen.aliyuncs.com/media/cg/80001331/20261128/1532249_132215_4.mp4'

describe('TextMsgDataParser.decodeSessionTextMsg', () => {
  it('decodes a video whose serviceType follows the file fields', () => {
    const decoded = TextMsgDataParser.decodeSessionTextMsg(
      encryptExtendText(wrapExtendText(MOBILE_VIDEO_CONTENT)),
    )

    expect(decoded).toMatchObject({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE,
      fileInfo: {
        fileSize: 1719596,
        fileName: '1795843331360.mp4',
        fileUrl: MOBILE_VIDEO_URL,
        fileThumbnail: `${TextMsgDataParser.BASE_FILE_TYPE_URL}${TextMsgDataParser.FILE_TYPE_UNKOWN}`,
      },
    })
  })

  it('decodes a video whose serviceType comes first', () => {
    const encrypted = TextMsgDataParser.encodeSessionTextMsg({
      dataType: WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE,
      data: { fileSize: 2048, fileName: 'clip.mp4', fileUrl: 'https://cdn.example.com/clip.mp4' },
    })

    expect(encrypted).toBeDefined()

    const decoded = TextMsgDataParser.decodeSessionTextMsg(encrypted!)
    expect(decoded).toMatchObject({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE,
      fileInfo: {
        fileSize: 2048,
        fileName: 'clip.mp4',
        fileUrl: 'https://cdn.example.com/clip.mp4',
      },
    })
  })

  it('does not throw when a file field arrives without serviceType', () => {
    const decoded = TextMsgDataParser.decodeSessionTextMsg(
      encryptExtendText(wrapExtendText('https://cdn.example.com/a.png?fileSize=10')),
    )

    expect(decoded?.msgType).toBe(WL_IDbMsgDataType.WL_DB_MSG_DATA_UNKNOWN_TYPE)
  })
})

describe('TextMsgDataParser.getExtendFileFormatUrl', () => {
  const KNOWN = {
    '.txt': TextMsgDataParser.FILE_TYPE_TXT,
    '.doc': TextMsgDataParser.FILE_TYPE_DOC,
    '.docx': TextMsgDataParser.FILE_TYPE_DOC,
    '.ppt': TextMsgDataParser.FILE_TYPE_PPT,
    '.pdf': TextMsgDataParser.FILE_TYPE_PDF,
    '.xls': TextMsgDataParser.FILE_TYPE_XLS,
    '.mp3': TextMsgDataParser.FILE_TYPE_MP3,
    '.wav': TextMsgDataParser.FILE_TYPE_WAV,
    '.html': TextMsgDataParser.FILE_TYPE_HTML,
    '.rar': TextMsgDataParser.FILE_TYPE_RAR,
    '.zip': TextMsgDataParser.FILE_TYPE_ZIP,
    '.raw': TextMsgDataParser.FILE_TYPE_RAW,
  }

  it('maps known extensions regardless of case', () => {
    for (const [ext, fileType] of Object.entries(KNOWN)) {
      const expected = TextMsgDataParser.BASE_FILE_TYPE_URL + fileType

      expect(TextMsgDataParser.getExtendFileFormatUrl(`report${ext}`)).toBe(expected)
      expect(TextMsgDataParser.getExtendFileFormatUrl(`report${ext.toUpperCase()}`)).toBe(expected)
    }
  })

  it('falls back to the unknown icon', () => {
    const expected = TextMsgDataParser.BASE_FILE_TYPE_URL + TextMsgDataParser.FILE_TYPE_UNKOWN

    expect(TextMsgDataParser.getExtendFileFormatUrl('report.png')).toBe(expected)
    expect(TextMsgDataParser.getExtendFileFormatUrl('report')).toBe(expected)
  })
})
