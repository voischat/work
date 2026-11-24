import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { $, echo } from 'zx'
import { name as pkgName, version } from '../package.json'

const releasesRepo = process.env.GH_REPO_RELEASES

if (!releasesRepo)
  throw new Error('set GH_REPO_RELEASES to the release repository (owner/repo)')
const sourceRepo = 'voischat/work'
const tag = `v${version}`
const filepath = resolve('pkg', `${pkgName}_${version}.tar.gz`)

if (!existsSync(filepath))
  throw new Error(`Missing ${filepath}. Run pnpm run build && pnpm run archive first.`)

$.verbose = false

const previousTag = await $`git describe --tags --abbrev=0 ${tag}^`.nothrow()
const previous = previousTag.exitCode === 0
  ? previousTag.stdout.trim()
  : null
const notes = previous
  ? `[Compare ${previous}...${tag}](https://github.com/${sourceRepo}/compare/${previous}...${tag})`
  : `Release ${tag} of ${pkgName}.`

const existing = await $`gh release view ${tag} -R ${releasesRepo}`.nothrow()

if (existing.exitCode === 0) {
  await $`gh release upload ${tag} ${filepath} -R ${releasesRepo} --clobber`
  await $`gh release edit ${tag} -R ${releasesRepo} --notes ${notes}`
}
else {
  await $`gh release create ${tag} ${filepath} -R ${releasesRepo} --title ${tag} --notes ${notes}`
}

echo`Uploaded ${filepath} to ${releasesRepo} ${tag}`
