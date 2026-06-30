#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SOURCE_DIR = join(ROOT, '.agents', 'skills', 'weila-work-cli')
const CLI_PACKAGE_JSON = join(ROOT, 'packages', 'cli', 'package.json')

const args = process.argv.slice(2)
const shouldPush = args.includes('--push')
const positional = args.filter(a => !a.startsWith('--'))

const TARGET_REPO = positional[0] || 'skills-weila-work-cli'
const TARGET_ROOT = resolve(positional[1] || join(ROOT, '..', TARGET_REPO))
const SKILL_NAME = 'weila-work-cli'
const SKILL_DIR = join(TARGET_ROOT, 'skills', SKILL_NAME)

function run(cmd, cwd, opts = {}) {
  return execSync(cmd, { cwd, stdio: 'inherit', ...opts })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

async function syncSkillVersion(skillMdPath, version) {
  let content = await readFile(skillMdPath, 'utf8')

  // Update metadata.version in YAML frontmatter
  content = content.replace(
    /^(metadata:\n(?:[\s\S]*?\n))?  version: "[^"]+"/m,
    (match, metadataBlock) => metadataBlock ? `${metadataBlock}  version: "${version}"` : `metadata:\n  version: "${version}"`,
  )

  // Update the version hint line below frontmatter
  content = content.replace(
    /The skill is based on `weila-work-cli` v[\d.]+/,
    `The skill is based on \`weila-work-cli\` v${version}`,
  )

  await writeFile(skillMdPath, content, 'utf8')
}

async function sync() {
  if (!existsSync(SOURCE_DIR))
    throw new Error(`Source skill dir not found: ${SOURCE_DIR}`)

  // Keep skill version in sync with the CLI package version
  const cliVersion = readJson(CLI_PACKAGE_JSON).version
  const sourceSkillMd = join(SOURCE_DIR, 'SKILL.md')
  await syncSkillVersion(sourceSkillMd, cliVersion)

  const isGitRepo = existsSync(join(TARGET_ROOT, '.git'))

  if (!isGitRepo) {
    await mkdir(TARGET_ROOT, { recursive: true })
    run('git init', TARGET_ROOT)
  }

  // Remove existing skill files but keep .git, README, and other repo-level files
  const skillBase = join(TARGET_ROOT, 'skills')
  if (existsSync(skillBase))
    await rm(skillBase, { recursive: true, force: true })

  await mkdir(SKILL_DIR, { recursive: true })
  await cp(SOURCE_DIR, SKILL_DIR, { recursive: true, preserveTimestamps: true })

  // Generate a root README if none exists
  const readmePath = join(TARGET_ROOT, 'README.md')
  if (!existsSync(readmePath)) {
    const skillMd = await readFile(join(SKILL_DIR, 'SKILL.md'), 'utf8').catch(() => '')
    const nameMatch = skillMd.match(/^name:\s*(.+)$/m)
    const descriptionMatch = skillMd.match(/^description:\s*(.+)$/m)
    const name = nameMatch?.[1].trim() || SKILL_NAME
    const description = descriptionMatch?.[1].trim() || 'Agent skill for weila-work-cli'

    await writeFile(
      readmePath,
      `# ${name}\n\n${description}\n\nThis repository is auto-synced from \`weila-work/.agents/skills/${SKILL_NAME}\`.\n\n## Install\n\n\`\`\`bash\nnpx skills add kvoon9/${TARGET_REPO}\n\`\`\`\n`,
    )
  }

  // Commit
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

  console.log(`\nSynced skill to: ${SKILL_DIR}`)

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
