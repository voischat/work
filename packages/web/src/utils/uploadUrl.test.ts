import { describe, expect, it } from 'vitest'
import { toChatSafeUploadUrl } from './uploadUrl'

describe('toChatSafeUploadUrl', () => {
  it('keeps an absolute upload url and upgrades http to https', () => {
    expect(toChatSafeUploadUrl('http://cdn.example.com/a.png', 'https://app.example.com/v2'))
      .toBe('https://cdn.example.com/a.png')
  })

  it('resolves a relative url against the api base', () => {
    expect(toChatSafeUploadUrl('tmp/a.png', 'https://app.example.com/v2/'))
      .toBe('https://app.example.com/v2/tmp/a.png')
  })

  it('drops query and hash because the chat protocol cannot carry them', () => {
    expect(toChatSafeUploadUrl('https://cdn.example.com/a.png?x=1#y', 'https://app.example.com/v2/'))
      .toBe('https://cdn.example.com/a.png')
  })

  it('accepts a { url } payload', () => {
    expect(toChatSafeUploadUrl({ url: 'https://cdn.example.com/a.png' }, 'https://app.example.com/v2/'))
      .toBe('https://cdn.example.com/a.png')
  })

  it('rejects a missing url', () => {
    expect(() => toChatSafeUploadUrl('', 'https://app.example.com/v2/')).toThrow()
  })
})
