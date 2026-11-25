/** A JSON-shaped value, used where session extras and resolver payloads cross module boundaries. */
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

function isCallable(value: unknown): value is (...args: any[]) => any {
  return typeof value === 'function'
}

export { isCallable, isRecord, isString }
