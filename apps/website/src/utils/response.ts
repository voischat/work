/**
 * The network layer unwraps a `data` object that has exactly one key, while
 * multi-key payloads stay wrapped. `pick` must accept both shapes.
 */
export function pickFromResponse<T>(value: T | undefined, pick?: string[]): T | undefined {
  if (!value || !pick || pick.length === 0 || typeof value !== 'object')
    return value

  const record = value as Record<string, unknown>

  if (pick.length === 1) {
    const key = pick[0]!
    return Object.hasOwn(record, key)
      ? record[key] as T
      : value
  }

  const picked: Record<string, unknown> = {}
  let found = false
  for (const key of pick) {
    if (Object.hasOwn(record, key)) {
      picked[key] = record[key]
      found = true
    }
  }

  return found ? picked as T : value
}
