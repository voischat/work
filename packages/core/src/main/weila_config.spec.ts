import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WLConfig } from './weila_config'

interface FakeXHRNext {
  status: number
  response: Blob | null
}

class FakeXHR {
  static DONE = 4
  static next: FakeXHRNext = { status: 200, response: null }

  public readyState = 0
  public status = 0
  public statusText = ''
  public response: Blob | null = null
  public responseType = ''
  public onloadend: (() => void) | null = null
  public open = vi.fn()
  public addEventListener = vi.fn()
  public send = vi.fn(() => {
    queueMicrotask(() => {
      this.readyState = FakeXHR.DONE
      this.status = FakeXHR.next.status
      this.response = FakeXHR.next.response
      this.onloadend?.()
    })
  })
}

describe('WLConfig.fetchUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects a non-2xx response instead of resolving its body', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXHR)
    FakeXHR.next = { status: 404, response: new Blob(['<html>']) }

    await expect(WLConfig.fetchUrl('/assets/start_player.wav', 'blob')).rejects.toThrow('HTTP 404')
  })
})

describe('WLConfig.loadResource', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects an asset whose body is not a WAV file', async () => {
    vi.spyOn(WLConfig, 'fetchUrl').mockResolvedValue(new Blob(['<html>']))

    await expect(WLConfig.loadResource()).rejects.toThrow('不是 WAV 文件')
  })
})
