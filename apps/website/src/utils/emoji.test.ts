import { describe, expect, it, vi } from 'vitest'

vi.mock('../shared/states', () => ({
  emojiMap: {},
}))

const { emojify } = await import('./emoji')

describe('emojify', () => {
  it('escapes HTML before replacing emoji keywords', () => {
    const result = emojify('<img src=x onerror=alert(1)> 微笑')

    expect(result).toContain('&lt;img')
    expect(result).not.toContain('<img src=x')
  })
})
