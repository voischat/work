import type { OrgTreeSelectedItem } from './orgTreeSelection'
import type { Member } from '~/types/api'
import { describe, expect, it } from 'vitest'
import {
  addDeptToSelection,
  computeDeptCheckState,
  createCommitQueue,
  createSelectedItem,
  pruneSelection,
  removeDeptFromSelection,
  toCheckboxView,
  toggleMemberInSelection,
} from './orgTreeSelection'

function member(userId: number, overrides: Partial<Member> = {}): Member {
  return {
    user_id: userId,
    user_num: `num-${userId}`,
    job_num: `job-${userId}`,
    sex: 0,
    name: `Member ${userId}`,
    avatar: '',
    is_dept_admin: 0,
    dept_id: 0,
    phone: '',
    country_code: '',
    state: 0,
    type: 0,
    tts: 0,
    loc_share: 0,
    track: 0,
    group_count: 0,
    created: 0,
    grp_cnt: 0,
    grp_lmt: 0,
    product: '',
    imei: '',
    ...overrides,
  }
}

function item(userId: number, deptId = 1): OrgTreeSelectedItem {
  return createSelectedItem(member(userId), deptId)
}

function ids(selected: OrgTreeSelectedItem[]) {
  return selected.map(entry => entry.id)
}

describe('computeDeptCheckState', () => {
  it('is unloaded before a successful fetch', () => {
    expect(computeDeptCheckState({
      loaded: false,
      loading: false,
      members: [],
      selectedIds: new Set(),
      isSelectable: () => true,
    })).toBe('unloaded')
  })

  it('is loading while a fetch is in flight', () => {
    expect(computeDeptCheckState({
      loaded: false,
      loading: true,
      members: [
        member(1),
      ],
      selectedIds: new Set(),
      isSelectable: () => true,
    })).toBe('loading')
  })

  it('is empty when the department has no members', () => {
    expect(computeDeptCheckState({
      loaded: true,
      loading: false,
      members: [],
      selectedIds: new Set(),
      isSelectable: () => true,
    })).toBe('empty')
  })

  it('is empty when no member is selectable', () => {
    expect(computeDeptCheckState({
      loaded: true,
      loading: false,
      members: [
        member(1),
        member(2),
      ],
      selectedIds: new Set([1]),
      isSelectable: () => false,
    })).toBe('empty')
  })

  it('is none when no selectable member is selected', () => {
    expect(computeDeptCheckState({
      loaded: true,
      loading: false,
      members: [
        member(1),
        member(2),
      ],
      selectedIds: new Set(),
      isSelectable: () => true,
    })).toBe('none')
  })

  it('is partial when some selectable members are selected', () => {
    expect(computeDeptCheckState({
      loaded: true,
      loading: false,
      members: [
        member(1),
        member(2),
      ],
      selectedIds: new Set([1]),
      isSelectable: () => true,
    })).toBe('partial')
  })

  it('is all when every selectable member is selected', () => {
    expect(computeDeptCheckState({
      loaded: true,
      loading: false,
      members: [
        member(1),
        member(2),
      ],
      selectedIds: new Set([1, 2]),
      isSelectable: () => true,
    })).toBe('all')
  })

  it('excludes disabled members from the denominator', () => {
    expect(computeDeptCheckState({
      loaded: true,
      loading: false,
      members: [
        member(1),
        member(2),
      ],
      selectedIds: new Set([2]),
      isSelectable: entry => entry.user_id === 2,
    })).toBe('all')
  })

  it('ignores selected ids that are absent from the member list', () => {
    expect(computeDeptCheckState({
      loaded: true,
      loading: false,
      members: [
        member(1),
        member(2),
      ],
      selectedIds: new Set([99]),
      isSelectable: () => true,
    })).toBe('none')
  })
})

describe('toCheckboxView', () => {
  it('leaves an unloaded department clickable and unchecked', () => {
    expect(toCheckboxView('unloaded', false)).toEqual({
      checked: false,
      indeterminate: false,
      disabled: false,
    })
  })

  it('shows a disabled indeterminate checkbox while loading', () => {
    expect(toCheckboxView('loading', false)).toEqual({
      checked: false,
      indeterminate: true,
      disabled: true,
    })
  })

  it('disables a department with no selectable members', () => {
    expect(toCheckboxView('empty', false)).toEqual({
      checked: false,
      indeterminate: false,
      disabled: true,
    })
  })

  it('leaves a fully unselected department clickable', () => {
    expect(toCheckboxView('none', false)).toEqual({
      checked: false,
      indeterminate: false,
      disabled: false,
    })
  })

  it('keeps partial unchecked so a click selects the remaining members', () => {
    expect(toCheckboxView('partial', false)).toEqual({
      checked: false,
      indeterminate: true,
      disabled: false,
    })
  })

  it('checks a fully selected department', () => {
    expect(toCheckboxView('all', false)).toEqual({
      checked: true,
      indeterminate: false,
      disabled: false,
    })
  })

  it('disables every state while the blocked flag is set', () => {
    expect(toCheckboxView('none', true).disabled).toBe(true)
    expect(toCheckboxView('all', true)).toEqual({
      checked: true,
      indeterminate: false,
      disabled: true,
    })
  })
})

describe('createSelectedItem', () => {
  it('sets the type and user id and keeps the member object', () => {
    const entry = member(7)

    expect(createSelectedItem(entry, 3)).toEqual({
      type: 'member',
      id: 7,
      deptId: 3,
      member: entry,
    })
  })
})

describe('toggleMemberInSelection', () => {
  it('adds an unselected member', () => {
    const entry = member(1)

    expect(toggleMemberInSelection([], entry, 4, () => true)).toEqual([
      {
        type: 'member',
        id: 1,
        deptId: 4,
        member: entry,
      },
    ])
  })

  it('removes a selected member by user id', () => {
    const selected = [
      item(1, 4),
    ]

    expect(toggleMemberInSelection(selected, member(1), 4, () => true)).toEqual([])
  })

  it('refuses a non-selectable member with the same reference', () => {
    const selected = [
      item(1),
    ]

    expect(toggleMemberInSelection(selected, member(2), 1, () => false)).toBe(selected)
  })

  it('does not mutate the input', () => {
    const selected = [
      item(1),
    ]

    toggleMemberInSelection(selected, member(2), 1, () => true)

    expect(ids(selected)).toEqual([1])
  })
})

describe('addDeptToSelection', () => {
  it('adds every selectable member that is not selected yet', () => {
    const selected = [
      item(1, 1),
    ]

    expect(ids(addDeptToSelection(selected, [
      member(1),
      member(2),
      member(3),
    ], 2, () => true))).toEqual([1, 2, 3])
  })

  it('filters out non-selectable members', () => {
    const result = addDeptToSelection([], [
      member(1),
      member(2),
    ], 2, entry => entry.user_id === 2)

    expect(ids(result)).toEqual([2])
  })

  it('dedupes repeated members in the input list', () => {
    expect(ids(addDeptToSelection([], [
      member(2),
      member(2),
    ], 2, () => true))).toEqual([2])
  })

  it('preserves existing items and their department', () => {
    const existing = item(1, 9)
    const result = addDeptToSelection([existing], [
      member(2),
    ], 2, () => true)

    expect(result[0]).toBe(existing)
    expect(result[0].deptId).toBe(9)
  })

  it('is idempotent and returns the input reference when nothing is added', () => {
    const first = addDeptToSelection([], [
      member(1),
    ], 2, () => true)
    const second = addDeptToSelection(first, [
      member(1),
    ], 2, () => true)

    expect(second).toBe(first)
  })

  it('returns the input reference when no member is selectable', () => {
    const selected = [
      item(1),
    ]

    expect(addDeptToSelection(selected, [
      member(2),
    ], 2, () => false)).toBe(selected)
  })
})

describe('removeDeptFromSelection', () => {
  it('removes items that came from the matching department', () => {
    const selected = [
      item(1, 7),
      item(2, 8),
    ]

    expect(ids(removeDeptFromSelection(selected, 7, new Set()))).toEqual([2])
  })

  it('removes items whose id is in the known member list', () => {
    const selected = [
      item(1, 7),
      item(2, 8),
    ]

    expect(ids(removeDeptFromSelection(selected, 7, new Set([2])))).toEqual([])
  })

  it('keeps items from other departments that are not in the known list', () => {
    const selected = [
      item(1, 7),
      item(2, 8),
      item(3, 9),
    ]

    expect(ids(removeDeptFromSelection(selected, 7, new Set([2])))).toEqual([3])
  })

  it('returns the input reference when nothing matches', () => {
    const selected = [
      item(1, 7),
    ]

    expect(removeDeptFromSelection(selected, 8, new Set([2]))).toBe(selected)
  })
})

describe('pruneSelection', () => {
  it('removes items that are no longer selectable', () => {
    const selected = [
      item(1),
      item(2),
    ]

    expect(ids(pruneSelection(selected, entry => entry.user_id === 1))).toEqual([1])
  })

  it('returns the input reference when every item is selectable', () => {
    const selected = [
      item(1),
      item(2),
    ]

    expect(pruneSelection(selected, () => true)).toBe(selected)
  })
})

describe('createCommitQueue', () => {
  it('serializes concurrent commits without a lost update', async () => {
    let state: OrgTreeSelectedItem[] = []
    const queue = createCommitQueue({
      read: () => state,
      write: (next) => {
        state = next
      },
      flush: () => Promise.resolve(),
    })

    await Promise.all([
      queue.commit(current => [
        ...current,
        createSelectedItem(member(1), 1),
      ]),
      queue.commit(current => [
        ...current,
        createSelectedItem(member(2), 2),
      ]),
    ])

    expect(ids(state)).toEqual([1, 2])
    expect(state.map(entry => entry.deptId)).toEqual([1, 2])
  })

  it('skips the write when the applied result is the current reference', async () => {
    let state: OrgTreeSelectedItem[] = [
      item(1),
    ]
    let writes = 0
    const queue = createCommitQueue({
      read: () => state,
      write: (next) => {
        state = next
        writes++
      },
      flush: () => Promise.resolve(),
    })

    await queue.commit(current => current)

    expect(writes).toBe(0)
    expect(state).toEqual([
      item(1),
    ])
  })

  it('waits for the flush before starting the next commit', async () => {
    let state: OrgTreeSelectedItem[] = []
    const events: number[][] = []
    const releases: Array<() => void> = []
    const queue = createCommitQueue({
      read: () => state,
      write: (next) => {
        state = next
        events.push(ids(next))
      },
      flush: () => new Promise<void>((resolve) => {
        releases.push(resolve)
      }),
    })

    const first = queue.commit(current => [
      ...current,
      item(1),
    ])
    const second = queue.commit(current => [
      ...current,
      item(2),
    ])

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(events).toEqual([
      [1],
    ])

    releases[0]()
    await first
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(events).toEqual([
      [1],
      [1, 2],
    ])

    releases[1]()
    await second
  })
})
