interface ReleaseTarget {
  dir: string
  prefix: string
}

interface ResolvedReleaseTarget extends ReleaseTarget {
  version: string
}

const TARGETS: ReleaseTarget[] = [
  { prefix: '@vois/weila-sdk-core@', dir: 'packages/core' },
  { prefix: '@vois/weila-sdk-ui@', dir: 'packages/ui' },
]

function resolveTarget(tag: string): ResolvedReleaseTarget | null {
  const target = TARGETS.find((item) => tag.startsWith(item.prefix))

  return target ? { ...target, version: tag.slice(target.prefix.length) } : null
}

export { resolveTarget }
