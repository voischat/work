import type { Member } from '~/types/api'

export interface OrgTreeSelectedItem {
  type: 'member'
  id: number
  deptId: number
  member: Member
}

export type DeptCheckState = 'unloaded' | 'loading' | 'empty' | 'none' | 'partial' | 'all'

export interface DeptCheckInput {
  loaded: boolean
  loading: boolean
  members: readonly Member[]
  selectedIds: ReadonlySet<number>
  isSelectable: (member: Member) => boolean
}

export interface DeptCheckboxView {
  checked: boolean
  indeterminate: boolean
  disabled: boolean
}

export function createSelectedItem(member: Member, deptId: number): OrgTreeSelectedItem {
  return {
    type: 'member',
    id: member.user_id,
    deptId,
    member,
  }
}

export function computeDeptCheckState(input: DeptCheckInput): DeptCheckState {
  if (input.loading)
    return 'loading'

  if (!input.loaded)
    return 'unloaded'

  const selectable = input.members.filter(input.isSelectable)
  if (!selectable.length)
    return 'empty'

  const selectedCount = selectable.filter(member => input.selectedIds.has(member.user_id)).length
  if (!selectedCount)
    return 'none'

  return selectedCount === selectable.length ? 'all' : 'partial'
}

export function toCheckboxView(state: DeptCheckState, blocked: boolean): DeptCheckboxView {
  return {
    checked: state === 'all',
    indeterminate: state === 'partial' || state === 'loading',
    disabled: state === 'loading' || state === 'empty' || blocked,
  }
}

export function toggleMemberInSelection(
  selected: OrgTreeSelectedItem[],
  member: Member,
  deptId: number,
  isSelectable: (member: Member) => boolean,
): OrgTreeSelectedItem[] {
  if (!isSelectable(member))
    return selected

  if (selected.some(item => item.id === member.user_id))
    return selected.filter(item => item.id !== member.user_id)

  return [...selected, createSelectedItem(member, deptId)]
}

export function addDeptToSelection(
  selected: OrgTreeSelectedItem[],
  members: readonly Member[],
  deptId: number,
  isSelectable: (member: Member) => boolean,
): OrgTreeSelectedItem[] {
  const knownIds = new Set(selected.map(item => item.id))
  const added: OrgTreeSelectedItem[] = []

  for (const member of members) {
    if (!isSelectable(member) || knownIds.has(member.user_id))
      continue

    knownIds.add(member.user_id)
    added.push(createSelectedItem(member, deptId))
  }

  return added.length ? [...selected, ...added] : selected
}

export function removeDeptFromSelection(
  selected: OrgTreeSelectedItem[],
  deptId: number,
  knownMemberIds: ReadonlySet<number>,
): OrgTreeSelectedItem[] {
  const next = selected.filter(item => item.deptId !== deptId && !knownMemberIds.has(item.id))
  return next.length === selected.length ? selected : next
}

export function pruneSelection(
  selected: OrgTreeSelectedItem[],
  isSelectable: (member: Member) => boolean,
): OrgTreeSelectedItem[] {
  const next = selected.filter(item => isSelectable(item.member))
  return next.length === selected.length ? selected : next
}

export function createCommitQueue(deps: {
  read: () => OrgTreeSelectedItem[]
  write: (next: OrgTreeSelectedItem[]) => void
  flush: () => Promise<void>
}): { commit: (apply: (current: OrgTreeSelectedItem[]) => OrgTreeSelectedItem[]) => Promise<void> } {
  let tail = Promise.resolve()

  function commit(apply: (current: OrgTreeSelectedItem[]) => OrgTreeSelectedItem[]): Promise<void> {
    const task = tail.then(async () => {
      const current = deps.read()
      const next = apply(current)
      if (next !== current)
        deps.write(next)
      await deps.flush()
    })
    tail = task.catch(() => {})
    return task
  }

  return { commit }
}
