interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

const API_ORIGIN = 'https://api.voischat.cn'
const API_PREFIXES = ['/v1/', '/v2/']

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      const target = new URL(url.pathname + url.search, API_ORIGIN)
      return fetch(new Request(target.toString(), request))
    }

    return env.ASSETS.fetch(request)
  },
}
