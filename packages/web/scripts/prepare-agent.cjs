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

// 解引用：把 node_modules 里的软链接换成真实文件，让 agent-deploy 完全自包含。
// pnpm deploy 生成的是指向源 agent-deploy 的绝对软链接，electron-builder 原样搬运，
// 导致打包产物压缩/解压或拷到别的机器后 Node 找不到依赖（如 unstorage）→ weila-work-cli 全挂。
// 纯 Node 实现（不用 shell cp：Windows 上 execSync 走 cmd.exe 找不到 cp）。
console.log('[prepare-agent] dereferencing symlinks (self-contained node_modules)...')
function copyDeref(src, dst, chain) {
  let st
  try { st = fs.lstatSync(src) }
  catch { return }
  if (st.isSymbolicLink()) {
    let real
    try { real = fs.realpathSync(src) }
    catch { return } // 悬空软链接（被裁剪的仅构建期依赖）→ 跳过
    let rst
    try { rst = fs.statSync(real) }
    catch { return }
    if (rst.isDirectory()) {
      if (chain.includes(real)) return // 环形软链接保护
      fs.mkdirSync(dst, { recursive: true })
      for (const e of fs.readdirSync(real))
        copyDeref(path.join(real, e), path.join(dst, e), [...chain, real])
    }
    else {
      fs.copyFileSync(real, dst)
    }
  }
  else if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true })
    for (const e of fs.readdirSync(src))
      copyDeref(path.join(src, e), path.join(dst, e), chain)
  }
  else {
    fs.copyFileSync(src, dst)
  }
}
const nmDir = path.join(deployDir, 'node_modules')
const nmTmp = path.join(deployDir, 'node_modules.deref')
fs.rmSync(nmTmp, { recursive: true, force: true })
copyDeref(nmDir, nmTmp, [])
fs.rmSync(nmDir, { recursive: true, force: true })
fs.renameSync(nmTmp, nmDir)

// 自包含体检：不应再残留任何软链接
const remainingLinks = []
;(function scanLinks(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isSymbolicLink())
      remainingLinks.push(path.relative(deployDir, p))
    else if (e.isDirectory())
      scanLinks(p)
  }
})(nmDir)
if (remainingLinks.length)
  throw new Error(`[prepare-agent] 仍残留 ${remainingLinks.length} 个软链接，产物不自包含:\n${remainingLinks.slice(0, 10).join('\n')}`)
console.log('[prepare-agent] node_modules 已自包含（0 软链接）✓')

// 关键运行期依赖存在性断言：CLI 运行期需要 unstorage（真实文件），防止将来被误裁静默出错。
let unstorageOk = false
;(function findUnstorage(dir) {
  if (unstorageOk) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (unstorageOk) return
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'unstorage' && fs.existsSync(path.join(p, 'package.json')))
        unstorageOk = true
      else
        findUnstorage(p)
    }
  }
})(nmDir)
if (!unstorageOk)
  throw new Error('[prepare-agent] 未在 agent-deploy/node_modules 找到真实的 unstorage/package.json（weila-work-cli 运行期依赖缺失）')
console.log('[prepare-agent] 运行期依赖体检通过：unstorage 就位 ✓')

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
