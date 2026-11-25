export function ok<T>(data: T) {
  return { errcode: 0, errmsg: '请求成功', data }
}

export function fail(errcode: number, errmsg: string) {
  return { errcode, errmsg }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
