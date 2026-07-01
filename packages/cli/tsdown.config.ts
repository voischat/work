import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    cli: './src/cli.ts',
    index: './src/index.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  dts: true,
  shims: true,
  clean: true,
  // 把所有 npm 运行期依赖打进 bundle，让 dist/cli.mjs 零外部依赖（只留 Node 内置）。
  // 这样嵌入 Electron 的 agent 子进程调用 CLI 时不再需要随包 node_modules，
  // 从根上杜绝“打包后缺 unstorage/md5/… 依赖”这类问题。
  noExternal: ['@wl/network', 'cac', 'md5', 'unstorage', /^unstorage\//],
})
