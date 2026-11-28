import { afterEach, describe, expect, it, vi } from 'vitest'
import { WL_ConfigID, WLConfig } from 'main/weila_config'
import WeilaRingPlayer from './weila_ring_player'

describe('WeilaRingPlayer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves false when the ring cannot play', async () => {
    vi.spyOn(WLConfig, 'getConfigData').mockResolvedValue({
      resource_url: 'data:audio/wav;base64,',
      version: 1,
      latestTime: 0,
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'))

    await expect(
      WeilaRingPlayer.weila_playRing(WL_ConfigID.WL_RES_RING_START_PLAY_ID),
    ).resolves.toBe(false)
  })
})
