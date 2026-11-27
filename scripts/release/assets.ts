import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { packageTarball } from './tarball.ts'
import { resolveTarget } from './targets.ts'

interface PackageManifest {
  name: string
  version: string
}

function readManifest(path: string, version: string): PackageManifest {
  const manifest: PackageManifest = JSON.parse(readFileSync(path, 'utf8'))

  if (manifest.version !== version) {
    throw new Error(`${manifest.name} is ${manifest.version}, but the tag says ${version}`)
  }

  return manifest
}

function pack(dir: string, version: string): string {
  const manifest = readManifest(`${dir}/package.json`, version)
  const tarball = resolve('pkg', packageTarball(manifest.name, manifest.version))

  execFileSync('pnpm', ['exec', 'turbo', 'run', 'build', `--filter=${manifest.name}`], {
    stdio: 'inherit',
  })
  rmSync(tarball, { force: true })
  execFileSync('pnpm', ['--filter', manifest.name, 'pack', '--pack-destination', 'pkg'], {
    stdio: 'inherit',
  })

  return tarball
}

function archiveWebsite(version: string): string {
  const manifest = readManifest('apps/website/package.json', version)

  execFileSync('pnpm', ['run', 'build:web'], { stdio: 'inherit' })

  const archive = resolve('pkg', `${manifest.name}_${manifest.version}.tar.gz`)

  rmSync(archive, { force: true })
  execFileSync('tar', ['-czf', archive, '-C', 'apps/website/dist', '.'], { stdio: 'inherit' })

  return archive
}

const tag = process.env.GITHUB_REF_NAME ?? ''
const target = resolveTarget(tag)

if (!target && !tag.startsWith('v')) {
  console.log(`No release assets for ${tag}`)
  process.exit(0)
}

mkdirSync('pkg', { recursive: true })
console.log(target ? pack(target.dir, target.version) : archiveWebsite(tag.slice(1)))
