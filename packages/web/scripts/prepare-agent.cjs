const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '../..')
const deployDir = path.resolve(rootDir, 'agent-deploy')
const agentDir = path.resolve(rootDir, 'packages/agent')

// Clean old
fs.rmSync(deployDir, { recursive: true, force: true })

console.log('[prepare-agent] deploying agent production deps...')
execSync(`pnpm --filter weila-work-agent deploy --legacy --prod "${deployDir}"`, {
  cwd: rootDir,
  stdio: 'inherit',
})

// pnpm deploy may create spurious nested dirs
for (const d of ['agent-deploy', 'packages']) {
  const p = path.join(deployDir, d)
  if (fs.existsSync(p))
    fs.rmSync(p, { recursive: true, force: true })
}

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
