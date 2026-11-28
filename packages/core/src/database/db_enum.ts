function dbEnum<T extends number>(value: number | null | undefined): T {
  // SAFETY: the proto payload carries the same numeric values the DB enums declare, so the caller-chosen enum label is restored without changing the wire value.
  return (value ?? 0) as T
}

export { dbEnum }
