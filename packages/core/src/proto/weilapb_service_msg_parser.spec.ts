import { describe, expect, it } from 'vitest'
import { WL_IDbMsgDataType } from 'db/weila_db_data'
import { parseSessionServiceMsg } from 'proto/weilapb_service_msg_parser'

const CAPTURED_IMAGE_URL =
  'http://weilacache.oss-cn-shenzhen.aliyuncs.com/media/cg/80001922/20261125/1875437_142130_1.jpg'
const CAPTURED_IMAGE_SERVICE_DATA =
  '{"service_type":"image","content":{"url":"http://weilacache.oss-cn-shenzhen.aliyuncs.com/media/cg/80001922/20261125/1875437_142130_1.jpg"}}'

describe('parseSessionServiceMsg', () => {
  it('parses the captured image service message', () => {
    expect(parseSessionServiceMsg(CAPTURED_IMAGE_SERVICE_DATA)).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE,
      fileInfo: { fileSize: 0, fileName: '', fileUrl: CAPTURED_IMAGE_URL },
    })
  })

  it('returns undefined for malformed JSON', () => {
    expect(parseSessionServiceMsg('{"service_type":')).toBeUndefined()
  })

  it('returns undefined for an unknown service type', () => {
    expect(
      parseSessionServiceMsg(
        '{"service_type":"video","content":{"url":"https://example.com/a.mp4"}}',
      ),
    ).toBeUndefined()
  })

  it('returns undefined when content.url is missing', () => {
    expect(parseSessionServiceMsg('{"service_type":"image","content":{}}')).toBeUndefined()
  })

  it('returns undefined for a non-http url', () => {
    expect(
      parseSessionServiceMsg('{"service_type":"image","content":{"url":"javascript:alert(1)"}}'),
    ).toBeUndefined()
  })

  it('returns undefined when content.url is not a string', () => {
    expect(parseSessionServiceMsg('{"service_type":"image","content":{"url":42}}')).toBeUndefined()
  })
})
