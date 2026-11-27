import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE = dirname(dirname(fileURLToPath(import.meta.url)))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
} satisfies Record<string, string>

function isTcpAddress(address: string | AddressInfo | null): address is AddressInfo {
  return typeof address === 'object' && address !== null
}

export interface SmokeServer {
  url: string
  close: () => Promise<void>
}

export async function startServer(): Promise<SmokeServer> {
  const server = createServer(async (request, response) => {
    const path = normalize(
      decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname),
    )

    let file: string | null = null

    if (path === '/') file = join(PACKAGE, 'tests/fixtures/smoke.html')
    else if (path.startsWith('/dist/')) file = join(PACKAGE, path)
    else if (path.startsWith('/assets/')) file = join(PACKAGE, 'dist', path)

    if (!file) {
      response.writeHead(404).end()

      return
    }

    try {
      const body = await readFile(file)
      response.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      })
      response.end(body)
    } catch {
      response.writeHead(404).end()
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()

  if (!isTcpAddress(address)) throw new Error('smoke server did not bind a TCP port')

  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
