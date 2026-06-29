export function parseNumberArray(input: unknown): number[] {
  if (input === undefined || input === null)
    return []
  if (Array.isArray(input))
    return input.map(Number).filter(n => Number.isFinite(n))
  if (typeof input === 'string')
    return input.split(/[,，]/).map(s => Number(s.trim())).filter(n => Number.isFinite(n))
  return [Number(input)].filter(n => Number.isFinite(n))
}

export function parseOptionalNumber(input: unknown): number | undefined {
  if (input === undefined || input === null)
    return undefined
  const n = Number(input)
  return Number.isFinite(n) ? n : undefined
}

export function parseOptionalString(input: unknown): string | undefined {
  if (input === undefined || input === null)
    return undefined
  if (Array.isArray(input))
    return input.length > 0 ? String(input[0]) : undefined
  return String(input)
}

export function parseString(input: unknown): string {
  if (input === undefined || input === null)
    return ''
  if (Array.isArray(input))
    return input.length > 0 ? String(input[0]) : ''
  return String(input)
}
