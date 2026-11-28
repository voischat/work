import type { WL_TextMsgData } from '@vois/weila-sdk-core'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WL_IDbMsgDataStatus, WL_IDbMsgDataType } from '@vois/weila-sdk-core'
import WlMsgList from './WlMsgList.vue'

function textMessage(overrides: Partial<WL_TextMsgData> = {}): WL_TextMsgData {
  return {
    combo_id: '80001922_18_1_0',
    senderId: 1875437,
    sessionId: '80001922',
    sessionType: 18,
    msgId: 1,
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_TEXT_TYPE,
    created: 1794454768,
    autoReply: 0,
    status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_READ,
    textData: 'hello',
    ...overrides,
  }
}

const scrollToDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo')
let scrollTo: ReturnType<typeof vi.fn>

beforeEach(() => {
  scrollTo = vi.fn()
  Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: scrollTo })
})

afterEach(() => {
  if (scrollToDescriptor) Object.defineProperty(Element.prototype, 'scrollTo', scrollToDescriptor)
  else Reflect.deleteProperty(Element.prototype, 'scrollTo')
})

describe('wlMsgList sender label', () => {
  it('falls back to the message tag when sender info is missing', () => {
    const wrapper = mount(WlMsgList, {
      props: {
        currentUserId: 1531720,
        senderInfos: new Map(),
        messages: [textMessage({ tag: '波刚' })],
      },
    })

    expect(wrapper.text()).toContain('波刚')
    expect(wrapper.text()).not.toContain('1875437')
  })

  it('prefers cached sender info over the message tag', () => {
    const wrapper = mount(WlMsgList, {
      props: {
        currentUserId: 1531720,
        senderInfos: new Map([
          [
            1875437,
            {
              userId: 1875437,
              nick: '王刚',
              weilaNum: '70001598',
              avatar: '',
              countryCode: '86',
              created: 0,
              email: '',
              phone: '',
              pinyinName: '',
              sex: 0,
              signature: '',
              status: 0,
              userType: 0,
            },
          ],
        ]),
        messages: [textMessage({ tag: '波刚' })],
      },
    })

    expect(wrapper.text()).toContain('王刚')
    expect(wrapper.text()).not.toContain('1875437')
  })

  it('scrolls to the bottom when a new message arrives while the list is at the bottom', async () => {
    const wrapper = mount(WlMsgList, {
      props: {
        currentUserId: 1531720,
        senderInfos: new Map(),
        messages: [textMessage()],
      },
    })

    await nextTick()
    scrollTo.mockClear()

    await wrapper.setProps({
      messages: [textMessage(), textMessage({ msgId: 2, combo_id: '80001922_18_2_0' })],
    })
    await nextTick()

    expect(scrollTo).toHaveBeenCalled()
  })
})
