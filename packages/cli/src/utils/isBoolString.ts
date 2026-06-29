export function isBoolString(v: unknown): boolean | undefined {
  if (typeof v === 'boolean')
    return v
  if (v === 'true' || v === '1' || v === 1)
    return true
  if (v === 'false' || v === '0' || v === 0)
    return false
  return undefined
}
