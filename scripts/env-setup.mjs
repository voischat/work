import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOME = process.env.HOME

const TARGETS = [
  { template: 'env/website.env.template', target: 'apps/website/.env' },
  { template: 'env/playground.env.template', target: 'apps/playground-vue3/.env' },
  {
    template: 'env/integration.env.template',
    target: 'packages/core/tests/integration/.env.integration',
  },
  { template: 'env/shell.env.template', target: join(HOME, '.voischat/env.sh') },
]

function fail(message) {
  console.error(message)
  process.exit(1)
}

function ensureSignedIn() {
  try {
    execFileSync('op', ['whoami'], { stdio: 'ignore' })
  } catch {
    fail(`1Password CLI is not signed in.

Unlock the 1Password desktop app and allow "op" to access it, or run:
  eval $(op signin)

Then retry: pnpm env:setup`)
  }
}

function render({ template, target }) {
  const templatePath = join(ROOT, template)

  if (!existsSync(templatePath)) fail(`Missing template: ${template}`)

  const targetPath = resolve(ROOT, target.replace(/^~/, HOME))

  mkdirSync(dirname(targetPath), { recursive: true })
  execFileSync(
    'op',
    [
      'inject',
      '--in-file',
      templatePath,
      '--out-file',
      targetPath,
      '--file-mode',
      '0600',
      '--force',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  )

  const { mode } = statSync(targetPath)

  console.log(`wrote ${targetPath.replace(`${HOME}/`, '~/')} (${(mode & 0o777).toString(8)})`)
}

ensureSignedIn()
TARGETS.forEach(render)
