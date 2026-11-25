import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { resolveTarget } from './release-targets.mjs'

const tag = process.env.GITHUB_REF_NAME ?? ''

if (resolveTarget(tag) || !tag.startsWith('v')) {
  console.log(`No website archive for ${tag}`)
  process.exit(0)
}

const version = tag.slice(1)
const manifest = JSON.parse(readFileSync('apps/website/package.json', 'utf8'))

if (manifest.version !== version) {
  throw new Error(`${manifest.name} is ${manifest.version}, but the tag says ${version}`)
}

execFileSync('pnpm', ['run', 'build:web'], { stdio: 'inherit' })

mkdirSync('pkg', { recursive: true })
const archive = resolve('pkg', `${manifest.name}_${version}.tar.gz`)
rmSync(archive, { force: true })
execFileSync('tar', ['-czf', archive, '-C', 'apps/website/dist', '.'], { stdio: 'inherit' })
console.log(archive)
