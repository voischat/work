import type { WL_ImageMsgData } from '@vois/weila-sdk-core'
import { WL_IDbMsgDataStatus, WL_IDbMsgDataType } from '@vois/weila-sdk-core'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WlImageBubble from './WlImageBubble.vue'

const FILE_URL = 'https://cdn.example.com/photo.jpg'
const THUMBNAIL_URL = `${FILE_URL}?x-oss-process=style/hw320`

function imageMessage(fileUrl: string = FILE_URL): WL_ImageMsgData {
  return {
    combo_id: '80001922_18_1_0',
    senderId: 1,
    sessionId: '80001922',
    sessionType: 18,
    msgId: 1,
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE,
    created: 1794454768,
    autoReply: 0,
    status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_SENT,
    fileInfo: { fileSize: 1024, fileUrl },
  }
}

describe('WlImageBubble', () => {
  it('renders the original file URL through the image thumbnail process', () => {
    const wrapper = mount(WlImageBubble, { props: { msg: imageMessage() } })

    expect(wrapper.get('img').attributes('src')).toBe(THUMBNAIL_URL)
  })

  it('replaces the image with a placeholder when the thumbnail fails', async () => {
    const wrapper = mount(WlImageBubble, { props: { msg: imageMessage() } })

    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('图片加载失败')
    expect(wrapper.html()).not.toContain(FILE_URL)
  })

  it('emits the original file URL when the failed placeholder is clicked', async () => {
    const wrapper = mount(WlImageBubble, { props: { msg: imageMessage() } })

    await wrapper.get('img').trigger('error')
    const placeholder = wrapper
      .findAll('div')
      .findLast((node) => node.text().includes('图片加载失败'))
    await placeholder!.trigger('click')

    expect(wrapper.emitted('click')?.[0]).toEqual([FILE_URL])
  })
})
