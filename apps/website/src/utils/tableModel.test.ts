import type { TableColumn } from './tableModel'
import { describe, expect, it } from 'vitest'
import { filterRows } from './tableModel'

interface Row {
  id: number
  type: number
  dept_id: number
}

const rows: Row[] = [
  { id: 1, type: 0, dept_id: 67 },
  { id: 2, type: 1, dept_id: 68 },
  { id: 3, type: 2, dept_id: 67 },
  { id: 4, type: 255, dept_id: 68 },
]

const columns: TableColumn<Row>[] = [
  {
    key: 'member_types',
    title: 'type',
    filter: {
      options: [],
      predicate: (values, row) => row.type === Number(values[0]),
    },
  },
  {
    key: 'dept_ids',
    title: 'department',
    filter: {
      multiple: true,
      options: [],
      predicate: (values, row) => values.includes(row.dept_id),
    },
  },
  { key: 'name', title: 'name' },
]

describe('filterRows', () => {
  it('returns the same rows when no filter is applied', () => {
    expect(filterRows(rows, columns, {})).toBe(rows)
  })

  it('keeps rows matching a single-select filter', () => {
    expect(filterRows(rows, columns, {
      member_types: [0],
    })).toEqual([rows[0]])
  })

  it('keeps rows matching any value of a multi-select filter', () => {
    expect(filterRows(rows, columns, {
      dept_ids: [67],
    })).toEqual([rows[0], rows[2]])
  })

  it('combines filters from several columns', () => {
    expect(filterRows(rows, columns, {
      member_types: [2],
      dept_ids: [68],
    })).toEqual([])
  })

  it('ignores an empty selection', () => {
    expect(filterRows(rows, columns, { member_types: [] })).toBe(rows)
  })

  it('ignores filters on columns without a filter definition', () => {
    expect(filterRows(rows, columns, {
      name: ['1'],
    })).toBe(rows)
  })
})
