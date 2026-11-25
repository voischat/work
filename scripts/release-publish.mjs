import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { resolveTarget } from './release-targets.mjs'

const tag = process.env.GITHUB_REF_NAME ?? ''
const target = resolveTarget(tag)

if (!target) {
  console.log(`No npm package is released by ${tag}`)
  process.exit(0)
}

const version = target.version
const manifest = JSON.parse(readFileSync(`${target.dir}/package.json`, 'utf8'))

function isPublished(name, range) {
  try {
    execFileSync('npm', ['view', `${name}@${range}`, 'version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (isPublished(manifest.name, version)) {
  console.log(`${manifest.name}@${version} is already published`)
  process.exit(0)
}

if (target.dir === 'packages/ui') {
  const coreVersion = JSON.parse(readFileSync('packages/core/package.json', 'utf8')).version

  if (!isPublished('@vois/weila-sdk-core', coreVersion)) {
    throw new Error(`@vois/weila-sdk-core@${coreVersion} must be published before the UI package`)
  }
}

execFileSync('pnpm', ['exec', 'turbo', 'run', 'build', `--filter=${manifest.name}`], {
  stdio: 'inherit',
})
const args = [
  '--filter',
  manifest.name,
  'publish',
  '--access',
  'public',
  '--provenance',
  '--no-git-checks',
]

if (version.includes('-')) args.push('--tag', 'next')

execFileSync('pnpm', args, { stdio: 'inherit', env: process.env })
