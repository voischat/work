import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import process from 'node:process'
import { generate, sendRelease, uploadAssets } from 'changelogithub'
import type { ChangelogOptions } from 'changelogithub'
import { rewriteAuthors } from './authors.ts'
import { packageTarball } from './tarball.ts'
import { resolveTarget } from './targets.ts'

interface PackageManifest {
  name: string
}

const tag = process.env.GITHUB_REF_NAME ?? ''
const target = resolveTarget(tag)
const version = target ? target.version : tag.replace(/^v/, '')

function releaseAssets(): string[] {
  if (target) {
    const manifest: PackageManifest = JSON.parse(readFileSync(`${target.dir}/package.json`, 'utf8'))

    return [`pkg/${packageTarball(manifest.name, version)}`]
  }

  return tag.startsWith('v') ? [`pkg/weila-work-web_${version}.tar.gz`] : []
}

const options: ChangelogOptions = {
  repo: process.env.GITHUB_REPOSITORY ?? 'voischat/work',
  token: process.env.GITHUB_TOKEN,
  to: tag,
  tag: target ? `${target.prefix}%s` : 'v%s',
  prerelease: version.includes('-'),
}

if (target) {
  const tags = execFileSync('git', ['tag', '--list', `${target.prefix}*`, '--sort=-v:refname'], {
    encoding: 'utf8',
  }).split('\n')
  options.from =
    tags.find((item) => item && item !== tag) ??
    execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { encoding: 'utf8' }).trim()
  options.commitFilterByPaths = [target.dir]
}

const { config, output } = await generate(options)
const release = await sendRelease(config, rewriteAuthors(output))
const assets = releaseAssets()

for (const asset of assets) {
  if (!existsSync(asset)) throw new Error(`Missing ${asset}; build the release assets first.`)
}

if (assets.length) await uploadAssets(config, assets, release)
