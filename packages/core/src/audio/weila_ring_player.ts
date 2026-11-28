import { WLConfig, WL_ConfigID } from 'main/weila_config'

let ringAudio: HTMLAudioElement | null = null

const WeilaRingPlayer = {
  ringCache: new Map<number, string>(),

  async weila_playRing(id: WL_ConfigID): Promise<boolean> {
    let url = ''

    if (this.ringCache.has(id)) {
      url = this.ringCache.get(id) ?? ''
    } else {
      const configData = await WLConfig.getConfigData(id)

      if (!configData) {
        return false
      }

      url = configData.resource_url ?? ''

      if (!url) {
        return false
      }

      this.ringCache.set(id, url)
    }

    if (!ringAudio) {
      ringAudio = document.createElement('audio')
      ringAudio.id = 'ring'
      ringAudio.preload = 'auto'
    }

    ringAudio.pause()
    ringAudio.src = url

    return ringAudio
      .play()
      .then(() => true)
      .catch(() => false)
  },
}

export default WeilaRingPlayer
