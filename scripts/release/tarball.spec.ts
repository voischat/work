import assert from 'node:assert/strict'
import test from 'node:test'
import { packageTarball } from './tarball.ts'

void test('packageTarball follows the npm tarball naming convention', () => {
  assert.equal(packageTarball('@vois/weila-sdk-core', '1.1.5'), 'vois-weila-sdk-core-1.1.5.tgz')
  assert.equal(packageTarball('weila', '0.1.0'), 'weila-0.1.0.tgz')
})
