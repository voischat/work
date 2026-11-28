<script setup lang="ts" generic="Row">
import type { TableColumn, TableFilters, TableFilterValue } from '~/utils/tableModel'
import { computed, reactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { filterRows } from '~/utils/tableModel'

import '@arco-design/web-vue/es/style/index.css'
import '@arco-design/web-vue/es/table/style/index.css'

const props = withDefaults(defineProps<{
  columns: TableColumn<Row>[]
  data: Row[]
  total: number
  pageSize?: number
  size?: 'medium' | 'large'
  fixedLayout?: boolean
}>(), {
  pageSize: 10,
  size: 'medium',
  fixedLayout: false,
})

const emit = defineEmits<{
  (e: 'rowClick', row: Row, event: MouseEvent): void
  (e: 'filterChange', filters: TableFilters): void
}>()

const page = defineModel<number>('page', { required: true })

const { t } = useI18n()

const filters = shallowRef<TableFilters>({})
const draft = reactive<Record<string, TableFilterValue[]>>({})
const openKey = shallowRef<string>()

const visibleRows = computed(() => filterRows(props.data, props.columns, filters.value))
const hasFixedRight = computed(() => props.columns.some(column => column.fixedRight))

function cellValue(row: Row, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}

function isFilterActive(key: string): boolean {
  return Boolean(filters.value[key]?.length)
}

function onFilterVisible(key: string, visible: boolean): void {
  if (visible) {
    draft[key] = [
      ...(filters.value[key] ?? []),
    ]
    openKey.value = key
    return
  }

  if (openKey.value === key)
    openKey.value = undefined
}

function setDraftValue(key: string, value: string | number | boolean): void {
  draft[key] = typeof value === 'boolean'
    ? []
    : [value]
}

function setDraftValues(key: string, values: boolean | (string | number | boolean)[]): void {
  draft[key] = Array.isArray(values)
    ? values.filter((value): value is TableFilterValue => typeof value !== 'boolean')
    : []
}

function applyFilter(key: string): void {
  const next = { ...filters.value }
  const values = draft[key] ?? []

  if (values.length)
    next[key] = [...values]
  else
    delete next[key]

  filters.value = next
  openKey.value = undefined
  emit('filterChange', next)
}

function resetFilter(key: string): void {
  draft[key] = []
  applyFilter(key)
}

function onPageChange(uiPage: number): void {
  page.value = uiPage - 1
}

function onRowClick(row: Row, event: MouseEvent): void {
  const target = event.target

  if (!(target instanceof HTMLElement))
    return
  if (!target.classList.contains('arco-table-td') && !target.classList.contains('arco-table-cell'))
    return

  emit('rowClick', row, event)
}
</script>

<template>
  <div
    class="arco-table arco-table-border arco-table-hover"
    :class="[
      `arco-table-size-${size}`,
      {
        'arco-table-empty': !visibleRows.length,
        'arco-table-layout-fixed': fixedLayout,
        'arco-table-has-fixed-col-right': hasFixedRight,
      },
    ]"
  >
    <div class="arco-table-container">
      <div class="arco-table-content arco-table-content-scroll-x">
        <table class="arco-table-element" cellpadding="0" cellspacing="0">
          <colgroup>
            <col
              v-for="column in columns"
              :key="column.key"
              :style="column.width ? { width: `${column.width}px` } : undefined"
            >
          </colgroup>
          <thead>
            <tr class="arco-table-tr">
              <th
                v-for="column in columns"
                :key="column.key"
                class="arco-table-th"
                :class="{ 'arco-table-col-fixed-right': column.fixedRight, 'arco-table-col-fixed-right-first': column.fixedRight }"
                :style="column.fixedRight ? { right: '0' } : undefined"
              >
                <span class="arco-table-cell arco-table-cell-align-left">
                  <span class="arco-table-th-title">{{ column.title }}</span>
                </span>

                <a-trigger
                  v-if="column.filter"
                  :popup-visible="openKey === column.key"
                  trigger="click"
                  position="bottom"
                  auto-fit-position
                  @popup-visible-change="visible => onFilterVisible(column.key, visible)"
                >
                  <span
                    class="arco-icon-hover arco-table-filters"
                    :class="{
                      'arco-table-filters-active': isFilterActive(column.key),
                      'arco-table-filters-open': openKey === column.key,
                    }"
                  >
                    <icon-filter />
                  </span>
                  <template #content>
                    <div class="arco-table-filters-content">
                      <ul class="arco-table-filters-list">
                        <li
                          v-for="option in column.filter.options"
                          :key="option.value"
                          class="arco-table-filters-item"
                        >
                          <a-radio
                            v-if="!column.filter.multiple"
                            :model-value="draft[column.key]?.[0]"
                            :value="option.value"
                            @change="value => setDraftValue(column.key, value)"
                          >
                            {{ option.label }}
                          </a-radio>
                          <a-checkbox
                            v-else
                            :model-value="draft[column.key] ?? []"
                            :value="option.value"
                            uninject-group-context
                            @change="values => setDraftValues(column.key, values)"
                          >
                            {{ option.label }}
                          </a-checkbox>
                        </li>
                      </ul>
                      <div class="arco-table-filters-bottom">
                        <a-button size="mini" @click="resetFilter(column.key)">
                          {{ t('table.reset') }}
                        </a-button>
                        <a-button size="mini" type="primary" @click="applyFilter(column.key)">
                          {{ t('table.ok') }}
                        </a-button>
                      </div>
                    </div>
                  </template>
                </a-trigger>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!visibleRows.length" class="arco-table-tr arco-table-tr-empty">
              <td class="arco-table-td" :colspan="columns.length">
                <span class="arco-table-cell">
                  <a-empty />
                </span>
              </td>
            </tr>
            <tr
              v-for="(row, index) in visibleRows"
              :key="index"
              class="arco-table-tr"
              @click="onRowClick(row, $event)"
            >
              <td
                v-for="column in columns"
                :key="column.key"
                class="arco-table-td"
                :class="{ 'arco-table-col-fixed-right': column.fixedRight, 'arco-table-col-fixed-right-first': column.fixedRight }"
                :style="column.fixedRight ? { right: '0' } : undefined"
              >
                <span class="arco-table-cell arco-table-cell-align-left">
                  <slot :name="`cell-${column.key}`" :record="row" :index="index">
                    {{ cellValue(row, column.key) }}
                  </slot>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="visibleRows.length" class="arco-table-pagination">
      <a-pagination
        :total="total"
        :current="page + 1"
        :page-size="pageSize"
        @change="onPageChange"
      />
    </div>
  </div>
</template>
