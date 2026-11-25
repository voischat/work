import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveTarget } from './targets.ts'

void test('resolveTarget maps SDK tags to packages', () => {
  assert.deepEqual(resolveTarget('@vois/weila-sdk-core@1.2.3'), {
    prefix: '@vois/weila-sdk-core@',
    dir: 'packages/core',
    version: '1.2.3',
  })
  assert.equal(resolveTarget('@vois/weila-sdk-ui@0.1.0').version, '0.1.0')
})

void test('resolveTarget ignores app and unrelated tags', () => {
  assert.equal(resolveTarget('v3.6.1'), null)
  assert.equal(resolveTarget('nightly'), null)
})
