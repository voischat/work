// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- callers choose the enum label restored on the value
function dbEnum<T extends number>(value: number | null | undefined): T {
  // SAFETY: these DB enums label the same numeric values the proto payload carries, so restoring the
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see the SAFETY note above
  return (value ?? 0) as T
}

export { dbEnum }
