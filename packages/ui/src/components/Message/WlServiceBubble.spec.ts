import type { WL_IDbMsgData, WL_IDbServicePayload } from '@vois/weila-sdk-core'
import { WL_IDbMsgDataStatus, WL_IDbMsgDataType } from '@vois/weila-sdk-core'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { provideWeilaUiI18n } from '../../i18n'
import WlServiceBubble from './WlServiceBubble.vue'

const QRCODE_URL = 'https://cdn.example.com/qr.png'

function serviceMessage(payload: WL_IDbServicePayload): WL_IDbMsgData {
  return {
    combo_id: '80001922_18_3_0',
    senderId: 1,
    sessionId: '80001922',
    sessionType: 18,
    msgId: 3,
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_SERVICE_TYPE,
    created: 1794454768,
    autoReply: 0,
    status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_SENT,
    servicePayload: payload,
  }
}

function mountWithLocale(payload: WL_IDbServicePayload, locale: string) {
  const wrapper = defineComponent({
    setup() {
      provideWeilaUiI18n({ locale })

      return () => h(WlServiceBubble, { msg: serviceMessage(payload) })
    },
  })

  return mount(wrapper)
}

describe('WlServiceBubble', () => {
  it('renders a qrcode through the image thumbnail process and emits the original url', async () => {
    const wrapper = mount(WlServiceBubble, {
      props: {
        msg: serviceMessage({
          type: 'qrcode',
          url: QRCODE_URL,
          name: 'My Card',
          desc: 'Scan me',
        }),
      },
    })

    expect(wrapper.get('img').attributes('src')).toBe(`${QRCODE_URL}?x-oss-process=style/hw320`)
    expect(wrapper.text()).toContain('My Card')
    expect(wrapper.text()).toContain('Scan me')

    await wrapper.get('img').trigger('click')

    expect(wrapper.emitted('image-click')?.[0]).toEqual([QRCODE_URL])
  })

  it('renders a member join with the zh-CN separator', () => {
    const wrapper = mount(WlServiceBubble, {
      props: {
        msg: serviceMessage({
          type: 'session-member-change',
          action: 'join',
          members: [
            { userId: 1, nick: '张三' },
            { userId: 2, nick: '李四' },
          ],
        }),
      },
    })

    expect(wrapper.text()).toContain('张三、李四 加入了会话')
  })

  it('renders a member exit with the en separator', () => {
    const wrapper = mountWithLocale(
      {
        type: 'session-member-change',
        action: 'exit',
        members: [
          { userId: 1, nick: 'Ann' },
          { userId: 2, nick: 'Bob' },
        ],
      },
      'en',
    )

    expect(wrapper.text()).toContain('Ann, Bob left the session')
  })

  it('renders a group destroy', () => {
    const wrapper = mount(WlServiceBubble, {
      props: { msg: serviceMessage({ type: 'group-destroy' }) },
    })

    expect(wrapper.text()).toContain('群聊已解散')
  })

  it('renders an alarm-power message', () => {
    const wrapper = mount(WlServiceBubble, {
      props: {
        msg: serviceMessage({
          type: 'alarm-power',
          userId: 1,
          userNumber: '70000001',
          userNick: 'Ann',
          info: 'Battery 5%',
        }),
      },
    })

    expect(wrapper.text()).toContain('设备电量告警')
    expect(wrapper.text()).toContain('Ann (70000001)')
    expect(wrapper.text()).toContain('Battery 5%')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders an alarm-geofence message with its transition and address', () => {
    const wrapper = mount(WlServiceBubble, {
      props: {
        msg: serviceMessage({
          type: 'alarm-geofence',
          userId: 2,
          userNumber: '70000002',
          userNick: 'Bob',
          latitude: 30.1,
          longitude: 120.2,
          transitionType: 2,
          address: 'Gate',
        }),
      },
    })

    expect(wrapper.text()).toContain('设备电子围栏告警')
    expect(wrapper.text()).toContain('Bob (70000002)')
    expect(wrapper.text()).toContain('离开围栏 · Gate')
    expect(wrapper.get('button').text()).toBe('查看位置')
  })

  it('renders an alarm-sos message and emits its location', async () => {
    const wrapper = mount(WlServiceBubble, {
      props: {
        msg: serviceMessage({
          type: 'alarm-sos',
          userId: 3,
          userNumber: '70000003',
          userNick: 'Cid',
          latitude: 30.3,
          longitude: 120.4,
          address: 'Park',
          info: 'Help',
        }),
      },
    })

    expect(wrapper.text()).toContain('设备 SOS 告警')
    expect(wrapper.text()).toContain('Help · Park')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('location-click')?.[0]).toEqual([
      { latitude: 30.3, longitude: 120.4, name: 'Park', address: 'Park' },
    ])
  })
})
