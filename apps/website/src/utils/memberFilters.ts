const MEMBER_LIST_FILTER_KEYS = ['member_types', 'dept_ids'] as const

export type MemberListFilters = Partial<Record<typeof MEMBER_LIST_FILTER_KEYS[number], number[]>>

export function toMemberListFilters(filters: Record<string, string[] | undefined>): MemberListFilters {
  const result: MemberListFilters = {}

  for (const filterKey of MEMBER_LIST_FILTER_KEYS) {
    const values = filters[filterKey]

    if (values?.length)
      result[filterKey] = values.map(Number)
  }

  return result
}
