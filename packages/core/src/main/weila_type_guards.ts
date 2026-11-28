export type JsonValue =
  | JsonValue[]
  | boolean
  | null
  | number
  | string
  | { [key: string]: JsonValue }

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

// oxlint-disable-next-line anti-slop/no-unknown-returns -- a callable probe cannot know the callee's return type; callers narrow what they invoke
function isCallable(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

export { isCallable, isNumber, isRecord, isString }
