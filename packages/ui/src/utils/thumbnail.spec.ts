import { describe, expect, it } from 'vitest'
import { getMessageThumbnailUrl } from './thumbnail'

describe('getMessageThumbnailUrl', () => {
  it('returns an empty string for an empty or undefined URL', () => {
    expect(getMessageThumbnailUrl('', 'image')).toBe('')
    expect(getMessageThumbnailUrl(undefined, 'image')).toBe('')
  })

  it('appends the image process string', () => {
    expect(getMessageThumbnailUrl('https://cdn.example.com/a.jpg', 'image')).toBe(
      'https://cdn.example.com/a.jpg?x-oss-process=style/hw320',
    )
  })

  it('appends the video process string with its commas intact', () => {
    expect(getMessageThumbnailUrl('https://cdn.example.com/a.mp4', 'video')).toBe(
      'https://cdn.example.com/a.mp4?x-oss-process=video/snapshot,t_0,f_jpg,m_fast,w_320,ar_auto',
    )
  })

  it('appends with & when the URL already has a query string', () => {
    expect(getMessageThumbnailUrl('https://cdn.example.com/a.jpg?foo=bar', 'image')).toBe(
      'https://cdn.example.com/a.jpg?foo=bar&x-oss-process=style/hw320',
    )
  })
})
