import { readFileSync } from 'node:fs'
import process from 'node:process'
import { resolveTarget } from './release-targets.mjs'

const tag = process.env.GITHUB_REF_NAME ?? ''
const target = resolveTarget(tag)
const version = target ? target.version : tag.startsWith('v') ? tag.slice(1) : null

if (!version) {
  console.log(`${tag} is not a release tag`)
  process.exit(0)
}

const manifest = JSON.parse(
  readFileSync(target ? `${target.dir}/package.json` : 'apps/website/package.json', 'utf8'),
)

if (manifest.version !== version) {
  throw new Error(`${manifest.name} is ${manifest.version}, but the tag says ${version}`)
}
