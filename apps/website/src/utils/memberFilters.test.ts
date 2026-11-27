import { describe, expect, it } from 'vitest'
import { toMemberListFilters } from './memberFilters'

describe('toMemberListFilters', () => {
  it('converts member_types string values to numbers', () => {
    expect(toMemberListFilters({
      member_types: ['0'],
    })).toEqual({
      member_types: [0],
    })
  })

  it('converts several dept_ids to numbers', () => {
    expect(toMemberListFilters({
      dept_ids: ['67', '68'],
    })).toEqual({
      dept_ids: [67, 68],
    })
  })

  it('converts both known keys', () => {
    expect(toMemberListFilters({
      member_types: ['1', '2'],
      dept_ids: ['67'],
    })).toEqual({
      member_types: [1, 2],
      dept_ids: [67],
    })
  })

  it('drops an empty filter array', () => {
    expect(toMemberListFilters({
      member_types: [],
      dept_ids: ['67'],
    })).toEqual({
      dept_ids: [67],
    })
  })

  it('drops keys outside the member list API', () => {
    expect(toMemberListFilters({
      group_ids: ['3'],
      member_types: ['255'],
    })).toEqual({
      member_types: [255],
    })
  })
})
