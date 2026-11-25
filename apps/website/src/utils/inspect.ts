import { isFunction } from '@antfu/utils'

export function $inspect(...args: MaybeRefOrGetter[]) {
  let logFn = console.log
  const type: 'init' | 'update' = 'update'

  if (import.meta.env.DEV) {
    watchImmediate(args, (cur) => {
      logFn(type, ...cur.map((arg) => {
        return isFunction(arg)
          ? arg()
          : unref(arg)
      }))
    })
  }

  return {
    with(fn: (type: string, ...args: any) => void) {
      logFn = fn
    },
  } as const
}
