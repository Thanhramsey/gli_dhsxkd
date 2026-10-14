<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ZoomableKpiChart from '../components/charts/ZoomableKpiChart.vue'
import { kpiApi } from '../api/kpi.api'
import { getAuthErrorMessage } from '../api/auth.api'
import type { KpiRow, KpiTrendProcedure, KpiTrendRow } from '../types/kpi'
import '../plugins/echarts'

const now = new Date()
const monthNumber = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())
const monthOptions = Array.from({ length: 12 }, (_, index) => ({ title: `Tháng ${index + 1}`, value: index + 1 }))
const yearOptions = Array.from({ length: 8 }, (_, index) => now.getFullYear() + 1 - index)
const month = computed(() => `${year.value}-${String(monthNumber.value).padStart(2, '0')}`)
const procedureOptions: { title: string; value: 'TONG_HOP_KPI' | KpiTrendProcedure }[] = [
  { title: 'Tổng hợp KPI', value: 'TONG_HOP_KPI' },
  { title: 'BRCD (Fiber + Cố định)', value: 'TONG_HOP_KPI_BRCD' },
  { title: 'MyTV', value: 'TONG_HOP_KPI_MYTV' },
  { title: 'Camera / Mesh', value: 'TONG_HOP_KPI_CAM_MESH' },
  { title: 'TSL', value: 'TONG_HOP_KPI_TSL' },
  { title: 'CNTT phân bổ', value: 'TONG_HOP_KPI_CNTT' },
  { title: 'Vina trả sau', value: 'TONG_HOP_KPI_VINA_TS' },
]
const selectedProcedure = ref<'TONG_HOP_KPI' | KpiTrendProcedure>('TONG_HOP_KPI')
const rows = ref<KpiRow[]>([])
const trendRows = ref<KpiTrendRow[]>([])
const selectedKpiNames = ref<string[]>([])
const cumulativeMode = ref(false)
const chipColors = ['#d9efff', '#def5ec', '#fff0d6', '#eee5ff', '#ffe4e4', '#e4edff', '#e5f2d9']
const chartRows = computed(() => selectedKpiNames.value.length
  ? rows.value.filter(row => selectedKpiNames.value.includes(row.name))
  : rows.value)
const cumulativeRateRows = computed(() => [...chartRows.value].sort((a, b) => (a.cumulativeRate ?? Number.MAX_VALUE) - (b.cumulativeRate ?? Number.MAX_VALUE)))
const shareRows = computed(() => {
  const values = rows.value.map(row => ({ name: row.name, actual: cumulativeMode.value ? row.cumulativeActual : row.monthlyActual }))
  const total = values.reduce((sum, row) => sum + Math.max(row.actual, 0), 0)
  return values.map(row => ({ ...row, value: total ? Math.max(row.actual, 0) / total * 100 : 0 })).sort((a, b) => b.value - a.value)
})
const loading = ref(false)
const loaded = ref(false)
const initialized = ref(false)
const error = ref('')
const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const compactNumberFormat = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const monthLabel = computed(() => {
  return `tháng ${monthNumber.value}/${year.value}`
})
const totalActual = computed(() => rows.value.reduce((sum, row) => sum + (cumulativeMode.value ? row.cumulativeActual : row.monthlyActual), 0))
const totalPlan = computed(() => rows.value.reduce((sum, row) => sum + (cumulativeMode.value ? row.cumulativePlan : row.monthlyPlan), 0))
const completion = computed(() => totalPlan.value ? totalActual.value / totalPlan.value * 100 : null)
const selectedProcedureLabel = computed(() => procedureOptions.find(option => option.value === selectedProcedure.value)?.title ?? '')
const trendHasData = computed(() => trendRows.value.some(row => row.revenue != null || row.subscribers != null))
const trendHasRevenue = computed(() => trendRows.value.some(row => row.revenue != null))
const trendHasSubscribers = computed(() => trendRows.value.some(row => row.subscribers != null))
const currentTrend = computed(() => trendRows.value[trendRows.value.length - 1])
const cumulativeRevenue = computed(() => trendRows.value.reduce((sum, row) => sum + (row.revenue ?? 0), 0))
type TrendMetric = 'revenue' | 'subscribers'
function formatRevenue(value: number) {
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000_000) return `${numberFormat.format(value / 1_000_000_000)} tỷ đồng`
  if (absolute >= 1_000_000) return `${numberFormat.format(value / 1_000_000)} triệu đồng`
  return `${numberFormat.format(value)} đồng`
}
function trendChangeAt(index: number, metric: TrendMetric) {
  const current = trendRows.value[index]?.[metric]
  const previous = trendRows.value[index - 1]?.[metric]
  if (current == null || previous == null) return null
  const delta = current - previous
  return { delta, percent: previous === 0 ? null : delta / Math.abs(previous) * 100 }
}
const revenueChange = computed(() => trendChangeAt(trendRows.value.length - 1, 'revenue'))
const subscriberChange = computed(() => trendChangeAt(trendRows.value.length - 1, 'subscribers'))
function signedChange(change: { delta: number; percent: number | null } | null, metric: TrendMetric) {
  if (!change) return 'Chưa có dữ liệu tháng trước'
  const sign = change.delta > 0 ? '+' : change.delta < 0 ? '−' : ''
  const amount = metric === 'revenue' ? formatRevenue(Math.abs(change.delta)) : numberFormat.format(Math.abs(change.delta))
  const percent = change.percent == null ? '—' : `${sign}${numberFormat.format(Math.abs(change.percent))}%`
  return `${sign}${amount} · ${percent}`
}
function trendTooltip(index: number, metric: TrendMetric) {
  const row = trendRows.value[index]
  if (!row) return ''
  const value = row[metric]
  const label = metric === 'revenue' ? 'Doanh thu' : 'Số thuê bao'
  const formatted = value == null ? '—' : metric === 'revenue' ? formatRevenue(value) : numberFormat.format(value)
  return `<strong>Tháng ${Number(row.month.slice(5))}/${row.month.slice(0, 4)}</strong><br/>${label}: ${formatted}<br/>So với tháng trước: ${signedChange(trendChangeAt(index, metric), metric)}`
}
function trendValueRange(values: Array<number | null>) {
  const available = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (!available.length) return { min: 0, max: 1 }
  const low = Math.min(...available)
  const high = Math.max(...available)
  const padding = Math.max((high - low) * 0.2, Math.abs(high) * 0.01, 1)
  const step = 10 ** Math.floor(Math.log10(padding))
  return { min: Math.max(0, Math.floor((low - padding) / step) * step), max: Math.ceil((high + padding) / step) * step }
}
const subscriberRange = computed(() => trendValueRange(trendRows.value.map(row => row.subscribers)))
const trendTableRows = computed(() => {
  let totalRevenue = 0
  let hasRevenue = false
  return trendRows.value.map(row => {
    if (row.revenue != null) {
      totalRevenue += row.revenue
      hasRevenue = true
    }
    return { ...row, totalRevenue: hasRevenue ? totalRevenue : null }
  })
})
function toggleKpiFilter(name: string) {
  selectedKpiNames.value = selectedKpiNames.value.includes(name)
    ? selectedKpiNames.value.filter(item => item !== name)
    : [...selectedKpiNames.value, name]
}
const shareBarOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: ({ name, data }: { name: string; data: { actual: number; value: number } }) => `${name}<br/>${cumulativeMode.value ? 'Thực hiện lũy kế' : 'Thực hiện tháng'}: ${numberFormat.format(data.actual)}<br/>Tỷ trọng: ${numberFormat.format(data.value)}%` },
  grid: { left: 190, right: 62, top: 18, bottom: 34 },
  xAxis: { type: 'value', max: 100, axisLabel: { color: '#526a7b', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  yAxis: { type: 'category', inverse: true, data: shareRows.value.map(row => row.name), axisLabel: { color: '#526a7b', width: 170, overflow: 'truncate' }, axisTick: { show: false } },
  series: [{ type: 'bar', barMaxWidth: 26, data: shareRows.value, itemStyle: { color: '#0c8b8d', borderRadius: [0, 5, 5, 0] }, label: { show: true, position: 'right', color: '#244252', formatter: ({ value }: { value: number }) => `${numberFormat.format(value)}%` } }],
}))
const monthlyBarOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value: number) => numberFormat.format(value) },
  legend: { top: 4, textStyle: { color: '#526a7b' } },
  grid: { left: 200, right: 32, top: 50, bottom: 42 },
  xAxis: { type: 'value', min: 0, axisLabel: { color: '#526a7b', formatter: (value: number) => compactNumberFormat.format(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  yAxis: { type: 'category', inverse: true, data: chartRows.value.map(row => row.name), axisLabel: { color: '#526a7b', width: 180, overflow: 'truncate' }, axisTick: { show: false } },
  series: [
    { name: 'Kế hoạch tháng', type: 'bar', barMaxWidth: 17, data: chartRows.value.map(row => row.monthlyPlan), itemStyle: { color: '#6091bd', borderRadius: [0, 4, 4, 0] } },
    { name: 'Thực hiện tháng', type: 'bar', barMaxWidth: 17, data: chartRows.value.map(row => row.monthlyActual), itemStyle: { color: '#e07b34', borderRadius: [0, 4, 4, 0] } },
  ],
}))
const cumulativeRateOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: ({ name, data }: { name: string; data: { value: number | null; plan: number; actual: number } }) => `${name}<br/>Kế hoạch lũy kế: ${numberFormat.format(data.plan)}<br/>Thực hiện lũy kế: ${numberFormat.format(data.actual)}<br/>Hoàn thành: ${data.value == null ? '—' : `${numberFormat.format(data.value)}%`}` },
  grid: { left: 200, right: 58, top: 22, bottom: 42 },
  xAxis: { type: 'value', min: 0, max: (range: { max: number }) => Math.max(120, Math.ceil(range.max / 20) * 20), axisLabel: { color: '#526a7b', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  yAxis: { type: 'category', inverse: true, data: cumulativeRateRows.value.map(row => row.name), axisLabel: { color: '#526a7b', width: 180, overflow: 'truncate' }, axisTick: { show: false } },
  series: [{ type: 'bar', barMaxWidth: 26, data: cumulativeRateRows.value.map(row => ({ value: row.cumulativeRate, plan: row.cumulativePlan, actual: row.cumulativeActual, itemStyle: { color: row.cumulativeRate != null && row.cumulativeRate >= 100 ? '#0c8b8d' : '#e07b34', borderRadius: [0, 5, 5, 0] } })), label: { show: true, position: 'right', color: '#244252', formatter: ({ value }: { value: number | null }) => value == null ? '' : `${numberFormat.format(value)}%` }, markLine: { silent: true, symbol: 'none', label: { formatter: 'Mốc 100%', color: '#526a7b', position: 'insideEndTop' }, lineStyle: { color: '#526a7b', type: 'dashed', width: 2 }, data: [{ xAxis: 100 }] } }],
}))

const trendRevenueOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (items: Array<{ dataIndex: number }>) => trendTooltip(items[0]?.dataIndex ?? -1, 'revenue') },
  grid: { left: 82, right: 24, top: 28, bottom: 42 },
  xAxis: { type: 'category', data: trendRows.value.map(row => `T${Number(row.month.slice(5))}`), axisLabel: { color: '#526a7b' } },
  yAxis: { type: 'value', min: 0, axisLabel: { color: '#526a7b', formatter: (value: number) => formatRevenue(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  series: [{ name: 'Doanh thu', type: 'bar', barMaxWidth: 42, data: trendRows.value.map(row => row.revenue), itemStyle: { color: '#0c8b8d', borderRadius: [5, 5, 0, 0] }, emphasis: { itemStyle: { color: '#11a3a5', shadowBlur: 10, shadowColor: 'rgba(12,139,141,.22)' } } }],
}))
const trendSubscribersOption = computed(() => ({
  tooltip: { trigger: 'axis', formatter: (items: Array<{ dataIndex: number }>) => trendTooltip(items[0]?.dataIndex ?? -1, 'subscribers') },
  grid: { left: 72, right: 24, top: 28, bottom: 42 },
  xAxis: { type: 'category', data: trendRows.value.map(row => `T${Number(row.month.slice(5))}`), axisLabel: { color: '#526a7b' } },
  yAxis: { type: 'value', min: subscriberRange.value.min, max: subscriberRange.value.max, axisLabel: { color: '#526a7b', formatter: (value: number) => numberFormat.format(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  series: [{ name: 'Số thuê bao', type: 'line', data: trendRows.value.map(row => row.subscribers), smooth: 0.25, symbol: 'circle', symbolSize: 8, lineStyle: { width: 3, color: '#3678c4' }, itemStyle: { color: '#3678c4', borderColor: '#fff', borderWidth: 2 }, emphasis: { scale: 1.3 } }],
}))

let loadVersion = 0
async function load() {
  if (!month.value) return
  const version = ++loadVersion
  const procedure = selectedProcedure.value
  const queryMonth = month.value
  loading.value = true
  loaded.value = false
  rows.value = []
  trendRows.value = []
  error.value = ''
  try {
    if (procedure === 'TONG_HOP_KPI') {
      const result = await kpiApi.summary(queryMonth)
      if (version !== loadVersion) return
      rows.value = result.rows
      trendRows.value = []
      selectedKpiNames.value = selectedKpiNames.value.filter(name => result.rows.some(row => row.name === name))
    } else {
      const result = await kpiApi.trend(queryMonth, procedure)
      if (version !== loadVersion) return
      trendRows.value = result.rows
      rows.value = []
      selectedKpiNames.value = []
    }
    loaded.value = true
  } catch (cause) {
    if (version !== loadVersion) return
    rows.value = []
    trendRows.value = []
    loaded.value = true
    error.value = getAuthErrorMessage(cause)
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

async function initialize() {
  loading.value = true
  error.value = ''
  try {
    let latestMonth: string | null = null
    try {
      latestMonth = await kpiApi.latestMonth()
    } catch {
      // Keep working with a backend process that has not loaded the latest-month route yet.
    }
    if (latestMonth) {
      const [latestYear, latestMonthNumber] = latestMonth.split('-').map(Number)
      year.value = latestYear
      monthNumber.value = latestMonthNumber
      await load()
      return
    }

    const cursor = new Date(year.value, monthNumber.value - 1, 1)
    for (let attempt = 0; attempt < 24; attempt += 1) {
      year.value = cursor.getFullYear()
      monthNumber.value = cursor.getMonth() + 1
      const result = await kpiApi.summary(month.value)
      if (result.rows.length) {
        rows.value = result.rows
        loaded.value = true
        return
      }
      cursor.setMonth(cursor.getMonth() - 1)
    }
    rows.value = []
    loaded.value = true
  } catch (cause) {
    loaded.value = true
    error.value = getAuthErrorMessage(cause)
  } finally {
    loading.value = false
    initialized.value = true
  }
}

onMounted(initialize)
watch([selectedProcedure, monthNumber, year], () => { if (initialized.value) void load() })
</script>

<template>
  <v-container class="kpi-page" fluid>
    <header class="page-head">
      <div><span class="eyebrow">HỆ THỐNG DỮ LIỆU GIAO BAN</span><h1>Tổng hợp chỉ tiêu KPI</h1><p>{{ selectedProcedure === 'TONG_HOP_KPI' ? `Kế hoạch và kết quả thực hiện theo từng chỉ tiêu trong ${monthLabel}.` : `Doanh thu và số thuê bao ${selectedProcedureLabel} từ đầu năm đến ${monthLabel}.` }}</p></div>
      <v-chip color="primary" variant="tonal" prepend-icon="mdi-calendar-month">{{ monthLabel }}</v-chip>
    </header>
    <v-card class="filter-card" elevation="0"><v-card-text class="filter-row">
      <v-select v-model="selectedProcedure" :items="procedureOptions" label="Đầu KPI" variant="outlined" hide-details />
      <v-select v-model="monthNumber" :items="monthOptions" label="Tháng báo cáo" variant="outlined" hide-details />
      <v-select v-model="year" :items="yearOptions" label="Năm" variant="outlined" hide-details />
      <v-btn color="primary" prepend-icon="mdi-chart-box-outline" :loading="loading" @click="load">Xem số liệu</v-btn>
      <div v-if="selectedProcedure === 'TONG_HOP_KPI'" class="mode-toggle"><span>{{ cumulativeMode ? 'L\u0169y k\u1ebf' : 'Theo th\u00e1ng' }}</span><v-switch v-model="cumulativeMode" color="primary" density="compact" inset hide-details /></div>
    </v-card-text></v-card>
    <v-alert v-if="loading && !loaded" class="mt-5" color="primary" variant="tonal" icon="mdi-loading">Đang tải số liệu KPI...</v-alert>
    <v-alert v-if="error" class="mt-5" type="error" variant="tonal">{{ error }}</v-alert>
    <template v-if="loaded && !error">
      <template v-if="selectedProcedure === 'TONG_HOP_KPI'">
      <v-row class="summary-row">
        <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>{{ cumulativeMode ? 'K\u1ebe HO\u1ea0CH L\u0168Y K\u1ebe' : 'K\u1ebe HO\u1ea0CH TH\u00c1NG' }}</small><strong>{{ numberFormat.format(totalPlan) }}</strong></v-card></v-col>
        <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>{{ cumulativeMode ? 'TH\u1ef0C HI\u1ec6N L\u0168Y K\u1ebe' : 'TH\u1ef0C HI\u1ec6N TH\u00c1NG' }}</small><strong>{{ numberFormat.format(totalActual) }}</strong></v-card></v-col>
        <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>{{ cumulativeMode ? 'HOÀN THÀNH LŨY KẾ' : 'HOÀN THÀNH' }}</small><strong>{{ completion == null ? '—' : `${numberFormat.format(completion)}%` }}</strong></v-card></v-col>
      </v-row>
      <v-alert v-if="!rows.length" class="mt-4" type="info" variant="tonal">Không có dữ liệu KPI trong {{ monthLabel }}.</v-alert>
      <v-row v-if="rows.length" class="chart-row detail-row">
        <v-col cols="12" lg="5">
          <v-card class="chart-card" elevation="0">
            <v-card-title><div><strong>{{ cumulativeMode ? 'Cơ cấu thực hiện lũy kế theo KPI' : 'Cơ cấu thực hiện theo KPI' }}</strong><span>Tỷ trọng {{ cumulativeMode ? 'lũy kế đến' : 'trong' }} {{ monthLabel }}</span></div></v-card-title>
            <v-card-text><ZoomableKpiChart class="chart" :option="shareBarOption" axis="y" :count="shareRows.length" /></v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" lg="7">
          <v-card class="table-card" elevation="0">
            <v-card-title><div><strong>Chi tiết số liệu KPI</strong><span>Kế hoạch, thực hiện và tỷ lệ hoàn thành · {{ monthLabel }}</span></div></v-card-title>
            <v-data-table
              :headers="[{ title: 'Chỉ tiêu KPI', key: 'name', fixed: 'start', width: 190 }, { title: 'KH tháng', key: 'monthlyPlan', align: 'end' }, { title: 'TH tháng', key: 'monthlyActual', align: 'end' }, { title: 'Hoàn thành tháng', key: 'monthlyRate', align: 'end' }, { title: 'KH lũy kế', key: 'cumulativePlan', align: 'end' }, { title: 'TH lũy kế', key: 'cumulativeActual', align: 'end' }, { title: 'Hoàn thành lũy kế', key: 'cumulativeRate', align: 'end' }]"
              :items="rows"
              :loading="loading"
              :items-per-page="20"
              :items-per-page-options="[10, 20, 50]"
              density="comfortable"
              hover
              fixed-header
              height="430"
              class="kpi-table"
            >
              <template #item.monthlyPlan="{ value }">{{ numberFormat.format(value) }}</template>
              <template #item.monthlyActual="{ value }">{{ numberFormat.format(value) }}</template>
              <template #item.cumulativePlan="{ value }">{{ numberFormat.format(value) }}</template>
              <template #item.cumulativeActual="{ value }">{{ numberFormat.format(value) }}</template>
              <template #item.monthlyRate="{ value }">{{ value == null ? '—' : numberFormat.format(value) + '%' }}</template>
              <template #item.cumulativeRate="{ value }">{{ value == null ? '—' : numberFormat.format(value) + '%' }}</template>
            </v-data-table>
          </v-card>
        </v-col>
      </v-row>
      <v-card v-if="rows.length" class="filter-card chart-filter" elevation="0">
        <v-card-text>
          <div class="chart-filter-label">Lọc chỉ tiêu trên hai biểu đồ so sánh</div>
          <div class="chart-filter-grid">
            <v-chip
              class="filter-chip"
              :color="selectedKpiNames.length ? '#38566b' : '#087cba'"
              variant="flat"
              :style="selectedKpiNames.length ? { backgroundColor: '#e8eef3', color: '#38566b' } : undefined"
              prepend-icon="mdi-view-grid-outline"
              @click="selectedKpiNames = []"
            >Tất cả</v-chip>
            <v-chip
              v-for="(row, index) in rows"
              :key="row.name"
              class="filter-chip"
              :color="selectedKpiNames.includes(row.name) ? '#087cba' : '#38566b'"
              variant="flat"
              :style="selectedKpiNames.includes(row.name) ? undefined : { backgroundColor: chipColors[index % chipColors.length], color: '#38566b' }"
              :prepend-icon="selectedKpiNames.includes(row.name) ? 'mdi-check-circle' : undefined"
              @click="toggleKpiFilter(row.name)"
            >{{ row.name }}</v-chip>
          </div>
        </v-card-text>
      </v-card>
      <v-row v-if="rows.length" class="chart-row">
        <v-col cols="12" lg="6"><v-card class="chart-card" elevation="0"><v-card-title><strong>Kế hoạch và thực hiện theo KPI</strong><span>So sánh giá trị tháng {{ monthLabel }}</span></v-card-title><v-card-text><ZoomableKpiChart class="chart" :option="monthlyBarOption" axis="y" :count="chartRows.length" /></v-card-text></v-card></v-col>
        <v-col cols="12" lg="6"><v-card class="chart-card" elevation="0"><v-card-title><strong>Hoàn thành kế hoạch lũy kế theo KPI</strong><span>Tỷ lệ đến {{ monthLabel }} · đường nét đứt là mốc 100%</span></v-card-title><v-card-text><ZoomableKpiChart class="chart" :option="cumulativeRateOption" axis="y" :count="cumulativeRateRows.length" /></v-card-text></v-card></v-col>
      </v-row>
      </template>
      <template v-else>
        <v-row class="summary-row">
          <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>DOANH THU THÁNG </small><strong>{{ currentTrend?.revenue == null ? '—' : formatRevenue(currentTrend.revenue) }}</strong></v-card></v-col>
          <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>DOANH THU LŨY KẾ</small><strong>{{ trendHasRevenue ? formatRevenue(cumulativeRevenue) : '—' }}</strong></v-card></v-col>
          <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>SỐ THUÊ BAO THÁNG</small><strong>{{ currentTrend?.subscribers == null ? '—' : numberFormat.format(currentTrend.subscribers) }}</strong></v-card></v-col>
        </v-row>
        <v-alert v-if="!trendHasData" class="mt-4" type="info" variant="tonal">Không có dữ liệu {{ selectedProcedureLabel }} từ đầu năm đến {{ monthLabel }}.</v-alert>
        <template v-else>
          <v-row class="chart-row trend-chart-row">
            <v-col v-if="trendHasRevenue" cols="12" :lg="trendHasSubscribers ? 6 : 12">
              <v-card class="chart-card" elevation="0">
                <v-card-title><strong>Doanh thu {{ selectedProcedureLabel }}</strong><span>Theo tháng đến {{ monthLabel }}</span></v-card-title>
                <div class="trend-chart-kpi">
                  <div><small>DOANH THU THÁNG MỚI NHẤT</small><strong>{{ currentTrend?.revenue == null ? '—' : formatRevenue(currentTrend.revenue) }}</strong></div>
                  <div class="trend-chart-change" :class="revenueChange ? (revenueChange.delta > 0 ? 'is-up' : revenueChange.delta < 0 ? 'is-down' : 'is-neutral') : 'is-neutral'">
                    <v-icon :icon="revenueChange && revenueChange.delta > 0 ? 'mdi-trending-up' : revenueChange && revenueChange.delta < 0 ? 'mdi-trending-down' : 'mdi-minus'" size="18" />
                    <span>{{ signedChange(revenueChange, 'revenue') }}</span>
                  </div>
                </div>
                <v-card-text><ZoomableKpiChart class="chart" :option="trendRevenueOption" axis="y" anchor="end" :count="trendRows.length" /></v-card-text>
              </v-card>
            </v-col>
            <v-col v-if="trendHasSubscribers" cols="12" :lg="trendHasRevenue ? 6 : 12">
              <v-card class="chart-card" elevation="0">
                <v-card-title><strong>Số thuê bao {{ selectedProcedureLabel }}</strong>
                  <span>Xu hướng đến {{ monthLabel }}</span>
                
                </v-card-title>
                <div class="trend-chart-kpi">
                  <div><small>SỐ THUÊ BAO THÁNG MỚI NHẤT</small><strong>{{ currentTrend?.subscribers == null ? '—' : numberFormat.format(currentTrend.subscribers) }}</strong></div>
                  <div class="trend-chart-change" :class="subscriberChange ? (subscriberChange.delta > 0 ? 'is-up' : subscriberChange.delta < 0 ? 'is-down' : 'is-neutral') : 'is-neutral'">
                    <v-icon :icon="subscriberChange && subscriberChange.delta > 0 ? 'mdi-trending-up' : subscriberChange && subscriberChange.delta < 0 ? 'mdi-trending-down' : 'mdi-minus'" size="18" />
                    <span>{{ signedChange(subscriberChange, 'subscribers') }}</span>
                  </div>
                </div>
                <v-card-text><ZoomableKpiChart class="chart" :option="trendSubscribersOption" axis="y" anchor="end" :count="trendRows.length" /></v-card-text>
              </v-card>
            </v-col>
          </v-row>
          <v-card class="table-card trend-table-card" elevation="0">
            <v-card-title><div><strong>Chi tiết {{ selectedProcedureLabel }} theo tháng</strong><span>Doanh thu, số thuê bao và tổng doanh thu lũy kế đến {{ monthLabel }}</span></div></v-card-title>
            <v-data-table
              :headers="[{ title: 'Tháng', key: 'month', fixed: 'start', width: 190 }, { title: 'Doanh thu', key: 'revenue', align: 'end' }, { title: 'Số thuê bao', key: 'subscribers', align: 'end' }, { title: 'Tổng doanh thu lũy kế', key: 'totalRevenue', align: 'end' }]"
              :items="trendTableRows"
              :items-per-page="12"
              hide-default-footer
              density="comfortable"
              hover
              class="kpi-table"
            >
              <template #item.month="{ value }">Tháng {{ Number(value.slice(5)) }}/{{ value.slice(0, 4) }}</template>
              <template #item.revenue="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.subscribers="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.totalRevenue="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
            </v-data-table>
          </v-card>
        </template>
      </template>
    </template>
  </v-container>
</template>

<style scoped>
.kpi-page{width:min(1500px,calc(100% - 40px));margin:0 auto;padding:28px 0 60px}.page-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:22px}.eyebrow{color:rgb(var(--v-theme-primary));font-size:11px;font-weight:800;letter-spacing:1.2px}.page-head h1{margin:5px 0;color:rgb(var(--v-theme-on-background));font-size:28px}.page-head p{margin:0;color:rgba(var(--v-theme-on-background),.62)}.filter-card,.summary-card,.chart-card,.table-card{border:0;border-radius:12px;background:rgb(var(--v-theme-surface));box-shadow:0 4px 18px rgba(29,61,83,.08)!important}.filter-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.filter-row :deep(.v-input){max-width:280px}.summary-row,.chart-row{margin-top:8px}.chart-filter{margin-top:16px}.chart-filter :deep(.v-card-text){padding:14px 18px}.chart-filter-label{margin-bottom:12px;color:rgba(var(--v-theme-on-surface),.65);font-size:12px;font-weight:700}.chart-filter-grid{display:flex;flex-wrap:nowrap;gap:10px;overflow-x:auto;padding-bottom:3px;scrollbar-width:thin;scrollbar-color:rgba(var(--v-theme-primary),.3) transparent}.filter-chip{flex:0 0 auto;width:auto;height:auto!important;min-height:42px!important;margin:0!important;padding:7px 14px!important;border-radius:12px!important;justify-content:center;white-space:nowrap!important;text-align:center}.filter-chip :deep(.v-chip__content){white-space:nowrap;text-align:center;line-height:1.3}.summary-card{height:100%;padding:18px 20px}.summary-card small,.summary-card strong{display:block}.summary-card small{color:rgba(var(--v-theme-on-surface),.58);font-size:11px;font-weight:700;letter-spacing:.5px}.summary-card strong{margin-top:8px;color:rgb(var(--v-theme-primary));font-size:24px}.chart-card{height:100%;overflow:hidden}.chart-card :deep(.v-card-title),.table-card :deep(.v-card-title){padding:19px 21px 9px;white-space:normal}.chart-card :deep(.v-card-title strong),.chart-card :deep(.v-card-title span),.table-card :deep(.v-card-title strong),.table-card :deep(.v-card-title span){display:block}.chart-card :deep(.v-card-title strong),.table-card :deep(.v-card-title strong){font-size:16px}.chart-card :deep(.v-card-title span),.table-card :deep(.v-card-title span){margin-top:5px;color:rgba(var(--v-theme-on-surface),.56);font-size:12px;font-weight:400}.chart-card :deep(.v-card-text){padding:0 12px 12px}.chart{height:360px}.table-card{height:100%;overflow:hidden}.kpi-table :deep(.v-table__wrapper){scrollbar-width:thin;scrollbar-color:rgba(var(--v-theme-primary),.32) transparent}.kpi-table :deep(table){border-collapse:separate;border-spacing:0}.kpi-table :deep(th){min-width:112px!important;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 7%,rgb(var(--v-theme-surface)))!important;color:rgb(var(--v-theme-primary))!important;font-size:12px!important;font-weight:700!important;white-space:nowrap;z-index:2!important}.kpi-table :deep(th:first-child){position:sticky;left:0;z-index:5!important;min-width:190px!important;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 7%,rgb(var(--v-theme-surface)))!important;box-shadow:2px 0 4px rgba(29,61,83,.08)}.kpi-table :deep(td){min-width:112px;border-bottom-color:rgba(var(--v-border-color),.1)!important;font-size:12px;white-space:nowrap}.kpi-table :deep(td:first-child){position:sticky;left:0;z-index:2;min-width:190px;font-weight:600;background:rgb(var(--v-theme-surface));box-shadow:2px 0 4px rgba(29,61,83,.06)}.kpi-table :deep(tbody tr:nth-child(even) td:first-child){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 2.2%,rgb(var(--v-theme-surface)))}.kpi-table :deep(tbody tr:hover td:first-child){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 6.5%,rgb(var(--v-theme-surface)))!important}.kpi-table :deep(tbody tr:nth-child(even)){background:rgba(var(--v-theme-primary),.022)}.kpi-table :deep(tbody tr:hover){background:rgba(var(--v-theme-primary),.065)!important}.kpi-table :deep(.v-data-table-footer){border-top:1px solid rgba(var(--v-border-color),.1);background:color-mix(in srgb,rgb(var(--v-theme-primary)) 3%,rgb(var(--v-theme-surface)))}@media(max-width:600px){.kpi-page{width:calc(100% - 24px)}.page-head{align-items:flex-start;flex-direction:column}.filter-row{align-items:stretch;flex-direction:column}.filter-row :deep(.v-input){max-width:none}}
.trend-chart-kpi{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:78px;padding:6px 21px 10px}.trend-chart-kpi>div:first-child{min-width:0}.trend-chart-kpi small,.trend-chart-kpi strong{display:block}.trend-chart-kpi small{color:#718397;font-size:10px;font-weight:700;letter-spacing:.4px}.trend-chart-kpi strong{margin-top:4px;color:#0068b5;font-size:21px;line-height:1.2}.trend-chart-change{display:flex;align-items:center;gap:5px;flex:0 0 auto;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:700;white-space:nowrap}.trend-chart-change.is-up{color:#087d78;background:#e3f5f1}.trend-chart-change.is-down{color:#b65435;background:#fff0e9}.trend-chart-change.is-neutral{color:#607587;background:#edf2f6}@media(max-width:700px){.trend-chart-kpi{align-items:flex-start;flex-direction:column}.trend-chart-change{white-space:normal}}
.mode-toggle{display:flex;align-items:center;gap:8px;margin-left:auto;padding:0;color:rgb(var(--v-theme-primary));font-size:13px;font-weight:600;white-space:nowrap}.mode-toggle :deep(.v-input){flex:0 0 auto;width:42px;max-width:none;margin:0}.mode-toggle :deep(.v-selection-control){min-height:30px}.mode-toggle :deep(.v-switch__track){opacity:.25}.mode-toggle :deep(.v-switch__thumb){box-shadow:0 1px 4px rgba(20,50,70,.2)}.trend-table-card{margin-top:20px}@media(max-width:600px){.mode-toggle{margin-left:0;align-self:flex-end}}
</style>
