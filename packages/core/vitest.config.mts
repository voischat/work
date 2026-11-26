import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

// Vite 8 ships `vite:wasm-helper`, which instantiates `.wasm` as an ESM module
// before `assetsInclude` gets a say. The SDK imports its wasm for its URL
// (rspack asset/resource semantics), so keep that behavior in tests.
const wasmAsAssetUrl = {
  name: 'wasm-as-asset-url',
  enforce: 'pre' as const,
  load(id: string) {
    const file = id.split('?')[0]

    return file.endsWith('.wasm')
      ? `export default ${JSON.stringify(`/${path.relative(root, file)}`)}`
      : undefined
  },
}

const workletAsBlobUrl = {
  name: 'worklet-as-blob-url',
  enforce: 'pre' as const,
  load(id: string) {
    const file = id.split('?')[0]

    return file.endsWith('.worklet.js')
      ? `export default ${JSON.stringify(`blob:${path.basename(file)}`)}`
      : undefined
  },
}

export default defineConfig({
  plugins: [workletAsBlobUrl, wasmAsAssetUrl],
  resolve: {
    alias: {
      audio: path.resolve(root, 'src/audio'),
      db: path.resolve(root, 'src/database'),
      fsm: path.resolve(root, 'src/fsm'),
      log: path.resolve(root, 'src/log'),
      main: path.resolve(root, 'src/main'),
      proto: path.resolve(root, 'src/proto'),
    },
  },
  assetsInclude: ['**/*.wasm'],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})
