export type TableFilterValue = string | number

interface TableFilterOption {
  label: string
  value: TableFilterValue
}

interface TableColumnFilter<Row> {
  multiple?: boolean
  options: TableFilterOption[]
  predicate: (values: TableFilterValue[], row: Row) => boolean
}

export interface TableColumn<Row> {
  key: string
  title: string
  width?: number
  fixedRight?: boolean
  filter?: TableColumnFilter<Row>
}

export type TableFilters = Record<string, TableFilterValue[]>

export function filterRows<Row>(
  rows: Row[],
  columns: TableColumn<Row>[],
  filters: TableFilters,
): Row[] {
  const active = columns.flatMap((column) => {
    const values = filters[column.key]
    return column.filter && values?.length
      ? [
          { predicate: column.filter.predicate, values },
        ]
      : []
  })

  if (!active.length)
    return rows

  return rows.filter(row => active.every(({ predicate, values }) => predicate(values, row)))
}
