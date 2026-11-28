import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const CORE_ASSETS = 'packages/core/src/assets'
const RING_TONES = ['start_player.wav', 'start_record.wav', 'stop_player.wav', 'stop_record.wav']
const APP_PUBLIC_DIRS = ['apps/website/public', 'apps/playground-vue3/public']

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function isWav(path: string): boolean {
  const bytes = readFileSync(path)

  return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE'
}

for (const dir of APP_PUBLIC_DIRS) {
  void test(`${dir} mirrors the SDK audio assets`, () => {
    const assetDir = join(dir, 'assets')

    assert.deepEqual(readdirSync(assetDir).toSorted(), RING_TONES.toSorted())

    for (const name of RING_TONES) {
      const shipped = join(assetDir, name)
      const source = join(CORE_ASSETS, name)

      assert.ok(isWav(shipped), `${shipped} is not a WAV file`)
      assert.equal(sha256(shipped), sha256(source), `${shipped} differs from ${source}`)
    }

    assert.equal(
      sha256(join(dir, 'opuslibs.wasm')),
      sha256(join(CORE_ASSETS, 'opuslibs.wasm')),
      `${dir}/opuslibs.wasm differs from ${CORE_ASSETS}/opuslibs.wasm`,
    )
  })
}
