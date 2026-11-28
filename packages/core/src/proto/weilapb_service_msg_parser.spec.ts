import { describe, expect, it } from 'vitest'
import { WL_IDbMsgDataType } from 'db/weila_db_data'
import { parseSessionServiceMsg } from 'proto/weilapb_service_msg_parser'

const CAPTURED_IMAGE_URL =
  'http://weilacache.oss-cn-shenzhen.aliyuncs.com/media/cg/80001922/20261125/1875437_142130_1.jpg'

const CAPTURED_IMAGE_SERVICE_DATA =
  '{"service_type":"image","content":{"url":"http://weilacache.oss-cn-shenzhen.aliyuncs.com/media/cg/80001922/20261125/1875437_142130_1.jpg"}}'

function expectUnknownService(serviceData: string) {
  expect(parseSessionServiceMsg(serviceData)).toEqual({
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
    servicePayload: { type: 'unknown', raw: serviceData },
  })
}

describe('parseSessionServiceMsg', () => {
  it('parses the captured image service message', () => {
    expect(parseSessionServiceMsg(CAPTURED_IMAGE_SERVICE_DATA)).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE,
      fileInfo: { fileSize: 0, fileName: '', fileUrl: CAPTURED_IMAGE_URL },
    })
  })

  it('parses a video service message', () => {
    expect(
      parseSessionServiceMsg(
        JSON.stringify({
          service_type: 'video',
          content: {
            url: 'https://cdn.example.com/clip.mp4',
            thumb: 'https://cdn.example.com/clip.jpg',
            name: 'clip.mp4',
            size: '2048',
          },
        }),
      ),
    ).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE,
      fileInfo: {
        fileUrl: 'https://cdn.example.com/clip.mp4',
        fileThumbnail: 'https://cdn.example.com/clip.jpg',
        fileName: 'clip.mp4',
        fileSize: 2048,
      },
    })
  })

  it('parses a file service message', () => {
    expect(
      parseSessionServiceMsg(
        JSON.stringify({
          service_type: 'file',
          content: {
            url: 'https://cdn.example.com/doc.pdf',
            thumb: 'https://cdn.example.com/pdf.png',
            name: 'doc.pdf',
            size: 4096,
          },
        }),
      ),
    ).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE,
      fileInfo: {
        fileUrl: 'https://cdn.example.com/doc.pdf',
        fileThumbnail: 'https://cdn.example.com/pdf.png',
        fileName: 'doc.pdf',
        fileSize: 4096,
      },
    })
  })

  it('parses a location service message', () => {
    expect(
      parseSessionServiceMsg(
        JSON.stringify({
          service_type: 'location',
          content: {
            url: 'https://cdn.example.com/map.jpg',
            latitude: '30.123',
            longitude: '120.456',
            type: 'gcj02',
            name: 'Office',
            address: 'Hangzhou',
          },
        }),
      ),
    ).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_LOCATION_TYPE,
      location: {
        locationType: 'gcj02',
        latitude: 30.123,
        longitude: 120.456,
        name: 'Office',
        address: 'Hangzhou',
        mapUrl: 'https://cdn.example.com/map.jpg',
      },
    })
  })

  it('parses a qrcode service message', () => {
    expect(
      parseSessionServiceMsg(
        JSON.stringify({
          service_type: 'qrcode',
          content: {
            url: 'https://cdn.example.com/qr.png',
            name: 'My Card',
            desc: 'Scan me',
            session_id: '80001922',
            session_type: '1',
          },
        }),
      ),
    ).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
      servicePayload: {
        type: 'qrcode',
        url: 'https://cdn.example.com/qr.png',
        name: 'My Card',
        desc: 'Scan me',
        sessionId: '80001922',
        sessionType: 1,
      },
    })
  })

  it('parses a session member change and drops invalid members', () => {
    expect(
      parseSessionServiceMsg(
        JSON.stringify({
          service_type: 'session-member-change',
          content: {
            action: 'join',
            members: [
              { user_id: 1, nick: '张三' },
              { user_id: '2', nick: '李四' },
              { nick: 'No id' },
              { user_id: 3 },
            ],
          },
        }),
      ),
    ).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
      servicePayload: {
        type: 'session-member-change',
        action: 'join',
        members: [
          { userId: 1, nick: '张三' },
          { userId: 2, nick: '李四' },
        ],
      },
    })
  })

  it('parses a group destroy service message without content', () => {
    expect(parseSessionServiceMsg('{"service_type":"group-destroy"}')).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
      servicePayload: { type: 'group-destroy' },
    })
  })

  it('parses an alarm-power service message', () => {
    expect(
      parseSessionServiceMsg(
        JSON.stringify({
          service_type: 'alarm-power',
          content: {
            user_id: 1,
            user_number: '70000001',
            user_nick: 'Ann',
            user_avatar: 'https://cdn.example.com/ann.jpg',
            timestamp: '1794454768',
            info: 'Battery 5%',
          },
        }),
      ),
    ).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
      servicePayload: {
        type: 'alarm-power',
        userId: 1,
        userNumber: '70000001',
        userNick: 'Ann',
        userAvatar: 'https://cdn.example.com/ann.jpg',
        timestamp: 1794454768,
        info: 'Battery 5%',
      },
    })
  })

  it('parses an alarm-geofence service message', () => {
    expect(
      parseSessionServiceMsg(
        JSON.stringify({
          service_type: 'alarm-geofence',
          content: {
            user_id: 2,
            user_number: '70000002',
            user_nick: 'Bob',
            user_avatar: 'https://cdn.example.com/bob.jpg',
            geofence_id: 3,
            latitude: '30.1',
            longitude: '120.2',
            location_type: 0,
            transition_type: 2,
            timestamp: '1794454768',
            addr: 'Gate',
          },
        }),
      ),
    ).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
      servicePayload: {
        type: 'alarm-geofence',
        userId: 2,
        userNumber: '70000002',
        userNick: 'Bob',
        userAvatar: 'https://cdn.example.com/bob.jpg',
        geofenceId: 3,
        latitude: 30.1,
        longitude: 120.2,
        locationType: 0,
        transitionType: 2,
        timestamp: 1794454768,
        address: 'Gate',
      },
    })
  })

  it('parses an alarm-sos service message', () => {
    expect(
      parseSessionServiceMsg(
        JSON.stringify({
          service_type: 'alarm-sos',
          content: {
            user_id: 3,
            user_number: '70000003',
            user_nick: 'Cid',
            user_avatar: 'https://cdn.example.com/cid.jpg',
            latitude: 30.3,
            longitude: 120.4,
            location_type: 0,
            timestamp: 1794454768,
            addr: 'Park',
            info: 'Help',
          },
        }),
      ),
    ).toEqual({
      msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
      servicePayload: {
        type: 'alarm-sos',
        userId: 3,
        userNumber: '70000003',
        userNick: 'Cid',
        userAvatar: 'https://cdn.example.com/cid.jpg',
        latitude: 30.3,
        longitude: 120.4,
        locationType: 0,
        timestamp: 1794454768,
        address: 'Park',
        info: 'Help',
      },
    })
  })

  it('keeps malformed JSON as an unknown service payload', () => {
    expectUnknownService('{"service_type":')
  })

  it('keeps an unknown service type as an unknown service payload', () => {
    expectUnknownService(
      '{"service_type":"not-a-service","content":{"url":"https://example.com/a"}}',
    )
  })

  it('keeps an image without a url as an unknown service payload', () => {
    expectUnknownService('{"service_type":"image","content":{}}')
  })

  it('keeps a non-http url as an unknown service payload', () => {
    expectUnknownService('{"service_type":"image","content":{"url":"javascript:alert(1)"}}')
  })

  it('keeps a non-string url as an unknown service payload', () => {
    expectUnknownService('{"service_type":"image","content":{"url":42}}')
  })

  it('keeps a video without a url as an unknown service payload', () => {
    expectUnknownService('{"service_type":"video","content":{"name":"clip.mp4"}}')
  })

  it('keeps a file without a name as an unknown service payload', () => {
    expectUnknownService(
      '{"service_type":"file","content":{"url":"https://cdn.example.com/doc.pdf"}}',
    )
  })

  it('keeps out-of-range location coordinates as an unknown service payload', () => {
    expectUnknownService('{"service_type":"location","content":{"latitude":91,"longitude":120}}')
    expectUnknownService('{"service_type":"location","content":{"latitude":30,"longitude":181}}')
  })

  it('keeps a location without coordinates as an unknown service payload', () => {
    expectUnknownService('{"service_type":"location","content":{"name":"Office"}}')
  })

  it('keeps a qrcode without a url as an unknown service payload', () => {
    expectUnknownService('{"service_type":"qrcode","content":{"name":"My Card"}}')
  })

  it('keeps a member change without members as an unknown service payload', () => {
    expectUnknownService(
      '{"service_type":"session-member-change","content":{"action":"join","members":[]}}',
    )
    expectUnknownService('{"service_type":"session-member-change","content":{"action":"join"}}')
  })

  it('keeps a member change with an unknown action as an unknown service payload', () => {
    expectUnknownService(
      '{"service_type":"session-member-change","content":{"action":"invite","members":[{"user_id":1,"nick":"张三"}]}}',
    )
  })
})
