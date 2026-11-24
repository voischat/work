#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies']

export function workspaceManifests(root = ROOT) {
  const paths = [join(root, 'package.json')]

  for (const group of ['packages', 'apps']) {
    let entries = []

    try {
      entries = readdirSync(join(root, group), { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (entry.isDirectory()) paths.push(join(root, group, entry.name, 'package.json'))
    }
  }

  return paths.filter((path) => existsSync(path))
}

export function catalogNames(workspaceYaml) {
  const names = new Set([''])
  let inCatalogs = false

  for (const line of workspaceYaml.split('\n')) {
    if (/^catalogs:\s*$/.test(line)) {
      inCatalogs = true
      continue
    }

    if (/^\S/.test(line)) inCatalogs = false
    if (!inCatalogs) continue

    const match = line.match(/^ {2}([^\s:]+):/)

    if (match) names.add(match[1])
  }

  return names
}

export function duplicateScriptNames(source) {
  const start = source.search(/"scripts"\s*:/)

  if (start === -1) return []

  const open = source.indexOf('{', start)
  let depth = 0
  let end = open

  for (let index = open; index < source.length; index++) {
    if (source[index] === '{') depth++
    if (source[index] === '}') depth--

    if (depth === 0) {
      end = index
      break
    }
  }

  const seen = new Map()
  const duplicates = []

  for (const match of source.slice(open, end).matchAll(/"([^"]+)"\s*:/g)) {
    const count = (seen.get(match[1]) ?? 0) + 1

    seen.set(match[1], count)

    if (count === 2) duplicates.push(match[1])
  }

  return duplicates
}

export function checkManifest({ path, manifest, catalogs = new Set(['']) }) {
  const problems = []
  const counts = new Map()

  for (const field of FIELDS) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
      const value = String(spec)

      counts.set(name, (counts.get(name) ?? 0) + 1)

      if (value.startsWith('workspace:')) continue

      if (value.startsWith('catalog:')) {
        const catalog = value.slice('catalog:'.length)

        if (!catalogs.has(catalog))
          problems.push(`${path} ${name} points at unknown catalog "${catalog}"`)

        continue
      }

      problems.push(
        `${path} ${name} pins "${value}"; declare it in pnpm-workspace.yaml and use catalog:`,
      )
    }
  }

  for (const [name, count] of counts) {
    if (count > 1) problems.push(`${path} declares ${name} in ${count} dependency fields`)
  }

  for (const name of duplicateScriptNames(manifest.__source ?? ''))
    problems.push(`${path} defines script ${name} twice`)

  if (path !== 'package.json') {
    if (!manifest.scripts?.typecheck) problems.push(`${path} has no typecheck script`)

    if (manifest.scripts?.['typecheck:tsc'] && manifest.name !== '@vois/weila-sdk-core')
      problems.push(`${path} keeps typecheck:tsc; only the core tsc parity baseline needs it`)
  }

  return problems
}

function main() {
  const catalogs = catalogNames(readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8'))
  const paths = workspaceManifests()
  const problems = []

  for (const path of paths) {
    const source = readFileSync(path, 'utf8')

    problems.push(
      ...checkManifest({
        path: relative(ROOT, path),
        manifest: { ...JSON.parse(source), __source: source },
        catalogs,
      }),
    )
  }

  for (const problem of problems) console.error(problem)

  console.log(`Manifests: ${paths.length} checked, ${problems.length} problems.`)
  process.exitCode = problems.length ? 1 : 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
