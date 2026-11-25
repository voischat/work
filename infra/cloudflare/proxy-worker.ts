interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  SIMCARD_MOCK: { fetch: (request: Request) => Promise<Response> }
}

const API_ORIGIN = 'https://api.voischat.cn'
const API_PREFIXES = ['/v1/', '/v2/']
const SIMCARD_MOCK_PREFIX = '/v2/corp/simcard'
const SIMCARD_MOCK_ORIGIN = 'https://work-simcard-mock'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Temporary: the corp simcard read endpoints are not deployed yet.
    if (url.pathname.startsWith(SIMCARD_MOCK_PREFIX)) {
      const target = new URL(url.pathname + url.search, SIMCARD_MOCK_ORIGIN)
      return env.SIMCARD_MOCK.fetch(new Request(target.toString(), request))
    }

    if (API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      const target = new URL(url.pathname + url.search, API_ORIGIN)
      return fetch(new Request(target.toString(), request))
    }

    return env.ASSETS.fetch(request)
  },
}
