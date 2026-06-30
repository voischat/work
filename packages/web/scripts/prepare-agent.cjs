const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const agentDir = path.resolve(__dirname, '../../agent')
const deployDir = path.resolve(__dirname, '../../agent-deploy')
const rootDir = path.resolve(__dirname, '../..')

function rmrf(dir) {
  if (fs.existsSync(dir))
    fs.rmSync(dir, { recursive: true, force: true })
}

function copyDir(src, dst) {
  fs.cpSync(src, dst, { recursive: true, dereference: true, force: true })
}

// 清理旧的
rmrf(deployDir)
rmrf(path.join(rootDir, 'agent-deploy'))
rmrf(path.join(rootDir, 'deploy-temp'))

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weila-agent-deploy-'))

console.log('[prepare-agent] deploying agent dependencies...')
try {
  execSync(`pnpm --filter weila-work-agent deploy --legacy --prod "${tmpDir}"`, {
    cwd: rootDir,
    stdio: 'inherit',
  })

  // pnpm deploy 会生成一些嵌套空目录（agent-deploy、packages），清理掉
  rmrf(path.join(tmpDir, 'agent-deploy'))
  rmrf(path.join(tmpDir, 'packages'))

  // 复制到目标位置（跨文件系统时 rename 会失败）
  copyDir(tmpDir, deployDir)
}
finally {
  rmrf(tmpDir)
}

// 写入 .env：优先使用本地 packages/agent/.env
const envDst = path.join(deployDir, '.env')
const envSrc = path.join(agentDir, '.env')
let envContent = 'DEEPSEEK_API_KEY=\n'
if (fs.existsSync(envSrc))
  envContent = fs.readFileSync(envSrc, 'utf-8')
else if (process.env.DEEPSEEK_API_KEY)
  envContent = `DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY}\n`

fs.writeFileSync(envDst, envContent)

console.log('[prepare-agent] done:', deployDir)
