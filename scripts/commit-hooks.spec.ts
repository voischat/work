import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

void test('pre-commit runs nano-staged through simple-git-hooks', () => {
  assert.equal(manifest['simple-git-hooks']['pre-commit'], 'pnpm exec nano-staged')
  assert.equal(manifest.scripts.prepare, 'simple-git-hooks')
})

void test('staged SDK code runs ls-lint, oxlint and oxfmt --check', () => {
  const staged = manifest['nano-staged']
  for (const glob of [
    'packages/**/*.{js,jsx,ts,tsx,mjs,cjs,vue}',
    'apps/playground-vue3/**/*.{js,jsx,ts,tsx,mjs,cjs,vue}',
  ]) {
    assert.deepEqual(staged[glob], ['ls-lint', 'oxlint --type-aware', 'oxfmt --check'])
  }
  assert.equal(staged['packages/**/*.{json,jsonc,md,mdx,css,pcss,html,yml,yaml}'], 'oxfmt --check')
})

void test('staged website code runs ls-lint and eslint --fix', () => {
  assert.deepEqual(
    manifest['nano-staged'][
      'apps/website/**/*.{js,jsx,ts,tsx,mjs,cjs,vue,md,mdx,css,pcss,html,json,jsonc,yml,yaml}'
    ],
    ['ls-lint', 'eslint --fix'],
  )
})

void test('lint-staged is fully removed', () => {
  assert.equal(manifest['lint-staged'], undefined)
  assert.equal(manifest.devDependencies['lint-staged'], undefined)
})
