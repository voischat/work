#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SKILL_NAME = 'weila-work-cli'
const SOURCE_DIR = join(ROOT, 'packages', 'cli', 'skills', SKILL_NAME)
const LOCAL_AGENT_DIR = join(ROOT, '.agents', 'skills', SKILL_NAME)
const CLI_PACKAGE_JSON = join(ROOT, 'packages', 'cli', 'package.json')

const args = process.argv.slice(2)
const shouldPush = args.includes('--push')
const positional = args.filter(a => !a.startsWith('--'))

const TARGET_REPO = positional[0] || 'skills-weila-work-cli'
const TARGET_ROOT = resolve(positional[1] || join(ROOT, '..', TARGET_REPO))
const TARGET_SKILL_DIR = join(TARGET_ROOT, 'skills', SKILL_NAME)

function run(cmd, cwd, opts = {}) {
  return execSync(cmd, { cwd, stdio: 'inherit', ...opts })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

async function syncSkillVersion(skillMdPath, version) {
  let content = await readFile(skillMdPath, 'utf8')

  content = content.replace(
    /^(metadata:\n(?:[\s\S]*?\n))?  version: "[^"]+"/m,
    (match, metadataBlock) => metadataBlock ? `${metadataBlock}  version: "${version}"` : `metadata:\n  version: "${version}"`,
  )

  content = content.replace(
    /The skill is based on `weila-work-cli` v[\d.]+/,
    `The skill is based on \`weila-work-cli\` v${version}`,
  )

  await writeFile(skillMdPath, content, 'utf8')
}

async function mirror(source, dest) {
  if (existsSync(dest))
    await rm(dest, { recursive: true, force: true })
  await mkdir(dirname(dest), { recursive: true })
  await cp(source, dest, { recursive: true, preserveTimestamps: true })
}

async function sync() {
  if (!existsSync(SOURCE_DIR))
    throw new Error(`Source skill dir not found: ${SOURCE_DIR}`)

  // Keep skill version in sync with the CLI package version
  const cliVersion = readJson(CLI_PACKAGE_JSON).version
  const sourceSkillMd = join(SOURCE_DIR, 'SKILL.md')
  await syncSkillVersion(sourceSkillMd, cliVersion)

  // 1. Mirror to local agent directory so the current agent loads the latest skill
  await mirror(SOURCE_DIR, LOCAL_AGENT_DIR)
  console.log(`Synced skill to local agent: ${LOCAL_AGENT_DIR}`)

  // 2. Mirror to the standalone skill repo
  const isGitRepo = existsSync(join(TARGET_ROOT, '.git'))
  if (!isGitRepo) {
    await mkdir(TARGET_ROOT, { recursive: true })
    run('git init', TARGET_ROOT)
  }

  await mirror(SOURCE_DIR, TARGET_SKILL_DIR)

  // Generate a root README if none exists
  const readmePath = join(TARGET_ROOT, 'README.md')
  if (!existsSync(readmePath)) {
    const skillMd = await readFile(join(TARGET_SKILL_DIR, 'SKILL.md'), 'utf8').catch(() => '')
    const nameMatch = skillMd.match(/^name:\s*(.+)$/m)
    const descriptionMatch = skillMd.match(/^description:\s*(.+)$/m)
    const name = nameMatch?.[1].trim() || SKILL_NAME
    const description = descriptionMatch?.[1].trim() || 'Agent skill for weila-work-cli'

    await writeFile(
      readmePath,
      `# ${name}\n\n${description}\n\nThis repository is auto-synced from \`weila-work/packages/cli/skills/${SKILL_NAME}\`.\n\n## Install\n\n\`\`\`bash\nnpx skills add kvoon9/${TARGET_REPO}\n\`\`\`\n`,
    )
  }

  // Commit in the standalone repo
  try {
    run('git add -A', TARGET_ROOT, { stdio: 'pipe' })
    const status = execSync('git status --porcelain', { cwd: TARGET_ROOT, encoding: 'utf8' })
    if (status.trim()) {
      const now = new Date().toISOString()
      run(`git commit -m "sync: update skill from weila-work at ${now}"`, TARGET_ROOT)
    }
    else {
      console.log('No changes to commit.')
    }
  }
  catch (err) {
    console.warn('Git commit skipped:', err.message)
  }

  console.log(`Synced skill to standalone repo: ${TARGET_SKILL_DIR}`)

  if (shouldPush) {
    const remoteExists = execSync('git remote', { cwd: TARGET_ROOT, encoding: 'utf8' }).trim()
    if (!remoteExists) {
      console.log(`\nCreating GitHub repo kvoon9/${TARGET_REPO} and pushing...`)
      run(`gh repo create kvoon9/${TARGET_REPO} --public --source=. --push`, TARGET_ROOT)
    }
    else {
      console.log('\nPushing to existing remote...')
      run('git push', TARGET_ROOT)
    }
  }
}

sync().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
