const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '../..')
// 注意：rootDir 解析为 weila-work/packages。
const deployDir = path.resolve(rootDir, 'agent-deploy')
const agentDir = path.resolve(rootDir, 'agent')
const cliDir = path.resolve(rootDir, 'cli')

// 自包含产物：运行期只需要两样东西，两样都是“零外部依赖”的预构建 bundle——
//   1. agent server：eve/nitro 产出的 .output（server bundle，_libs 里已内联全部依赖）；
//   2. weila-work-cli：tsdown noExternal 打包出的 dist（cac/md5/unstorage 全部内联）。
// 因此 agent-deploy 做成“最小扁平结构”即可：.output + node_modules/weila-work-cli + .env。
// 不再用 pnpm deploy，从根上避免 pnpm 软链接（绝对路径、压缩/换机器即失效）与“缺依赖”问题，
// 也不需要 prune / 解引用；产物无软链接、无 .node、构建机无关。
console.log(`[prepare-agent] host platform: ${process.platform}/${process.arch}`)

// Clean old
fs.rmSync(deployDir, { recursive: true, force: true })

// --- 1. 强制干净重建 agent server（.output）---
// 先清 eve 增量编译缓存再 build，否则改了 agent 源码可能因缓存把旧编译产物打进包
// —— 表现为“跑了 electron:build，agent 还是旧的”。
console.log('[prepare-agent] cleaning agent build caches for a fresh rebuild...')
for (const p of [
  path.join(agentDir, '.output'),
  path.join(agentDir, '.eve'),
  path.join(agentDir, 'node_modules', '.cache', 'eve'),
]) {
  fs.rmSync(p, { recursive: true, force: true })
}
console.log('[prepare-agent] building agent (.output)...')
execSync('pnpm run build', { cwd: agentDir, stdio: 'inherit' })
const outputSrc = path.join(agentDir, '.output')
if (!fs.existsSync(path.join(outputSrc, 'server', 'index.mjs')))
  throw new Error(`[prepare-agent] eve build 未产出 ${path.join(outputSrc, 'server', 'index.mjs')}`)

// --- 2. 构建自包含 weila-work-cli（tsdown noExternal 打包全部运行期依赖）---
// 运行期 agent 子进程 execFile(cli.mjs)。dist 零外部 npm 依赖，故随包无需任何 node_modules 依赖。
console.log('[prepare-agent] building weila-work-cli (self-contained bundle)...')
execSync('pnpm run build', { cwd: cliDir, stdio: 'inherit' })
const cliDistSrc = path.join(cliDir, 'dist')
if (!fs.existsSync(path.join(cliDistSrc, 'cli.mjs')))
  throw new Error(`[prepare-agent] cli build 未产出 ${path.join(cliDistSrc, 'cli.mjs')}`)

// --- 3. 组装最小自包含 agent-deploy（全真实文件、无 pnpm、无软链接）---
console.log('[prepare-agent] assembling self-contained agent-deploy...')
fs.mkdirSync(deployDir, { recursive: true })

// 3a. server bundle
fs.cpSync(outputSrc, path.join(deployDir, '.output'), { recursive: true })

// 3b. CLI 放到 node_modules/weila-work-cli，供 agent 运行期 import.meta.resolve('weila-work-cli')
//     定位（Node 从 .output/server/_libs 逐级向上找 node_modules）。只需 package.json + dist。
const cliPkgDst = path.join(deployDir, 'node_modules', 'weila-work-cli')
fs.mkdirSync(cliPkgDst, { recursive: true })
fs.copyFileSync(path.join(cliDir, 'package.json'), path.join(cliPkgDst, 'package.json'))
fs.cpSync(cliDistSrc, path.join(cliPkgDst, 'dist'), { recursive: true })

// 3c. .env（dev + prod 都读；缺失则用环境变量或空 key 兜底）
const envSrc = path.join(agentDir, '.env')
fs.writeFileSync(
  path.join(deployDir, '.env'),
  fs.existsSync(envSrc)
    ? fs.readFileSync(envSrc, 'utf-8')
    : `DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY || ''}\n`,
)

// --- 4. 体检：自包含（0 软链接 / 0 .node）+ CLI 就位 ---
const symlinks = []
const natives = []
;(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isSymbolicLink())
      symlinks.push(path.relative(deployDir, p))
    else if (e.isDirectory())
      scan(p)
    else if (e.name.endsWith('.node'))
      natives.push(path.relative(deployDir, p))
  }
})(deployDir)
if (symlinks.length)
  throw new Error(`[prepare-agent] 残留 ${symlinks.length} 个软链接，产物不自包含:\n${symlinks.slice(0, 10).join('\n')}`)
if (natives.length)
  throw new Error(`[prepare-agent] 残留 ${natives.length} 个 .node 原生件:\n${natives.slice(0, 10).join('\n')}`)
if (!fs.existsSync(path.join(cliPkgDst, 'dist', 'cli.mjs')))
  throw new Error('[prepare-agent] weila-work-cli/dist/cli.mjs 缺失')
console.log('[prepare-agent] 体检通过：自包含（0 软链接 / 0 .node）+ CLI 就位 ✓')

console.log('[prepare-agent] done:', deployDir)
