<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { useTheme } from 'vuetify'
import { kpiApi } from '../api/kpi.api'
import { getAuthErrorMessage } from '../api/auth.api'
import type { KpiV2Code, KpiV2Row } from '../types/kpi'
import { adaptChartOptionForTheme } from '../utils/chart-theme'
import '../plugins/echarts'

type AmountKey = 'monthlyRevenue' | 'monthlyPlan' | 'cumulativeRevenue' | 'cumulativePlan' | 'annualPlan'
type UnitPeriod = 'monthly' | 'cumulative' | 'annual'
const provinceCode = '237'
const kpiColors = ['#0789c7', '#16a6a0', '#e99a28', '#8b61cf', '#e05b65', '#7da934', '#b768a3', '#4c79c5']
const achievedColor = '#20984f'
const unmetColor = '#d5424b'
const topColor = '#1674c6'
const middleColor = '#d18a22'
const noPlanColor = '#8193a3'
const planColor = '#1879c5'
const theme = useTheme()
const months = ref<string[]>([])
const month = ref('')
const monthMenuOpen = ref(false)
const pickerMonth = ref(new Date().getMonth())
const pickerYear = ref(new Date().getFullYear())
const pickerViewMode = ref<'month' | 'months' | 'year'>('months')
const rows = ref<KpiV2Row[]>([])
const scope = ref<'province' | 'unit'>('province')
const unitCode = ref<string | null>(null)
const selectedKpi = ref<KpiV2Code>('')
const unitPeriod = ref<UnitPeriod>('monthly')
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
let loadVersion = 0
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const money = (value: number | null | undefined) => value == null ? '—' : nf.format(value / 1_000_000)
const billions = (value: number | null | undefined) => value == null ? '—' : `${nf.format(value / 1_000_000_000)} tỷ đồng`
const percent = (value: number | null | undefined) => value == null ? '—' : `${nf.format(value)}%`
const rate = (actual: number | null, plan: number | null) => actual != null && plan != null && plan > 0 ? actual / plan * 100 : null
const monthLabel = computed(() => month.value ? `tháng ${Number(month.value.slice(5))}/${month.value.slice(0, 4)}` : '')
const pickerLabel = computed(() => month.value ? `Tháng ${Number(month.value.slice(5))}/${month.value.slice(0, 4)}` : 'Chọn tháng')
const kpis = computed(() => {
  const names = new Map<string, string>()
  for (const row of rows.value) {
    if (!names.has(row.kpi) || !names.get(row.kpi)) names.set(row.kpi, row.chartName.trim())
  }
  return [...names.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi', { numeric: true }))
  .map(([code, chartName], index) => {
    const title = chartName.replace(/^Tổng\s+/i, '').trim() || code
    const label = title.replace(/^Doanh thu\s+(?:dịch vụ\s+)?/i, '').trim() || code
    return { code, title, label, color: kpiColors[index % kpiColors.length] }
  })
})
watch(kpis, options => {
  if (options.length && !options.some(item => item.code === selectedKpi.value)) selectedKpi.value = options[0]!.code
})
const provinceRows = computed(() => rows.value.filter(row => row.unitCode === provinceCode))
const missingProvinceKpis = computed(() => kpis.value.filter(kpi => !provinceRows.value.some(row => row.kpi === kpi.code)))
const unitRows = computed(() => rows.value.filter(row => row.unitCode !== provinceCode))
const unitOptions = computed(() => [...new Map(unitRows.value.map(row => [row.unitCode, { title: row.unitName, value: row.unitCode }])).values()].sort((a, b) => a.title.localeCompare(b.title, 'vi')))
const visibleUnits = computed(() => unitOptions.value.filter(unit => !unitCode.value || unit.value === unitCode.value))
const visibleUnitRows = computed(() => unitRows.value.filter(row => !unitCode.value || row.unitCode === unitCode.value))
const selectedRows = computed(() => visibleUnitRows.value.filter(row => row.kpi === selectedKpi.value).sort((a, b) =>
  (a.rank && b.rank ? a.rank - b.rank : 0) || a.unitName.localeCompare(b.unitName, 'vi')))
const rankedUnitCodes = computed(() => unitRows.value.filter(row => row.kpi === selectedKpi.value)
  .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.unitName.localeCompare(b.unitName, 'vi'))
  .map(row => row.unitCode))
const unitPeriodFields = computed<{ actual: AmountKey; plan: AmountKey; label: string; planLabel: string }>(() => {
  if (unitPeriod.value === 'cumulative') return { actual: 'cumulativeRevenue', plan: 'cumulativePlan', label: 'Thực hiện lũy kế', planLabel: 'Kế hoạch lũy kế' }
  if (unitPeriod.value === 'annual') return { actual: 'cumulativeRevenue', plan: 'annualPlan', label: 'Thực hiện lũy kế', planLabel: 'Kế hoạch năm' }
  return { actual: 'monthlyRevenue', plan: 'monthlyPlan', label: 'Thực hiện tháng', planLabel: 'Kế hoạch tháng' }
})
const unitActual = (row: KpiV2Row) => row[unitPeriodFields.value.actual]
const unitPlan = (row: KpiV2Row) => row[unitPeriodFields.value.plan]
function unitRankStyle(row: KpiV2Row): 'top' | 'bottom' | 'good' | 'warning' | 'neutral' {
  const position = rankedUnitCodes.value.indexOf(row.unitCode)
  if (position >= 0 && position < 3) return 'top'
  if (position >= 0 && position >= rankedUnitCodes.value.length - 3) return 'bottom'
  const completion = rate(unitActual(row), unitPlan(row))
  return completion == null ? 'neutral' : completion >= 100 ? 'good' : 'warning'
}
function unitRankColor(row: KpiV2Row): string {
  const style = unitRankStyle(row)
  return style === 'top' ? topColor : style === 'bottom' ? unmetColor : style === 'good' ? achievedColor : style === 'warning' ? middleColor : noPlanColor
}

function sum(items: KpiV2Row[], key: AmountKey): number | null {
  const values = items.map(item => item[key]).filter((value): value is number => value != null)
  return values.length ? values.reduce((total, value) => total + value, 0) : null
}

const provinceTotal = computed(() => {
  const source = provinceRows.value
  const monthlyRevenue = sum(source, 'monthlyRevenue')
  const monthlyPlan = sum(source, 'monthlyPlan')
  const cumulativeRevenue = sum(source, 'cumulativeRevenue')
  const cumulativePlan = sum(source, 'cumulativePlan')
  const annualPlan = sum(source, 'annualPlan')
  return { monthlyRevenue, monthlyPlan, cumulativeRevenue, cumulativePlan, annualPlan,
    monthlyRate: rate(monthlyRevenue, monthlyPlan),
    cumulativeRate: rate(cumulativeRevenue, cumulativePlan),
    annualRate: rate(cumulativeRevenue, annualPlan) }
})

function rateColor(value: number | null): string {
  if (value == null) return theme.global.current.value.dark ? '#b8cbd8' : '#728599'
  if (value < 70) return theme.global.current.value.dark ? '#ff8582' : '#c62828'
  if (value < 100) return theme.global.current.value.dark ? '#f0bf6a' : '#a66b00'
  return theme.global.current.value.dark ? '#6fd7a5' : '#19804d'
}

const shareOption = computed(() => adaptChartOptionForTheme({
  tooltip: { trigger: 'item', formatter: ({ name, value, percent: share }: { name: string; value: number; percent: number }) => `${name}<br/>${billions(value)} · ${nf.format(share)}%` },
  legend: { type: 'scroll', bottom: 2, selectedMode: false },
  series: [{ type: 'pie', radius: ['38%', '68%'], center: ['50%', '45%'],
    itemStyle: { borderRadius: 5, borderWidth: 3, borderColor: theme.global.current.value.dark ? '#1a2937' : '#fff' },
    label: { formatter: '{d}%', fontSize: 13 },
    data: kpis.value.flatMap(kpi => {
      const value = provinceRows.value.find(row => row.kpi === kpi.code)?.monthlyRevenue
      return value == null ? [] : [{ name: kpi.label, value, itemStyle: { color: kpi.color } }]
    }),
  }],
}, theme.global.current.value.dark))

const annualProgressOption = computed(() => {
  const source = kpis.value.map(kpi => ({ ...kpi, row: provinceRows.value.find(row => row.kpi === kpi.code) }))
  return adaptChartOptionForTheme({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (items: Array<{ dataIndex: number }>) => {
      const item = source[items[0]?.dataIndex ?? -1]
      return item ? `${item.title}<br/>TH lũy kế: ${billions(item.row?.cumulativeRevenue)}<br/>KH năm: ${billions(item.row?.annualPlan)}<br/>Hoàn thành: ${percent(rate(item.row?.cumulativeRevenue ?? null, item.row?.annualPlan ?? null))}` : ''
    } },
    grid: { left: 150, right: 105, top: 22, bottom: 43 },
    xAxis: { type: 'value', min: 0, max: (range: { max: number }) => Math.max(110, Math.ceil(range.max / 10) * 10), axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#e8eef3' } } },
    yAxis: { type: 'category', inverse: true, data: source.map(item => item.label), axisTick: { show: false }, axisLabel: { width: 136, overflow: 'truncate' } },
    series: [{ type: 'bar', barMaxWidth: 30, data: source.map(item => {
      const value = rate(item.row?.cumulativeRevenue ?? null, item.row?.annualPlan ?? null)
      return { value, itemStyle: { color: rateColor(value), borderRadius: [0, 5, 5, 0] } }
    }), label: { show: true, position: 'right', formatter: ({ value }: { value: number | null }) => percent(value) },
    markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#728599', type: 'dashed' }, data: [{ xAxis: 100 }] },
    }],
  }, theme.global.current.value.dark)
})

const unitChartOption = computed(() => {
  const source = selectedRows.value
  return adaptChartOptionForTheme({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (items: Array<{ dataIndex: number }>) => {
      const row = source[items[0]?.dataIndex ?? -1]
      return row ? `${row.unitName}<br/>${unitPeriodFields.value.planLabel}: ${billions(unitPlan(row))}<br/>${unitPeriodFields.value.label}: ${billions(unitActual(row))}<br/>Hoàn thành: ${percent(rate(unitActual(row), unitPlan(row)))}${row.rank ? `<br/>Xếp hạng: ${whole.format(row.rank)}` : ''}` : ''
    } },
    legend: { show: false },
    grid: { left: 54, right: 36, top: 22, bottom: 115 },
    xAxis: { type: 'category', data: source.map(row => row.unitName.replace(/^Trung tâm Viễn thông\s*/i, '')), axisTick: { alignWithLabel: true }, axisLabel: { interval: 0, width: 92, overflow: 'truncate',
      rich: {
        unit: { fontSize: 12, fontWeight: 700, lineHeight: 19, color: theme.global.current.value.dark ? '#e8f1f7' : '#243b53' },
        top: { fontSize: 11, fontWeight: 700, lineHeight: 16, color: topColor },
        bottom: { fontSize: 11, fontWeight: 700, lineHeight: 16, color: unmetColor },
        good: { fontSize: 11, fontWeight: 700, lineHeight: 16, color: achievedColor },
        warning: { fontSize: 11, fontWeight: 700, lineHeight: 16, color: middleColor },
        neutral: { fontSize: 11, fontWeight: 600, lineHeight: 16, color: theme.global.current.value.dark ? '#b8cbd8' : '#728599' },
        rank: { fontSize: 10, fontWeight: 600, lineHeight: 15, color: theme.global.current.value.dark ? '#b8cbd8' : '#60768a' },
        rankTop: { fontSize: 10, fontWeight: 700, lineHeight: 15, color: topColor },
        rankBottom: { fontSize: 10, fontWeight: 700, lineHeight: 15, color: unmetColor },
      },
      formatter: (value: string, index: number) => {
        const row = source[index]
        const completion = row ? rate(unitActual(row), unitPlan(row)) : null
        const status = row ? unitRankStyle(row) : 'neutral'
        const rankStatus = status === 'top' ? 'rankTop' : status === 'bottom' ? 'rankBottom' : 'rank'
        return `{unit|${value.replace(/[{}|]/g, '')}}\n{${status}|${percent(completion)}}${row?.rank ? `\n{${rankStatus}|Hạng ${whole.format(row.rank)}}` : ''}`
      } },
    },
    yAxis: { type: 'value', name: 'tỷ đồng', axisLabel: { formatter: (value: number) => nf.format(value / 1_000_000_000) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
    series: [
      { name: 'Thực hiện', type: 'bar', barMaxWidth: 42, data: source.map(row => {
        return { value: unitActual(row), itemStyle: { color: unitRankColor(row), borderRadius: [4, 4, 0, 0] } }
      }) },
      { name: 'Kế hoạch', type: 'line', symbol: 'circle', symbolSize: 8, smooth: false, lineStyle: { width: 2, color: planColor }, itemStyle: { color: planColor }, data: source.map(row => unitPlan(row)) },
    ],
  }, theme.global.current.value.dark)
})

function selectChartUnit(event: { dataIndex?: number }) {
  const item = selectedRows.value[event.dataIndex ?? -1]
  if (item) unitCode.value = unitCode.value === item.unitCode ? null : item.unitCode
}

watch(monthMenuOpen, open => {
  if (!open || !month.value) return
  pickerMonth.value = Number(month.value.slice(5)) - 1
  pickerYear.value = Number(month.value.slice(0, 4))
  pickerViewMode.value = 'months'
})

function selectMonth(selectedMonth: number) {
  const nextMonth = `${pickerYear.value}-${String(selectedMonth + 1).padStart(2, '0')}`
  monthMenuOpen.value = false
  if (month.value === nextMonth) return
  loadVersion += 1
  month.value = nextMonth
  rows.value = []
  loaded.value = false
  loading.value = false
  error.value = ''
  unitCode.value = null
}

async function load() {
  if (!month.value) return
  const version = ++loadVersion
  const queryMonth = month.value
  loading.value = true
  error.value = ''
  try {
    const result = await kpiApi.v2Report(queryMonth)
    if (version !== loadVersion) return
    rows.value = result.rows
    loaded.value = true
    if (unitCode.value && !result.rows.some(row => row.unitCode === unitCode.value)) unitCode.value = null
  } catch (cause) {
    if (version !== loadVersion) return
    error.value = getAuthErrorMessage(cause)
    rows.value = []
    loaded.value = true
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    months.value = await kpiApi.v2Months()
    month.value = months.value[0] ? `${months.value[0].slice(0, 4)}-${months.value[0].slice(4)}` : ''
    if (month.value) await load()
    else loaded.value = true
  } catch (cause) {
    error.value = getAuthErrorMessage(cause)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <v-container class="giao-ban-v2" fluid>
    <v-card class="report-shell" elevation="0">
      <header class="report-heading"><v-icon icon="mdi-chart-bar" size="26" /><h1>DỮ LIỆU GIAO BAN</h1></header>
      <div class="filters">
        <v-menu v-model="monthMenuOpen" :close-on-content-click="false">
          <template #activator="{ props: activatorProps }"><v-text-field v-bind="activatorProps" :model-value="pickerLabel" label="Tháng báo cáo" prepend-inner-icon="mdi-calendar-month-outline" variant="outlined" density="compact" hide-details readonly :disabled="!months.length" /></template>
          <v-date-picker :month="pickerMonth" :year="pickerYear" v-model:view-mode="pickerViewMode" hide-header color="primary" @update:month="selectMonth" @update:year="pickerYear = $event" />
        </v-menu>
        <v-select v-model="scope" :items="[{ title: '1. Báo cáo Viễn thông tỉnh', value: 'province' }, { title: '2. Báo cáo địa bàn cấp 2', value: 'unit' }]" label="Địa bàn cấp" variant="outlined" density="compact" hide-details @update:model-value="unitCode = null" />
        <v-autocomplete v-if="scope === 'unit'" v-model="unitCode" :items="unitOptions" label="Địa bàn" placeholder="Toàn tỉnh" variant="outlined" density="compact" clearable hide-details />
        <v-text-field v-else model-value="Toàn tỉnh" label="Địa bàn" variant="outlined" density="compact" hide-details readonly />
        <v-btn color="primary" prepend-icon="mdi-database-search-outline" :loading="loading" :disabled="!month" @click="load">Lấy số liệu</v-btn>
      </div>
      <v-alert v-if="error" class="mx-5 mb-4" type="error" variant="tonal">{{ error }}</v-alert>
      <v-alert v-if="loaded && !rows.length && !error" class="mx-5 mb-4" type="info" variant="tonal">Chưa có dữ liệu cho {{ monthLabel || 'tháng đã chọn' }}.</v-alert>
      <template v-if="loaded && rows.length && !error">
        <v-alert v-if="missingProvinceKpis.length" class="mx-5 mb-4" type="warning" variant="tonal" density="compact">API chưa trả dữ liệu {{ missingProvinceKpis.map(kpi => kpi.label).join(', ') }} cho {{ monthLabel }}. Các biểu đồ và dòng tổng chỉ tính trên KPI đã nhận được.</v-alert>
        <template v-if="scope === 'province'">
          <div class="province-charts">
            <v-card class="chart-card" elevation="0"><h2>Tỷ trọng doanh thu {{ monthLabel }}</h2><VChart class="pie-chart" :option="shareOption" autoresize /></v-card>
            <v-card class="chart-card" elevation="0"><h2>Tiến độ doanh thu năm {{ month.slice(0, 4) }}</h2><p>Thực hiện lũy kế so với kế hoạch năm · {{ kpis.length }} chỉ tiêu</p><VChart class="progress-chart" :style="{ height: `${Math.max(305, kpis.length * 55 + 90)}px` }" :option="annualProgressOption" autoresize /></v-card>
          </div>
          <section class="report-section">
            <div class="section-heading"><h2>1. BÁO CÁO DOANH THU TOÀN TỈNH</h2><small>{{ monthLabel }} · đơn vị: triệu đồng</small></div>
            <v-table class="report-table" density="compact"><thead><tr><th>STT</th><th>Mã KPI</th><th>Tên KPI</th><th>KH năm</th><th>TH lũy kế</th><th>TH/KH năm</th><th>KH tháng</th><th>TH tháng</th><th>TH/KH tháng</th><th>KH lũy kế</th><th>TH/KH lũy kế</th></tr></thead><tbody>
              <tr v-for="(kpi, index) in kpis" :key="kpi.code"><td>{{ index + 1 }}</td><td>{{ kpi.code }}</td><td>{{ kpi.title }}</td><template v-if="provinceRows.find(row => row.kpi === kpi.code)"><template v-for="row in provinceRows.filter(item => item.kpi === kpi.code)" :key="row.kpi"><td>{{ money(row.annualPlan) }}</td><td>{{ money(row.cumulativeRevenue) }}</td><td :style="{ color: rateColor(rate(row.cumulativeRevenue, row.annualPlan)) }">{{ percent(rate(row.cumulativeRevenue, row.annualPlan)) }}</td><td>{{ money(row.monthlyPlan) }}</td><td>{{ money(row.monthlyRevenue) }}</td><td :style="{ color: rateColor(rate(row.monthlyRevenue, row.monthlyPlan)) }">{{ percent(rate(row.monthlyRevenue, row.monthlyPlan)) }}</td><td>{{ money(row.cumulativePlan) }}</td><td :style="{ color: rateColor(rate(row.cumulativeRevenue, row.cumulativePlan)) }">{{ percent(rate(row.cumulativeRevenue, row.cumulativePlan)) }}</td></template></template><template v-else><td v-for="n in 8" :key="n">—</td></template></tr>
              <tr class="total-row"><td colspan="3">Tổng</td><td>{{ money(provinceTotal.annualPlan) }}</td><td>{{ money(provinceTotal.cumulativeRevenue) }}</td><td>{{ percent(provinceTotal.annualRate) }}</td><td>{{ money(provinceTotal.monthlyPlan) }}</td><td>{{ money(provinceTotal.monthlyRevenue) }}</td><td>{{ percent(provinceTotal.monthlyRate) }}</td><td>{{ money(provinceTotal.cumulativePlan) }}</td><td>{{ percent(provinceTotal.cumulativeRate) }}</td></tr>
            </tbody></v-table>
          </section>
          <section class="report-section pending-section"><div class="section-heading"><h2>2. BÁO CÁO SẢN LƯỢNG THUÊ BAO TOÀN TỈNH</h2></div><v-alert type="info" variant="tonal" density="compact">Chưa có KPI sản lượng thuê bao trong nguồn dữ liệu hiện tại.</v-alert></section>
        </template>
        <template v-else>
          <div class="unit-controls">
            <v-select v-model="selectedKpi" :items="kpis.map(kpi => ({ title: `${kpi.code} - ${kpi.title}`, value: kpi.code }))" label="Chọn chỉ tiêu KPI" variant="outlined" density="comfortable" hide-details />
            <div class="unit-period"><span>Kỳ so sánh</span><v-btn-toggle v-model="unitPeriod" class="unit-period-toggle" mandatory color="primary" density="comfortable" variant="text"><v-btn value="monthly">Trong tháng</v-btn><v-btn value="cumulative">Lũy kế</v-btn><v-btn value="annual">Kế hoạch năm</v-btn></v-btn-toggle></div>
          </div>
          <v-card class="unit-chart-card" elevation="0"><h2>Tỷ lệ hoàn thành: {{ kpis.find(kpi => kpi.code === selectedKpi)?.title }}</h2><p>{{ monthLabel }} · {{ unitPeriodFields.label }} so với {{ unitPeriodFields.planLabel.toLowerCase() }} · {{ selectedRows.length }}/{{ unitOptions.length }} địa bàn có số liệu</p><template v-if="selectedRows.length"><div class="unit-legend" aria-label="Chú thích biểu đồ"><span><i class="legend-bar" :style="{ backgroundColor: topColor }" />Top 3</span><span><i class="legend-bar" :style="{ backgroundColor: achievedColor }" />Đạt kế hoạch</span><span><i class="legend-bar" :style="{ backgroundColor: middleColor }" />Chưa đạt kế hoạch</span><span><i class="legend-bar" :style="{ backgroundColor: unmetColor }" />3 hạng cuối</span><span><i class="legend-bar" :style="{ backgroundColor: noPlanColor }" />Chưa có kế hoạch</span><span><i class="legend-line" :style="{ borderColor: planColor, color: planColor }" />{{ unitPeriodFields.planLabel }}</span></div><div class="unit-chart-scroll"><VChart class="unit-chart" :style="{ minWidth: `${Math.max(880, selectedRows.length * 105)}px` }" :option="unitChartOption" autoresize @click="selectChartUnit" /></div></template><v-alert v-else class="ma-4" type="info" variant="tonal">API chưa trả dữ liệu {{ kpis.find(kpi => kpi.code === selectedKpi)?.label }} cho địa bàn đã chọn.</v-alert></v-card>
          <section class="report-section"><div class="section-heading"><h2>1. BÁO CÁO DOANH THU ĐỊA BÀN CẤP 2</h2><small>{{ monthLabel }} · {{ unitPeriodFields.label }} / {{ unitPeriodFields.planLabel }} · triệu đồng</small></div>
            <v-table class="report-table unit-table" density="compact" :style="{ '--unit-table-width': `${425 + visibleUnits.length * 164}px` }"><colgroup><col style="width:50px" /><col style="width:115px" /><col style="width:260px" /><col v-for="unit in visibleUnits" :key="unit.value" style="width:164px" /></colgroup><thead><tr><th>STT</th><th>Mã KPI</th><th>Tên KPI</th><th v-for="unit in visibleUnits" :key="unit.value">{{ unit.title.replace(/^Trung tâm Viễn thông\s*/i, '') }}</th></tr></thead><tbody>
              <tr v-for="(kpi, index) in kpis" :key="kpi.code" :class="{ 'selected-kpi-row': kpi.code === selectedKpi }"><td>{{ index + 1 }}</td><td>{{ kpi.code }}</td><td>{{ kpi.title }}</td><td v-for="unit in visibleUnits" :key="unit.value"><template v-if="visibleUnitRows.find(row => row.unitCode === unit.value && row.kpi === kpi.code)" v-for="row in visibleUnitRows.filter(item => item.unitCode === unit.value && item.kpi === kpi.code)" :key="row.unitCode"><div class="unit-amount">{{ money(unitActual(row)) }}</div><div class="unit-plan">KH {{ money(unitPlan(row)) }} <span :style="{ color: rateColor(rate(unitActual(row), unitPlan(row))) }">· {{ percent(rate(unitActual(row), unitPlan(row))) }}</span></div></template><template v-else>—</template></td></tr>
              <tr class="total-row"><td colspan="3">Tổng</td><td v-for="unit in visibleUnits" :key="unit.value"><div class="unit-amount">{{ money(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), unitPeriodFields.actual)) }}</div><div class="unit-plan">KH {{ money(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), unitPeriodFields.plan)) }} · {{ percent(rate(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), unitPeriodFields.actual), sum(visibleUnitRows.filter(row => row.unitCode === unit.value), unitPeriodFields.plan))) }}</div></td></tr>
            </tbody></v-table>
          </section>
          <section class="report-section pending-section"><div class="section-heading"><h2>2. BÁO CÁO SẢN LƯỢNG THUÊ BAO ĐỊA BÀN CẤP 2</h2></div><v-alert type="info" variant="tonal" density="compact">Chưa có KPI sản lượng thuê bao trong nguồn dữ liệu hiện tại.</v-alert></section>
        </template>
        <!-- Nguồn TONGHOP_KPI_ALL chưa có dữ liệu so sánh cùng kỳ. -->
      </template>
    </v-card>
  </v-container>
</template>

<style scoped>
.giao-ban-v2{max-width:1840px;margin:0 auto;padding:18px 22px 48px;color:rgb(var(--v-theme-on-surface))}.report-shell{background:rgb(var(--v-theme-surface));border-radius:10px;overflow:hidden;box-shadow:0 3px 18px rgba(26,62,87,.08)!important}.report-heading{display:flex;align-items:center;gap:8px;padding:18px 20px 12px;border-bottom:1px solid rgba(var(--v-border-color),.18);color:rgb(var(--v-theme-primary))}.report-heading h1{font-size:22px;font-weight:800;letter-spacing:.055em}.filters{display:flex;align-items:center;gap:12px;padding:18px 20px 20px;flex-wrap:wrap}.filters :deep(.v-input){flex:1 1 210px;max-width:290px}.filters :deep(.v-btn){min-height:42px}.giao-ban-v2 :deep(.v-btn){text-transform:none;letter-spacing:0}.province-charts{display:grid;grid-template-columns:minmax(300px,1fr) minmax(0,2fr);gap:16px;padding:0 20px 18px}.chart-card,.unit-chart-card{border:1px solid rgba(var(--v-border-color),.22);border-radius:10px;background:rgb(var(--v-theme-surface));box-shadow:0 3px 12px rgba(29,61,83,.06)!important}.chart-card{min-height:310px;padding:15px 16px}.chart-card h2,.unit-chart-card h2{font-size:16px;text-align:center}.chart-card p,.unit-chart-card p{font-size:12px;text-align:center;opacity:.7;margin-top:5px}.pie-chart,.progress-chart{height:255px;width:100%}.report-section{padding:0 20px 22px}.section-heading{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:8px 0 10px}.section-heading h2{font-size:19px;font-weight:800;color:#d52d31}.section-heading small{font-size:12px;opacity:.7}.report-table{border:1px solid rgba(var(--v-border-color),.22);border-radius:8px;overflow:auto}.report-table :deep(table){min-width:1180px;border-collapse:separate;border-spacing:0}.report-table :deep(th){background:#086fb7!important;color:#fff!important;font-weight:700!important;text-align:center!important;white-space:nowrap;padding:12px 10px!important;font-size:12px!important;border-right:1px solid #ffffff3d}.report-table :deep(td){padding:10px!important;font-size:12px;white-space:nowrap;text-align:right;border-bottom:1px solid rgba(var(--v-border-color),.14)}.report-table :deep(td:nth-child(-n+3)){text-align:left}.report-table :deep(td:nth-child(3)){font-weight:600}.report-table :deep(tbody tr:nth-child(even)){background:rgba(var(--v-theme-primary),.035)}.report-table :deep(.total-row){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 11%,rgb(var(--v-theme-surface)))!important;font-weight:800}.report-table :deep(.total-row td:first-child){text-align:left}.kpi-picker{padding:0 20px 14px}.kpi-picker :deep(.v-input){max-width:520px}.unit-chart-card{margin:0 20px 18px;padding:25px 14px 12px}.unit-chart-scroll{overflow-x:auto;scrollbar-width:thin}.unit-chart{height:430px;width:100%}.unit-table :deep(table){min-width:max-content}.unit-table :deep(th:nth-child(3)),.unit-table :deep(td:nth-child(3)){min-width:260px}.unit-table :deep(th:nth-child(n+4)),.unit-table :deep(td:nth-child(n+4)){min-width:115px}.source-note{margin:0;padding:0 20px 20px;font-size:12px;opacity:.7}@media(max-width:1000px){.province-charts{grid-template-columns:1fr}.filters :deep(.v-input){max-width:none}}@media(max-width:650px){.giao-ban-v2{padding:10px}.report-heading h1{font-size:17px}.filters,.province-charts,.report-section{padding-inline:12px}.filters :deep(.v-input),.filters :deep(.v-btn){width:100%}.section-heading{display:block}.section-heading small{display:block;margin-top:4px}}
.unit-legend{display:flex;justify-content:center;align-items:center;gap:18px;flex-wrap:wrap;margin:10px 0 2px;font-size:12px}.unit-legend span{display:inline-flex;align-items:center;gap:6px}.legend-bar{display:inline-block;width:17px;height:11px;border-radius:3px}.legend-line{display:inline-block;width:20px;height:0;border-top:3px solid;position:relative}.legend-line::after{content:'';position:absolute;left:8px;top:-5px;width:5px;height:5px;border-radius:50%;background:currentColor}
.report-table :deep(.total-row td:not(:first-child)){text-align:right}
.unit-table :deep(.v-table__wrapper){overflow-x:auto}
.unit-table :deep(table){width:var(--unit-table-width);min-width:var(--unit-table-width);table-layout:fixed}
.unit-table :deep(th:nth-child(n+3)),.unit-table :deep(td:nth-child(n+4)){min-width:0}
.unit-table :deep(thead th:nth-child(-n+3)){position:sticky;z-index:4;background:#086fb7!important}
.unit-table :deep(thead th:nth-child(1)),.unit-table :deep(tbody tr:not(.total-row) td:nth-child(1)){left:0}
.unit-table :deep(thead th:nth-child(2)),.unit-table :deep(tbody tr:not(.total-row) td:nth-child(2)){left:50px}
.unit-table :deep(thead th:nth-child(3)),.unit-table :deep(tbody tr:not(.total-row) td:nth-child(3)){left:165px;box-shadow:3px 0 6px rgba(25,50,70,.12)}
.unit-table :deep(tbody tr:not(.total-row) td:nth-child(-n+3)){position:sticky;z-index:2;background:rgb(var(--v-theme-surface))}
.unit-table :deep(tbody tr:nth-child(even):not(.total-row) td:nth-child(-n+3)){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 3.5%,rgb(var(--v-theme-surface)))}
.unit-table :deep(.total-row td:first-child){position:sticky;left:0;z-index:3;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 11%,rgb(var(--v-theme-surface)));box-shadow:3px 0 6px rgba(25,50,70,.12)}
.unit-table :deep(tbody tr:nth-child(even):not(.selected-kpi-row):not(.total-row)){background:transparent!important}
.unit-table :deep(tbody tr:nth-child(even):not(.selected-kpi-row):not(.total-row) td:nth-child(-n+3)){background:rgb(var(--v-theme-surface))!important}
.unit-table :deep(tbody tr.total-row td){background:color-mix(in srgb,rgb(var(--v-theme-on-surface)) 7%,rgb(var(--v-theme-surface)))!important}
.unit-table :deep(tbody tr.selected-kpi-row td){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 17%,rgb(var(--v-theme-surface)))!important;border-top:1px solid color-mix(in srgb,rgb(var(--v-theme-primary)) 36%,transparent);border-bottom:1px solid color-mix(in srgb,rgb(var(--v-theme-primary)) 36%,transparent)}
.unit-table :deep(tbody tr.selected-kpi-row td:first-child){box-shadow:inset 4px 0 rgb(var(--v-theme-primary))}
.unit-table :deep(tbody tr.selected-kpi-row td:nth-child(2)),.unit-table :deep(tbody tr.selected-kpi-row td:nth-child(3)){color:rgb(var(--v-theme-primary));font-weight:800}
.province-charts .chart-card{min-height:365px}
.pie-chart,.progress-chart{height:305px}
.unit-controls{display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:2px 20px 18px}.unit-controls :deep(.v-input){flex:1 1 340px;max-width:520px}.unit-period{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.unit-period>span{font-size:12px;font-weight:700;color:rgb(var(--v-theme-on-surface));opacity:.7;white-space:nowrap}.unit-period-toggle{display:flex;align-items:center;gap:4px;height:auto;padding:4px;border:1px solid rgba(var(--v-border-color),.22);border-radius:11px;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 5%,rgb(var(--v-theme-surface)));box-shadow:none}.unit-period-toggle :deep(.v-btn){height:36px!important;min-width:0;padding:0 15px;border-radius:8px!important;font-size:12px;font-weight:650;letter-spacing:0;text-transform:none}.unit-period-toggle :deep(.v-btn--active){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))!important;box-shadow:0 2px 7px rgba(0,87,150,.2)}.unit-period-toggle :deep(.v-btn--active .v-btn__overlay){opacity:0}.unit-amount{font-weight:700;font-variant-numeric:tabular-nums}.unit-plan{margin-top:3px;font-size:11px;font-weight:500;opacity:.82;font-variant-numeric:tabular-nums}.unit-plan span{font-weight:700;opacity:1}@media(max-width:650px){.unit-controls{padding-inline:12px;gap:12px}.unit-controls :deep(.v-input){flex-basis:100%}.unit-period{width:100%;justify-content:space-between}.unit-period-toggle :deep(.v-btn){padding-inline:9px;font-size:11px}}
</style>
