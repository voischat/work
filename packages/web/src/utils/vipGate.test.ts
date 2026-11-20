import type { VipInfo } from '~/stores/auth'
import { describe, expect, it } from 'vitest'
import { isPathVipGated } from './vipGate'

function vipWith(supports: Array<{ name: string, support: boolean }>): VipInfo {
  return {
    vip: 0,
    vip_name: '',
    vip_expired: 0,
    vip_created: 0,
    vip_supports: supports,
  }
}

describe('isPathVipGated', () => {
  it('gates a path that contains an unsupported flag name', () => {
    const vip = vipWith([
      { name: 'location', support: false },
    ])
    expect(isPathVipGated('/workbench/realtime-location', vip)).toBe(true)
  })

  it('leaves a path ungated when no flag name appears in it', () => {
    const vip = vipWith([
      { name: 'location', support: false },
    ])
    expect(isPathVipGated('/workbench/application', vip)).toBe(false)
  })

  it('gates by an explicit flag even when the path does not contain the flag name', () => {
    const vip = vipWith([
      { name: 'api', support: false },
    ])
    expect(isPathVipGated('/workbench/application', vip, 'api')).toBe(true)
  })

  it('does not gate by an explicit supported flag', () => {
    const vip = vipWith([
      { name: 'api', support: true },
    ])
    expect(isPathVipGated('/workbench/application', vip, 'api')).toBe(false)
  })

  it('treats a missing vip payload as ungated', () => {
    expect(isPathVipGated('/workbench/application', undefined, 'api')).toBe(false)
  })
})
