import type { WL_IDbMsgData } from '@vois/weila-sdk-core'
import { WL_IDbMsgDataStatus, WL_IDbMsgDataType } from '@vois/weila-sdk-core'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WlVideoBubble from './WlVideoBubble.vue'

const FILE_URL = 'https://cdn.example.com/clip.mp4'
const THUMBNAIL_URL = `${FILE_URL}?x-oss-process=video/snapshot,t_0,f_jpg,m_fast,w_320,ar_auto`

function videoMessage(fileUrl: string = FILE_URL): WL_IDbMsgData {
  return {
    combo_id: '80001922_18_2_0',
    senderId: 1,
    sessionId: '80001922',
    sessionType: 18,
    msgId: 2,
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE,
    created: 1794454768,
    autoReply: 0,
    status: WL_IDbMsgDataStatus.WL_DB_MSG_DATA_STATUS_SENT,
    fileInfo: { fileSize: 2048, fileName: 'clip.mp4', fileUrl },
  }
}

describe('WlVideoBubble', () => {
  it('renders the original file URL through the video snapshot process', () => {
    const wrapper = mount(WlVideoBubble, { props: { msg: videoMessage() } })

    expect(wrapper.get('img').attributes('src')).toBe(THUMBNAIL_URL)
  })

  it('replaces the image with the gray placeholder when the thumbnail fails', async () => {
    const wrapper = mount(WlVideoBubble, { props: { msg: videoMessage() } })

    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.html()).toContain('icon-[carbon--video]')
    expect(wrapper.html()).not.toContain(FILE_URL)
  })

  it('emits the original file URL when the failed bubble is clicked', async () => {
    const wrapper = mount(WlVideoBubble, { props: { msg: videoMessage() } })

    await wrapper.get('img').trigger('error')
    await wrapper.trigger('click')

    expect(wrapper.emitted('click')?.[0]).toEqual([FILE_URL])
  })
})
