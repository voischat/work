import { emojiMap } from '../shared/states'
import { escapeHtml } from './escapeHtml'

export function emojify(text: string) {
  let result = escapeHtml(text)

  for (const keyword in emojiMap) {
    if (!result.includes(keyword))
      continue

    const src = emojiMap[keyword].default
    result = result.replaceAll(
      keyword,
      `<img src="${src}" style="width: 2rem; height: 2rem; display: inline-block" />`,
    )
  }

  return result
}
