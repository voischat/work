import type { VipInfo } from '~/stores/auth'

function getUnsupportedNames(vip: VipInfo | undefined): string[] {
  return vip?.vip_supports?.filter(i => !i.support).map(i => i.name) || []
}

export function isPathVipGated(path: string, vip: VipInfo | undefined): boolean {
  return getUnsupportedNames(vip).some(name => path.includes(name))
}
