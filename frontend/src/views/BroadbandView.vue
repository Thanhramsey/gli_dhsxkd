<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { broadbandApi } from '../api/broadband.api'
import { getAuthErrorMessage } from '../api/auth.api'
import type {
  BroadbandFilter,
  BroadbandProcedureKey,
} from '../types/broadband'

interface ProcedureDefinition {
  key: BroadbandProcedureKey
  title: string
  procedure: string
}

interface ProcedureState {
  loading: boolean
  hasRun: boolean
  error: string
  rows: Array<Record<string, unknown>>
  durationMs: number
}

const procedures: ProcedureDefinition[] = [
  { key: 'ptm-employee', title: 'PTM theo nhân viên phát triển', procedure: 'TONGHOP_PTM_NV' },
  { key: 'ptm-location', title: 'PTM theo địa bàn', procedure: 'TONGHOP_PTM_DB' },
  { key: 'ptm-area', title: 'PTM theo khu vực', procedure: 'TONGHOP_PTM_KV' },
  { key: 'xgspon-location', title: 'XGSPON theo địa bàn', procedure: 'TONGHOP_XGSPON_DB' },
  { key: 'xgspon-employee', title: 'XGSPON theo nhân viên phát triển', procedure: 'TONGHOP_XGSPON_NVPT' },
  { key: 'cancel-location', title: 'Thuê bao hủy theo địa bàn', procedure: 'TONGHOP_HUY_DB' },
  { key: 'cancel-area', title: 'Thuê bao hủy theo khu vực', procedure: 'TONGHOP_HUY_KV' },
]

const today = new Date()
const fromDate = ref<Date | null>(new Date(today.getFullYear(), today.getMonth(), 1))
const toDate = ref<Date | null>(today)
const selectedProcedureKey = ref<BroadbandProcedureKey>('ptm-employee')
const generalError = ref('')
function emptyState(): ProcedureState {
  return { loading: false, hasRun: false, error: '', rows: [], durationMs: 0 }
}

const states = reactive<Record<BroadbandProcedureKey, ProcedureState>>({
  'ptm-employee': emptyState(),
  'ptm-location': emptyState(),
  'ptm-area': emptyState(),
  'xgspon-location': emptyState(),
  'xgspon-employee': emptyState(),
  'cancel-location': emptyState(),
  'cancel-area': emptyState(),
})
const columnFilters = reactive<Record<BroadbandProcedureKey, Record<string, string | null>>>({
  'ptm-employee': {},
  'ptm-location': {},
  'ptm-area': {},
  'xgspon-location': {},
  'xgspon-employee': {},
  'cancel-location': {},
  'cancel-area': {},
})

const selectedProcedure = computed(() =>
  procedures.find((procedure) => procedure.key === selectedProcedureKey.value) ?? procedures[0],
)
const selectedRows = computed(() => states[selectedProcedureKey.value].rows)
const selectedHeaders = computed(() => headersFor(selectedRows.value))
const filteredRows = computed(() => {
  const filters = columnFilters[selectedProcedureKey.value]
  const activeFilters = Object.entries(filters).filter(([, value]) => String(value ?? '').trim())
  const detailRows = selectedRows.value.filter((row) => !isExistingTotal(row))
  if (!activeFilters.length) return detailRows

  return detailRows.filter((row) =>
    activeFilters.every(([key, query]) =>
      normalizeSearch(row[key]).includes(normalizeSearch(query)),
    ),
  )
})

const dateError = computed(() => {
  if (!fromDate.value || !toDate.value) return 'Vui lòng chọn đủ từ ngày và đến ngày'
  if (toDateKey(fromDate.value) > toDateKey(toDate.value)) return 'Từ ngày không được lớn hơn đến ngày'
  return ''
})

function toDateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function displayDate(value: unknown): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN').format(value)
}

function createFilter(): BroadbandFilter | null {
  if (dateError.value || !fromDate.value || !toDate.value) {
    generalError.value = dateError.value
    return null
  }
  return {
    fromDate: toDateKey(fromDate.value),
    toDate: toDateKey(toDate.value),
    unitId: 0,
    serviceId: 0,
    subscriberTypeId: 0,
    areaId: 0,
  }
}

function headersFor(rows: Array<Record<string, unknown>>) {
  const keys = rows.length ? Object.keys(rows[0] ?? {}).filter((key) => key !== 'SORT_ORDER') : []
  return keys.map((key) => {
    const sampleValue = rows.find((row) => row[key] !== null && row[key] !== undefined)?.[key]
    return {
      title: key,
      key,
      align: typeof sampleValue === 'number' ? 'end' as const : 'start' as const,
      sortable: true,
      nowrap: true,
    }
  })
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (value instanceof Date) return displayDate(value)
  if (typeof value === 'number') return new Intl.NumberFormat('vi-VN').format(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function normalizeSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
}

function clearColumnFilter(key: string): void {
  columnFilters[selectedProcedureKey.value][key] = ''
}

function isExistingTotal(row: Record<string, unknown>): boolean {
  return Object.values(row).some((value) =>
    typeof value === 'string' && /^tổng(?:\s+cộng)?$/i.test(value.trim()),
  )
}

function totalValue(key: string, columnIndex: number): string {
  if (columnIndex === 0) return 'TỔNG CỘNG'
  const values = filteredRows.value
    .filter((row) => !isExistingTotal(row))
    .map((row) => row[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return values.length
    ? new Intl.NumberFormat('vi-VN').format(values.reduce((sum, value) => sum + value, 0))
    : ''
}

async function runProcedure(definition: ProcedureDefinition, suppliedFilter?: BroadbandFilter) {
  const filter = suppliedFilter ?? createFilter()
  if (!filter) return
  const state = states[definition.key]
  state.loading = true
  state.error = ''
  const startedAt = performance.now()
  try {
    const result = await broadbandApi.execute(definition.key, filter)
    state.rows = result.rows
    state.hasRun = true
  } catch (reason) {
    state.rows = []
    state.hasRun = true
    state.error = getAuthErrorMessage(reason)
  } finally {
    state.durationMs = Math.round(performance.now() - startedAt)
    state.loading = false
  }
}

async function runSelected(key: BroadbandProcedureKey = selectedProcedureKey.value) {
  const procedure = procedures.find((item) => item.key === key)
  if (!procedure) return
  generalError.value = ''
  await runProcedure(procedure)
}
</script>

<template>
  <v-container class="broadband-page" fluid>
    <header class="page-head">
      <div>
        <h1>Dữ liệu báo cáo BRCĐ</h1>
      </div>
    </header>

    <v-card class="filter-card" elevation="0">
      <v-card-text>
        <v-row align="start">
          <v-col cols="12" sm="6" lg="3">
            <v-date-input v-model="fromDate" label="Từ ngày" prepend-icon="" prepend-inner-icon="mdi-calendar-start-outline" variant="outlined" clearable :display-format="displayDate" :error-messages="dateError" />
          </v-col>
          <v-col cols="12" sm="6" lg="3">
            <v-date-input v-model="toDate" label="Đến ngày" prepend-icon="" prepend-inner-icon="mdi-calendar-end-outline" variant="outlined" clearable :display-format="displayDate" :error-messages="dateError" />
          </v-col>
          <v-col cols="12" md="8" lg="4">
            <v-select
              v-model="selectedProcedureKey"
              :items="procedures"
              item-title="title"
              item-value="key"
              label="Chỉ tiêu báo cáo"
              prepend-inner-icon="mdi-chart-box-outline"
              variant="outlined"
              hide-details
              @update:model-value="runSelected"
            />
          </v-col>
          <v-col cols="12" md="4" lg="2" class="filter-actions">
            <v-btn color="primary" size="large" prepend-icon="mdi-database-search-outline" :loading="states[selectedProcedureKey].loading" :disabled="!!dateError" @click="runSelected()">Lấy dữ liệu</v-btn>
          </v-col>
        </v-row>
        <v-alert type="info" variant="tonal" density="compact" icon="mdi-filter-outline">
          Các tham số đơn vị, khu vực, dịch vụ và loại thuê bao đang được bind bằng <strong>0</strong> để lấy toàn bộ dữ liệu.
        </v-alert>
      </v-card-text>
    </v-card>

    <v-alert v-if="generalError" class="mt-4" type="error" variant="tonal" closable @click:close="generalError = ''">{{ generalError }}</v-alert>

    <section class="procedure-list">
      <v-card :key="selectedProcedure.key" class="procedure-card" elevation="0">
        <v-card-title class="procedure-card__head">
          <div>
            <strong>{{ selectedProcedure.title }}</strong>
            <small>{{ selectedProcedure.procedure }}</small>
          </div>
          <div class="procedure-card__status">
            <v-btn icon="mdi-refresh" size="small" variant="text" color="primary" :loading="states[selectedProcedure.key].loading" title="Gọi lại procedure" @click="runProcedure(selectedProcedure)" />
          </div>
        </v-card-title>

        <v-alert v-if="states[selectedProcedure.key].error" class="ma-4" type="error" variant="tonal" density="compact">{{ states[selectedProcedure.key].error }}</v-alert>

        <v-data-table
          class="procedure-table"
          :headers="selectedHeaders"
          :items="filteredRows"
          :loading="states[selectedProcedure.key].loading"
          :items-per-page="20"
          :items-per-page-options="[20, 50, 100, 200, 500]"
          density="comfortable"
          hover
          fixed-header
          height="420"
          :no-data-text="states[selectedProcedure.key].hasRun ? 'Procedure không trả về dữ liệu' : 'Chọn chỉ tiêu hoặc nhấn Lấy dữ liệu để kiểm tra'"
        >
          <template
            v-for="header in selectedHeaders"
            :key="header.key"
            #[`header.${header.key}`]="{ column }"
          >
            <div class="column-heading">
              <span>{{ column.title }}</span>
              <v-text-field
                v-model="columnFilters[selectedProcedureKey][String(column.key)]"
                class="column-search"
                density="compact"
                variant="outlined"
                placeholder="Tìm..."
                prepend-inner-icon="mdi-magnify"
                clearable
                hide-details
                @click.stop
                @click:clear="clearColumnFilter(String(column.key))"
                @keydown.stop
              />
            </div>
          </template>
          <template #item="{ item, columns }">
            <tr :class="{ 'total-row': Object.values(item).includes('TỔNG') }">
              <td
                v-for="column in columns"
                :key="String(column.key)"
                :class="{ 'text-end': typeof item[String(column.key)] === 'number' }"
              >{{ displayValue(item[String(column.key)]) }}</td>
            </tr>
          </template>
          <template #body.prepend="{ columns }">
            <tr v-if="filteredRows.length" class="total-row calculated-total-row">
              <td
                v-for="(column, columnIndex) in columns"
                :key="String(column.key)"
                :class="{ 'text-end': columnIndex > 0 }"
              >{{ totalValue(String(column.key), columnIndex) }}</td>
            </tr>
          </template>
        </v-data-table>
      </v-card>
    </section>
  </v-container>
</template>

<style scoped>
.broadband-page { width: min(1500px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 60px; }
.page-head { margin-bottom: 22px; }.page-head p { margin: 0 0 5px; color: rgb(var(--v-theme-primary)); font-size: 11px; font-weight: 800; letter-spacing: 1.3px; }.page-head h1 { margin: 0; color: rgb(var(--v-theme-on-background)); font-size: 29px; }.page-head span { display: block; margin-top: 6px; color: rgba(var(--v-theme-on-background), .62); font-size: 14px; }
.filter-card,.procedure-card { overflow: hidden; border: 0; border-radius: 10px; background: rgb(var(--v-theme-surface)); box-shadow: 0 4px 18px rgba(29,61,83,.09)!important; }.filter-actions { display: flex; justify-content: flex-end; padding-top: 18px; }
.procedure-list { display: grid; gap: 18px; margin-top: 20px; }.procedure-card__head { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 15px 20px; border-bottom: 1px solid rgba(var(--v-border-color),var(--v-border-opacity)); white-space: normal; }.procedure-card__head strong,.procedure-card__head small { display: block; }.procedure-card__head strong { font-size: 17px; }.procedure-card__head small { margin-top: 5px; color: rgba(var(--v-theme-on-surface),.54); font-family: Consolas, monospace; font-size: 11px; }.procedure-card__status { display: flex; align-items: center; gap: 8px; }
.procedure-table { --table-row-even: rgba(var(--v-theme-primary),.022); --table-row-hover: rgba(var(--v-theme-primary),.065); }
.procedure-table :deep(.v-table__wrapper) { scrollbar-color: rgba(var(--v-theme-primary),.35) transparent; scrollbar-width: thin; }
.procedure-table :deep(.v-data-table__thead) { position: sticky; top: 0; z-index: 4; }
.procedure-table :deep(.v-data-table__th) { position: sticky!important; top: 0!important; z-index: 4!important; height: 88px!important; min-width: 138px; padding: 10px 12px!important; color: rgb(var(--v-theme-primary))!important; background: color-mix(in srgb,rgb(var(--v-theme-primary)) 8%,rgb(var(--v-theme-surface)))!important; box-shadow: inset 0 -1px 0 rgba(var(--v-theme-primary),.16); font-size: 11px!important; font-weight: 700!important; letter-spacing: .15px; white-space: nowrap; vertical-align: top; }
.column-heading { display: grid; gap: 7px; min-width: 114px; }.column-heading > span { overflow: hidden; display: block; min-height: 18px; text-overflow: ellipsis; }.column-search { min-width: 114px; }.column-search :deep(.v-field) { min-height: 34px; color: rgba(var(--v-theme-on-surface),.8); background: rgb(var(--v-theme-surface)); font-size: 12px; font-weight: 400; }.column-search :deep(.v-field__input) { min-height: 34px; padding-block: 5px; }.column-search :deep(.v-field__prepend-inner) { padding-top: 7px; }.column-search :deep(.v-icon) { font-size: 17px; }
.procedure-table :deep(tbody tr) { background: rgb(var(--v-theme-surface)); transition: background-color .15s ease; }
.procedure-table :deep(tbody tr:nth-child(even)) { background: var(--table-row-even); }
.procedure-table :deep(tbody tr:hover) { background: var(--table-row-hover)!important; }
.procedure-table :deep(td) { height: 51px!important; padding-inline: 16px!important; border-bottom-color: rgba(var(--v-border-color),.1)!important; color: rgba(var(--v-theme-on-surface),.86); font-size: 13px; white-space: nowrap; }
.procedure-table :deep(th:first-child),.procedure-table :deep(td:first-child) { min-width: 260px; }
.procedure-table :deep(td:first-child) { font-weight: 600; }
.procedure-table :deep(.v-data-table-footer) { min-height: 58px; border-top: 1px solid rgba(var(--v-border-color),var(--v-border-opacity)); background: color-mix(in srgb,rgb(var(--v-theme-primary)) 3%,rgb(var(--v-theme-surface))); }
.procedure-table :deep(.v-data-table-footer__info) { color: rgba(var(--v-theme-on-surface),.65); font-size: 12px; }
.procedure-table :deep(.total-row) { color: rgb(var(--v-theme-primary)); background: color-mix(in srgb,rgb(var(--v-theme-primary)) 11%,rgb(var(--v-theme-surface)))!important; font-weight: 700; }
.procedure-table :deep(.calculated-total-row td) { border-top: 0!important; border-bottom: 1px solid rgba(var(--v-theme-primary),.2)!important; background: color-mix(in srgb,rgb(var(--v-theme-primary)) 11%,rgb(var(--v-theme-surface)))!important; }
@media(max-width:700px){.broadband-page{width:min(100% - 24px,1500px)}.filter-actions{justify-content:stretch;padding-top:0}.filter-actions .v-btn{width:100%}.procedure-card__head{align-items:flex-start;flex-direction:column}.procedure-card__status{width:100%;justify-content:space-between}}
</style>
