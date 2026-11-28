import { describe, expect, it, vi } from 'vitest'
import { createWeilaAudioInitController } from './weila_audio_init_controller'

describe('createWeilaAudioInitController', () => {
  it('rechecks the audio state after initialization', async () => {
    const weila_audioInit = vi.fn(async () => true)

    const controller = createWeilaAudioInitController({
      getCore: () => ({ weila_audioInit }),
      targetWindow: undefined,
    })

    await expect(controller.ensureInitialized()).resolves.toBe(true)
    await expect(controller.ensureInitialized()).resolves.toBe(true)

    expect(weila_audioInit).toHaveBeenCalledTimes(2)
  })
})
