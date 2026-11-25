import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { catalogNames, checkManifest, duplicateScriptNames } from './manifest-checks.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalogs = catalogNames(readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8'))

void test('catalog names include the default and named catalogs', () => {
  assert.ok(catalogs.has(''))
  assert.ok(catalogs.has('native'))
  assert.ok(catalogs.has('web'))
})

void test('checkManifest accepts catalog and workspace specs', () => {
  const problems = checkManifest({
    path: 'packages/example/package.json',
    manifest: {
      name: '@vois/example',
      scripts: { typecheck: 'tsrs --noEmit --fast' },
      dependencies: { vue: 'catalog:', router: 'catalog:web' },
      devDependencies: { '@vois/weila-sdk-core': 'workspace:*' },
    },
    catalogs,
  })

  assert.deepEqual(problems, [])
})

void test('checkManifest rejects a literal version', () => {
  const problems = checkManifest({
    path: 'packages/example/package.json',
    manifest: { scripts: { typecheck: 'tsc' }, dependencies: { vue: '^3.5.0' } },
    catalogs,
  })

  assert.match(problems.join('\n'), /vue pins "\^3\.5\.0"/)
})

void test('checkManifest rejects an unknown catalog', () => {
  const problems = checkManifest({
    path: 'packages/example/package.json',
    manifest: { scripts: { typecheck: 'tsc' }, dependencies: { vue: 'catalog:missing' } },
    catalogs,
  })

  assert.match(problems.join('\n'), /unknown catalog "missing"/)
})

void test('checkManifest rejects one package in two dependency fields', () => {
  const problems = checkManifest({
    path: 'packages/example/package.json',
    manifest: {
      scripts: { typecheck: 'tsc' },
      dependencies: { vue: 'catalog:' },
      devDependencies: { vue: 'catalog:' },
    },
    catalogs,
  })

  assert.match(problems.join('\n'), /declares vue in 2 dependency fields/)
})

void test('typecheck:tsc is reserved for the core baseline', () => {
  const withBaseline = checkManifest({
    path: 'packages/example/package.json',
    manifest: { name: '@vois/example', scripts: { typecheck: 'a', 'typecheck:tsc': 'b' } },
    catalogs,
  })
  const coreBaseline = checkManifest({
    path: 'packages/core/package.json',
    manifest: { name: '@vois/weila-sdk-core', scripts: { typecheck: 'a', 'typecheck:tsc': 'b' } },
    catalogs,
  })

  assert.match(withBaseline.join('\n'), /keeps typecheck:tsc/)
  assert.deepEqual(coreBaseline, [])
})

void test('duplicateScriptNames finds a repeated script key', () => {
  const source = '{"scripts":{"typecheck":"a","typecheck":"b"}}'

  assert.deepEqual(duplicateScriptNames(source), ['typecheck'])
})
