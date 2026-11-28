import { describe, expect, it } from 'vitest'
import { escapeHtml, safeImageUrl } from './escapeHtml'

describe('escapeHtml', () => {
  it('escapes every character that can open an HTML context', () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;',
    )
  })

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('张三 微笑')).toBe('张三 微笑')
  })
})

describe('safeImageUrl', () => {
  it('strips the protocol from an ordinary avatar url', () => {
    expect(safeImageUrl('https://cdn.example.com/a.png?v=1')).toBe('//cdn.example.com/a.png?v=1')
  })

  it('drops urls that could terminate the style attribute', () => {
    expect(safeImageUrl(`x" onerror="alert(1)`)).toBe('')
  })

  it('drops urls that keep a script scheme', () => {
    expect(safeImageUrl('javascript:alert/document.location')).toBe('')
  })

  it('treats a missing url as no image', () => {
    expect(safeImageUrl(undefined)).toBe('')
  })
})
