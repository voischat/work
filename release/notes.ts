import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { generate, sendRelease, uploadAssets } from 'changelogithub'
import type { ChangelogOptions } from 'changelogithub'
import { rewriteAuthors } from './authors.ts'
import { resolveTarget } from './targets.ts'

const tag = process.env.GITHUB_REF_NAME ?? ''
const target = resolveTarget(tag)
const version = target ? target.version : tag.replace(/^v/, '')
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

if (!target && tag.startsWith('v')) {
  const archive = `pkg/weila-work-web_${version}.tar.gz`

  if (!existsSync(archive)) throw new Error(`Missing ${archive}; build the website archive first.`)

  await uploadAssets(config, [archive], release)
}
