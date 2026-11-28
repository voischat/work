import type { VipFlag, VipInfo } from '~/stores/auth'
import { objectEntries } from '@antfu/utils'

function getUnsupportedNames(vip: VipInfo | undefined): VipFlag[] {
  const supports = vip?.supports
  if (!supports)
    return []
  return objectEntries(supports)
    .filter(([, supported]) => !supported)
    .map(([name]) => name)
}

export function isPathVipGated(path: string, vip: VipInfo | undefined, flag?: VipFlag): boolean {
  if (!vip)
    return Boolean(flag)

  const unsupported = getUnsupportedNames(vip)
  if (flag)
    return unsupported.includes(flag)
  return unsupported.some(name => path.includes(name))
}
