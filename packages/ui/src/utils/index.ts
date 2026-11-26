import { createEmojiPattern } from '@weila/shared'

export interface TextEmojiToken {
  type: 'text' | 'emoji'
  value: string
}

const EMOJI_PATTERN = createEmojiPattern()

export function parseTextWithEmoji(text: string): TextEmojiToken[] {
  if (!text) return []

  const tokens: TextEmojiToken[] = []
  let lastIndex = 0
  let match

  while ((match = EMOJI_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    tokens.push({ type: 'emoji', value: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return tokens
}

export * from './thumbnail'
export * from './time'

export function isValidLocation(location: { latitude: number; longitude: number }): boolean {
  const { latitude, longitude } = location

  if (typeof latitude !== 'number' || Number.isNaN(latitude)) {
    console.error('[WlMsgList] Invalid location: latitude is not a valid number', location)
    return false
  }

  if (typeof longitude !== 'number' || Number.isNaN(longitude)) {
    console.error('[WlMsgList] Invalid location: longitude is not a valid number', location)
    return false
  }

  if (latitude < -90 || latitude > 90) {
    console.error('[WlMsgList] Invalid location: latitude must be between -90 and 90', location)
    return false
  }

  if (longitude < -180 || longitude > 180) {
    console.error('[WlMsgList] Invalid location: longitude must be between -180 and 180', location)
    return false
  }

  return true
}
