<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { broadbandApi } from '../api/broadband.api'
import { getAuthErrorMessage } from '../api/auth.api'
import ComparisonBarChart from '../components/charts/ComparisonBarChart.vue'
import ServiceCompositionChart from '../components/charts/ServiceCompositionChart.vue'
import { chartMetricColor } from '../constants/chart-metric-colors'
import type {
  BroadbandFilter,
  BroadbandProcedureKey,
  BroadbandUnit,
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
const selectedUnitId = ref(0)
const selectedMetricKeys = ref<string[]>([])
const selectedGroupKey = ref<string | null>(null)
const unitSearch = ref('')
const units = ref<BroadbandUnit[]>([])
const unitsLoading = ref(false)
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
const unitItems = computed<BroadbandUnit[]>(() => [
  { id: 0, name: 'Tất cả đơn vị' },
  ...units.value.filter((unit) => unit.id !== 0),
])
const selectedUnitName = computed(() =>
  unitItems.value.find((unit) => unit.id === selectedUnitId.value)?.name ?? 'Tất cả đơn vị',
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
const knownDimensionTitles = new Set([
  'Tên đơn vị địa bàn',
  'Tên đơn vị phát triển',
  'Tên khu vực',
  'Mã nhân viên',
  'Tên nhân viên',
])
const dimensionFields = computed(() => selectedHeaders.value
  .filter((header) => header.align !== 'end' || knownDimensionTitles.has(header.title))
  .map((header) => ({ key: header.key, title: header.title })))
const numericFields = computed(() => selectedHeaders.value
  .filter((header) => header.align === 'end' && !knownDimensionTitles.has(header.title))
  .map((header) => ({ key: header.key, title: header.title })))
const isAreaProcedure = computed(() =>
  selectedProcedureKey.value === 'ptm-area' || selectedProcedureKey.value === 'cancel-area',
)
const isXgsponProcedure = computed(() =>
  selectedProcedureKey.value === 'xgspon-location' || selectedProcedureKey.value === 'xgspon-employee',
)
const groupingFields = computed(() => isAreaProcedure.value
  ? dimensionFields.value.filter((field) => [
      'Tên đơn vị địa bàn',
      'Tên khu vực',
      'Mã nhân viên',
      'Tên nhân viên',
    ].includes(field.title))
  : dimensionFields.value.slice(0, 1))
const categoryField = computed(() =>
  groupingFields.value.find((field) => field.key === selectedGroupKey.value) ?? groupingFields.value[0],
)
const selectedMetrics = computed(() => numericFields.value.filter((field) =>
  selectedMetricKeys.value.includes(field.key),
))
const allMetricsSelected = computed(() =>
  numericFields.value.length > 0 && selectedMetrics.value.length === numericFields.value.length,
)
const chartData = computed(() => {
  if (!selectedMetrics.value.length || !categoryField.value) return []
  const categoryKey = categoryField.value.key
  const grouped = new Map<string, Record<string, number>>()

  for (const row of filteredRows.value) {
    const category = String(row[categoryKey] ?? '').trim() || 'Chưa xác định'
    const totals = grouped.get(category) ?? {}
    for (const metric of selectedMetrics.value) {
      const value = row[metric.key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        totals[metric.key] = (totals[metric.key] ?? 0) + value
      }
    }
    grouped.set(category, totals)
  }

  return [...grouped.entries()]
    .map(([category, totals]) => ({ category, totals }))
    .sort((left, right) =>
      selectedMetrics.value.reduce((sum, metric) => sum + (right.totals[metric.key] ?? 0), 0) -
      selectedMetrics.value.reduce((sum, metric) => sum + (left.totals[metric.key] ?? 0), 0),
    )
})
const chartCategories = computed(() => chartData.value.map((item) => item.category))
const chartSeries = computed(() => selectedMetrics.value.map((metric) => ({
  name: metric.title,
  data: chartData.value.map((item) => item.totals[metric.key] ?? 0),
  color: chartMetricColor(numericFields.value.findIndex((field) => field.key === metric.key)),
})))
const selectedMetricSummary = computed(() =>
  allMetricsSelected.value
    ? 'Tất cả chỉ tiêu'
    : selectedMetrics.value.length === 1
      ? selectedMetrics.value[0]!.title
      : `${selectedMetrics.value.length} chỉ tiêu`,
)
const serviceMetricTotals = computed(() => numericFields.value
  .map((field, index) => ({
    name: field.title,
    color: chartMetricColor(index),
    value: filteredRows.value.reduce((sum, row) => {
      const value = row[field.key]
      return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0)
    }, 0),
  })))
const serviceCompositionItems = computed(() => serviceMetricTotals.value
  .filter((item) => !(
    isXgsponProcedure.value && normalizeSearch(item.name) === 'tong xgspon'
  ))
  .filter((item) => item.value > 0))
const serviceCompositionTotal = computed(() => {
  if (isXgsponProcedure.value) {
    const declaredTotal = serviceMetricTotals.value.find((item) =>
      normalizeSearch(item.name) === 'tong xgspon',
    )?.value
    if (declaredTotal !== undefined) return declaredTotal
  }
  return serviceCompositionItems.value.reduce((sum, item) => sum + item.value, 0)
})

watch(numericFields, (fields) => {
  const availableKeys = new Set(fields.map((field) => field.key))
  const validKeys = selectedMetricKeys.value.filter((key) => availableKeys.has(key))
  if (validKeys.length !== selectedMetricKeys.value.length) selectedMetricKeys.value = validKeys
  if (!validKeys.length && fields.length) {
    selectedMetricKeys.value = [fields.find((field) =>
      normalizeSearch(field.title) === 'fiber',
    )?.key ?? fields[0]!.key]
  }
})
watch(selectedProcedureKey, () => { selectedMetricKeys.value = [] }, { flush: 'sync' })
watch(groupingFields, (fields) => {
  if (!fields.some((field) => field.key === selectedGroupKey.value)) {
    selectedGroupKey.value = (
      isAreaProcedure.value
        ? fields.find((field) => field.title === 'Tên khu vực')
        : fields[0]
    )?.key ?? null
  }
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
    unitId: selectedUnitId.value,
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

function toggleAllMetrics(): void {
  selectedMetricKeys.value = allMetricsSelected.value
    ? [numericFields.value.find((field) => normalizeSearch(field.title) === 'fiber')?.key ?? numericFields.value[0]!.key]
    : numericFields.value.map((field) => field.key)
}

function metricSwatch(index: number, key: string): string {
  return selectedMetrics.value.length === 1 && selectedMetricKeys.value.includes(key)
    ? 'linear-gradient(90deg, #169b72, #078bc8, #f2b134, #df4d4d)'
    : chartMetricColor(index)
}

function filterUnits(
  value: string,
  query: string,
  item?: { raw?: unknown },
): boolean {
  const raw = item?.raw as BroadbandUnit | undefined
  return normalizeSearch(`${value} ${raw?.id ?? ''}`).includes(normalizeSearch(query))
}

function clearUnitSelection(): void {
  selectedUnitId.value = 0
  unitSearch.value = ''
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

async function loadUnits(): Promise<void> {
  unitsLoading.value = true
  try {
    units.value = await broadbandApi.units()
  } catch (reason) {
    generalError.value = getAuthErrorMessage(reason)
  } finally {
    unitsLoading.value = false
  }
}

onMounted(loadUnits)
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
          <v-col cols="12" sm="6" lg="2">
            <v-date-input v-model="fromDate" label="Từ ngày" prepend-icon="" prepend-inner-icon="mdi-calendar-start-outline" variant="outlined" clearable :display-format="displayDate" :error-messages="dateError" />
          </v-col>
          <v-col cols="12" sm="6" lg="2">
            <v-date-input v-model="toDate" label="Đến ngày" prepend-icon="" prepend-inner-icon="mdi-calendar-end-outline" variant="outlined" clearable :display-format="displayDate" :error-messages="dateError" />
          </v-col>
          <v-col cols="12" md="6" lg="3">
            <v-autocomplete
              v-model="selectedUnitId"
              v-model:search="unitSearch"
              :items="unitItems"
              item-title="name"
              item-value="id"
              label="Đơn vị"
              placeholder="Nhập tên hoặc mã đơn vị"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              :loading="unitsLoading"
              :custom-filter="filterUnits"
              no-data-text="Không tìm thấy đơn vị"
              auto-select-first
              clearable
              hide-details
              @click:clear="clearUnitSelection"
            />
          </v-col>
          <v-col cols="12" md="6" lg="3">
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
          <v-col cols="12" lg="2" class="filter-actions">
            <v-btn color="primary" size="large" prepend-icon="mdi-database-search-outline" :loading="states[selectedProcedureKey].loading" :disabled="!!dateError" @click="runSelected()">Lấy dữ liệu</v-btn>
          </v-col>
        </v-row>
        <v-alert type="info" variant="tonal" density="compact" icon="mdi-filter-outline">
          Đơn vị đang chọn: <strong>{{ selectedUnitName }}</strong>.
        </v-alert>
      </v-card-text>
    </v-card>

    <v-alert v-if="generalError" class="mt-4" type="error" variant="tonal" closable @click:close="generalError = ''">{{ generalError }}</v-alert>

    <section class="procedure-list">
      <section v-if="numericFields.length" class="chart-section">
        <v-card class="metric-card" elevation="0">
          <v-card-text>
            <div class="metric-card__title">
              <div>
                <strong>Chỉ tiêu hiển thị trên biểu đồ</strong>
                <span>Báo cáo: {{ selectedProcedure.title }} · Chọn một hoặc nhiều trường số liệu để so sánh.</span>
              </div>
              <v-chip class="active-metric-chip" color="primary" variant="tonal" prepend-icon="mdi-chart-bar">{{ selectedMetricSummary }}</v-chip>
            </div>
            <div class="metric-choices">
              <v-chip
                class="selector-chip metric-chip select-all-chip"
                :class="{ 'selector-chip--active': allMetricsSelected }"
                color="primary"
                variant="outlined"
                :prepend-icon="allMetricsSelected ? 'mdi-check-all' : 'mdi-select-all'"
                @click="toggleAllMetrics"
              >Chọn tất cả</v-chip>
              <v-chip-group v-model="selectedMetricKeys" class="metric-chip-group" multiple mandatory selected-class="selector-chip--active">
              <v-chip
                v-for="(field, index) in numericFields"
                :key="field.key"
                :value="field.key"
                class="selector-chip metric-chip"
                color="primary"
                variant="outlined"
              >
                <span
                  class="metric-color-dot"
                  :style="{ background: metricSwatch(index, field.key) }"
                  aria-hidden="true"
                />
                {{ field.title }}
              </v-chip>
              </v-chip-group>
            </div>
            <template v-if="isAreaProcedure && groupingFields.length">
              <v-divider class="my-4" />
              <div class="grouping-selector">
                <div>
                  <strong>Gom dữ liệu theo</strong>
                  <span>Cộng dồn chỉ tiêu trước khi vẽ biểu đồ.</span>
                </div>
                <v-chip-group v-model="selectedGroupKey" class="grouping-chip-group" mandatory selected-class="selector-chip--active">
                  <v-chip
                    v-for="field in groupingFields"
                    :key="field.key"
                    :value="field.key"
                    class="selector-chip grouping-chip"
                    color="primary"
                    filter
                    variant="outlined"
                  >{{ field.title }}</v-chip>
                </v-chip-group>
              </div>
            </template>
          </v-card-text>
        </v-card>

        <v-row v-if="chartData.length" class="chart-grid">
          <v-col cols="12">
            <v-card class="chart-card" elevation="0">
              <v-card-title>
                <div><strong>Biểu đồ cột · {{ selectedProcedure.title }}</strong><span>{{ selectedMetricSummary }} theo {{ categoryField?.title }}</span></div>
              </v-card-title>
              <v-card-text>
                <ComparisonBarChart
                  :categories="chartCategories"
                  :series="chartSeries"
                  orientation="vertical"
                  :loading="states[selectedProcedure.key].loading"
                />
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" lg="6">
            <v-card class="chart-card" elevation="0">
              <v-card-title>
                <div><strong>Biểu đồ thanh · {{ selectedProcedure.title }}</strong><span>So sánh {{ selectedMetricSummary }} theo {{ categoryField?.title }}</span></div>
              </v-card-title>
              <v-card-text>
                <ComparisonBarChart
                  :categories="chartCategories"
                  :series="chartSeries"
                  orientation="horizontal"
                  :loading="states[selectedProcedure.key].loading"
                />
              </v-card-text>
            </v-card>
          </v-col>
          <v-col v-if="serviceCompositionItems.length" cols="12" lg="6">
            <v-card class="chart-card" elevation="0">
              <v-card-title>
                <div>
                  <strong>Cơ cấu dịch vụ · {{ selectedProcedure.title }}</strong>
                  <span>Tỷ trọng từng dịch vụ trên tổng {{ displayValue(serviceCompositionTotal) }}</span>
                </div>
              </v-card-title>
              <v-card-text>
                <ServiceCompositionChart
                  :items="serviceCompositionItems"
                  :loading="states[selectedProcedure.key].loading"
                />
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        <v-empty-state v-else icon="mdi-chart-bar-off" title="Chưa có dữ liệu biểu đồ" text="Chỉ tiêu đang chọn không có dữ liệu số để so sánh." />
      </section>

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
.procedure-table :deep(.v-data-table__th) { position: sticky!important; top: 0!important; z-index: 4!important; height: 98px!important; min-width: 150px; padding: 12px 14px!important; color: rgb(var(--v-theme-primary))!important; background: color-mix(in srgb,rgb(var(--v-theme-primary)) 8%,rgb(var(--v-theme-surface)))!important; box-shadow: inset 0 -1px 0 rgba(var(--v-theme-primary),.16); font-size: 13px!important; font-weight: 700!important; letter-spacing: .15px; white-space: nowrap; vertical-align: top; }
.column-heading { display: grid; gap: 9px; min-width: 124px; }.column-heading > span { overflow: hidden; display: block; min-height: 20px; text-overflow: ellipsis; }.column-search { min-width: 124px; }.column-search :deep(.v-field) { min-height: 38px; color: rgba(var(--v-theme-on-surface),.8); background: rgb(var(--v-theme-surface)); font-size: 13px; font-weight: 400; }.column-search :deep(.v-field__input) { min-height: 38px; padding-block: 6px; }.column-search :deep(.v-field__prepend-inner) { padding-top: 9px; }.column-search :deep(.v-icon) { font-size: 18px; }
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
.chart-section { display: grid; gap: 16px; margin-top: 2px; }.metric-card,.chart-card { overflow: hidden; border: 0; border-radius: 10px; background: rgb(var(--v-theme-surface)); box-shadow: 0 4px 18px rgba(29,61,83,.09)!important; }.metric-card__title { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }.metric-card__title strong,.metric-card__title span,.grouping-selector strong,.grouping-selector span { display: block; }.metric-card__title strong,.grouping-selector strong { color: rgb(var(--v-theme-on-surface)); font-size: 16px; }.metric-card__title span,.grouping-selector span { margin-top: 4px; color: rgba(var(--v-theme-on-surface),.58); font-size: 12px; }.grouping-selector { display: grid; grid-template-columns: minmax(190px,auto) 1fr; align-items: center; gap: 18px; }.active-metric-chip { display: inline-flex!important; align-items: center; justify-content: center; min-width: 92px; height: 38px!important; padding-inline: 13px!important; border: 1px solid rgba(var(--v-theme-primary),.14); border-radius: 10px!important; font-size: 12px; font-weight: 600; white-space: nowrap; }.active-metric-chip :deep(.v-chip__content),.selector-chip :deep(.v-chip__content) { display: inline-flex; align-items: center; justify-content: center; width: auto; line-height: 1; white-space: nowrap; }.active-metric-chip :deep(.v-chip__prepend),.selector-chip :deep(.v-chip__filter) { display: inline-flex; align-items: center; justify-content: center; align-self: center; margin-inline-end: 6px; }.metric-chip-group :deep(.v-slide-group__content),.grouping-chip-group :deep(.v-slide-group__content) { display: flex; flex-wrap: wrap; gap: 9px; padding-block: 2px; }.selector-chip { display: inline-flex!important; align-items: center; justify-content: center; height: 38px!important; margin: 0!important; padding-inline: 14px!important; border-color: rgba(var(--v-theme-on-surface),.22)!important; border-radius: 10px!important; color: rgba(var(--v-theme-on-surface),.72)!important; background: rgba(var(--v-theme-surface),.75)!important; font-size: 12px; font-weight: 500; white-space: nowrap; transition: border-color .16s ease,background-color .16s ease,box-shadow .16s ease; }.selector-chip:hover { border-color: rgba(var(--v-theme-primary),.48)!important; color: rgb(var(--v-theme-primary))!important; background: rgba(var(--v-theme-primary),.035)!important; box-shadow: 0 3px 9px rgba(var(--v-theme-primary),.1); }.metric-chip { min-width: 88px; }.grouping-chip { min-width: 142px; }.selector-chip--active { border-color: rgb(var(--v-theme-primary))!important; color: rgb(var(--v-theme-primary))!important; background: rgba(var(--v-theme-primary),.1)!important; box-shadow: 0 3px 9px rgba(var(--v-theme-primary),.14); font-weight: 600; }.selector-chip--active :deep(.v-chip__filter) { opacity: 1; }.chart-grid { margin-top: -4px; }.chart-card > .v-card-title { padding: 18px 20px 10px; }.chart-card > .v-card-title strong,.chart-card > .v-card-title span { display: block; }.chart-card > .v-card-title strong { font-size: 16px; }.chart-card > .v-card-title span { margin-top: 4px; color: rgba(var(--v-theme-on-surface),.55); font-size: 11px; font-weight: 400; }.chart-card > .v-card-text { padding: 0 12px 12px; }
.metric-choices { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
.metric-chip-group { min-width: 0; flex: 1 1 480px; align-self: center; padding-block: 0; }
.metric-chip-group :deep(.v-slide-group__content) { padding-block: 0; }
.select-all-chip { min-width: 132px; align-self: center; }
.metric-chip :deep(.v-chip__content) { gap: 7px; }
.metric-color-dot { display: inline-block; flex: 0 0 10px; width: 10px; height: 10px; border-radius: 3px; }
.chart-card > .v-card-title { white-space: normal; }
@media(max-width:700px){.broadband-page{width:min(100% - 24px,1500px)}.filter-actions{justify-content:stretch;padding-top:0}.filter-actions .v-btn{width:100%}.procedure-card__head,.metric-card__title{align-items:flex-start;flex-direction:column}.procedure-card__status{width:100%;justify-content:space-between}.grouping-selector{grid-template-columns:1fr}.active-metric-chip{align-self:flex-start}}
</style>
