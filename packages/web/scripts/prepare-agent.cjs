const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '../..')
const deployDir = path.resolve(rootDir, 'agent-deploy')
// 注意：rootDir 解析为 weila-work/packages，agent 包在 weila-work/packages/agent。
const agentDir = path.resolve(rootDir, 'agent')
// weila-work-cli 是 agent 的 workspace 依赖，运行期由 agent 子进程调用其 dist/cli.mjs。
const cliDir = path.resolve(rootDir, 'cli')

// 构建机无关（路 B）：生产只运行预构建的 .output（平台中立 JS），并只随包纯 JS 运行期依赖。
// 因此本脚本在任意平台（mac/Linux/Docker/Windows）跑都能产出可在 Windows 运行的 agent 包，
// 关键是下面会裁掉一切构建期/原生件，并体检确保不残留 .node 二进制。
console.log(`[prepare-agent] host platform: ${process.platform}/${process.arch}`)

// Clean old
fs.rmSync(deployDir, { recursive: true, force: true })

// --- 先构建预构建 agent server（.output）---
// 必须在 pnpm deploy 之前构建：deploy 会生成 agent-deploy（同名 weila-work-agent 包），
// 若此时构建会与 packages/agent 形成 workspace 同名包冲突。
//
// 强制干净重建：先清掉旧产物与 eve 的增量编译缓存，再 eve build。
// 否则改了 agent 源码后打包，可能因 eve 缓存（node_modules/.cache/eve）没完全失效
// 而把旧编译产物打进包 —— 表现为“跑了 electron:build，agent 还是旧的”。
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

// 先构建 weila-work-cli 的 dist（workspace 依赖，deploy 只拷贝其 files=["dist"]）。
// 不构建则 deploy 出的 CLI 包只有 package.json/README，运行期 import.meta.resolve
// 定位到的 dist/cli.mjs 缺失，打包后的 AI 工具调用会失败。
console.log('[prepare-agent] building weila-work-cli (dist)...')
execSync('pnpm run build', { cwd: cliDir, stdio: 'inherit' })
if (!fs.existsSync(path.join(cliDir, 'dist', 'cli.mjs')))
  throw new Error(`[prepare-agent] cli build 未产出 ${path.join(cliDir, 'dist', 'cli.mjs')}`)

// Windows 关键修复：pnpm --filter ... deploy 会在被过滤包目录下生成伪嵌套副本
// （packages/agent/packages/agent-deploy）。上一次运行残留的 bin shim 会让本次 deploy
// 在写 .bin/eve 时 EPERM 失败。这里在 deploy 前先清掉所有伪嵌套残留。
const spuriousDirs = [
  path.join(agentDir, 'packages'),
  path.join(deployDir, 'agent-deploy'),
  path.join(deployDir, 'packages'),
]
for (const p of spuriousDirs) {
  if (fs.existsSync(p))
    fs.rmSync(p, { recursive: true, force: true })
}

console.log('[prepare-agent] deploying agent production deps...')
execSync(`pnpm --filter weila-work-agent deploy --legacy --prod "${deployDir}"`, {
  cwd: rootDir,
  stdio: 'inherit',
})

// pnpm deploy may create spurious nested dirs
for (const p of spuriousDirs) {
  if (fs.existsSync(p))
    fs.rmSync(p, { recursive: true, force: true })
}

// 把构建产物拷进 deploy 目录（生产直接跑它，不再用 eve dev）
const outputDst = path.join(deployDir, '.output')
fs.rmSync(outputDst, { recursive: true, force: true })
fs.cpSync(outputSrc, outputDst, { recursive: true })
console.log('[prepare-agent] copied .output ->', outputDst)

// 运行期只跑 .output（纯 JS）+ 子进程调用 weila-work-cli（依赖 cac/md5/unstorage 纯 JS）。
// 裁掉所有仅构建期 / 原生件，让包构建机无关（不泄漏 darwin/linux/win 二进制）。
const PRUNE = [
  /^eve@/, /^nitro@/,
  /^rolldown@/, /^@rolldown\+/,
  /^rollup@/, /^@rollup\+/,
  /^esbuild@/, /^@esbuild\+/,
  /^lightningcss/,
  /^microsandbox@/, /^@superradcompany\+/,
  /^fsevents@/,
  /^better-sqlite3@/, /^@netlify\+blobs/,
  /^@ai-sdk\+/, /^ai@/, /^@upstash\+context7-sdk/,
]
const pnpmDir = path.join(deployDir, 'node_modules', '.pnpm')
if (fs.existsSync(pnpmDir)) {
  for (const entry of fs.readdirSync(pnpmDir)) {
    if (PRUNE.some(re => re.test(entry)))
      fs.rmSync(path.join(pnpmDir, entry), { recursive: true, force: true })
  }
}

// 遍历真实文件（跳过 pnpm 符号链接），删掉单可执行 SEA 与一切 .node 原生件。
// 这是“构建机无关”的硬保证：运行期不需要任何原生二进制。
function pruneNativeArtifacts(dir) {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      pruneNativeArtifacts(p)
    }
    else if (/^weila-work-cli-(macos|darwin|linux|win|windows)/i.test(e.name) || e.name.endsWith('.node')) {
      fs.rmSync(p, { force: true })
      console.log('[prepare-agent] pruned native artifact:', path.relative(deployDir, p))
    }
  }
}
pruneNativeArtifacts(path.join(deployDir, 'node_modules'))

// 产物体检：确保不残留任何 .node 原生件
const leftover = []
;(function scan(dir) {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) scan(p)
    else if (e.name.endsWith('.node')) leftover.push(path.relative(deployDir, p))
  }
})(deployDir)
if (leftover.length)
  console.warn(`[prepare-agent] 警告：仍残留 ${leftover.length} 个 .node 原生件（非预期）:\n${leftover.join('\n')}`)
else
  console.log('[prepare-agent] 产物体检通过：无 .node 原生二进制，构建机无关 ✓')

// .env
const envSrc = path.join(agentDir, '.env')
const envDst = path.join(deployDir, '.env')
fs.writeFileSync(
  envDst,
  fs.existsSync(envSrc)
    ? fs.readFileSync(envSrc, 'utf-8')
    : `DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY || ''}\n`,
)

console.log('[prepare-agent] done:', deployDir)
