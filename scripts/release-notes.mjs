import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { generate, sendRelease } from 'changelogithub'
import { resolveTarget } from './release-targets.mjs'

const tag = process.env.GITHUB_REF_NAME ?? ''
const target = resolveTarget(tag)
const version = target ? target.version : tag.replace(/^v/, '')
const options = {
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
await sendRelease(config, output)
