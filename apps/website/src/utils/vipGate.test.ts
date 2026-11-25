import type { VipInfo, VipSupports } from '~/stores/auth'
import { describe, expect, it } from 'vitest'
import { isPathVipGated } from './vipGate'

const ALL_SUPPORTED: VipSupports = {
  api: true,
  dept: true,
  device: true,
  group: true,
  location: true,
  member: true,
  member_batch_create: true,
  message: true,
  simcard: true,
  track: true,
  track_quick: true,
}

function vipWith(supports: Partial<VipSupports> = {}): VipInfo {
  return {
    level: 0,
    name: '',
    expired: 0,
    created: 0,
    supports: {
      ...ALL_SUPPORTED,
      ...supports,
    },
  }
}

describe('isPathVipGated', () => {
  it('gates a path that contains an unsupported flag name', () => {
    const vip = vipWith({ location: false })
    expect(isPathVipGated('/workbench/realtime-location', vip)).toBe(true)
  })

  it('leaves a path ungated when no flag name appears in it', () => {
    const vip = vipWith({ location: false })
    expect(isPathVipGated('/workbench/application', vip)).toBe(false)
  })

  it('gates by an explicit flag even when the path does not contain the flag name', () => {
    const vip = vipWith({ api: false })
    expect(isPathVipGated('/workbench/application', vip, 'api')).toBe(true)
  })

  it('does not gate by an explicit supported flag', () => {
    const vip = vipWith({ api: true })
    expect(isPathVipGated('/workbench/application', vip, 'api')).toBe(false)
  })

  it('treats a missing vip payload as ungated', () => {
    expect(isPathVipGated('/workbench/application', undefined, 'api')).toBe(false)
  })

  it('treats a payload without supports as ungated', () => {
    const vip = {
      ...vipWith(),
      supports: undefined,
    } as unknown as VipInfo
    expect(isPathVipGated('/workbench/realtime-location', vip)).toBe(false)
    expect(isPathVipGated('/workbench/application', vip, 'api')).toBe(false)
  })

  it('treats an absent flag as supported', () => {
    const vip = {
      ...vipWith(),
      supports: { track: true } as VipSupports,
    }
    expect(isPathVipGated('/workbench/realtime-location', vip)).toBe(false)
    expect(isPathVipGated('/workbench/application', vip, 'api')).toBe(false)
  })

  it('keeps the track page open when only quick tracking is locked', () => {
    const vip = vipWith({ track_quick: false })
    expect(isPathVipGated('/workbench/user-track', vip)).toBe(false)
  })
})
