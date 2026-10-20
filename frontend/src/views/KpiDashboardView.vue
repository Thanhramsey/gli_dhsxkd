<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ZoomableKpiChart from '../components/charts/ZoomableKpiChart.vue'
import { kpiApi } from '../api/kpi.api'
import { getAuthErrorMessage } from '../api/auth.api'
import type { KpiMaintenanceRow, KpiPscProcedure, KpiPscRow, KpiRow, KpiTrendProcedure, KpiTrendRow } from '../types/kpi'
import '../plugins/echarts'

const now = new Date()
const monthNumber = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())
const monthOptions = Array.from({ length: 12 }, (_, index) => ({ title: `Tháng ${index + 1}`, value: index + 1 }))
const yearOptions = Array.from({ length: 8 }, (_, index) => now.getFullYear() + 1 - index)
const month = computed(() => `${year.value}-${String(monthNumber.value).padStart(2, '0')}`)
type KpiMaintenanceProcedure = 'BC_DT_DUY_TRI_FIBER_MYTV'
const procedureOptions: { title: string; value: 'TONG_HOP_KPI' | KpiTrendProcedure | KpiPscProcedure | KpiMaintenanceProcedure }[] = [
  { title: 'Tổng hợp KPI', value: 'TONG_HOP_KPI' },
  { title: 'BRCD (Fiber)', value: 'TONG_HOP_KPI_BRCD' },
  { title: 'MyTV', value: 'TONG_HOP_KPI_MYTV' },
  { title: 'Camera', value: 'TONG_HOP_KPI_CAM' },
  { title: 'Mesh', value: 'TONG_HOP_KPI_MESH' },
  { title: 'TSL', value: 'TONG_HOP_KPI_TSL' },
  { title: 'Internet trực tiếp', value: 'TONG_HOP_KPI_DITT' },
  { title: 'CNTT phân bổ', value: 'TONG_HOP_KPI_CNTT' },
  { title: 'Vina trả sau', value: 'TONG_HOP_KPI_VINA_TS' },
  { title: 'Tỷ lệ ngừng PSC Fiber', value: 'TYLE_NGUNG_PSC_FIBER' },
  { title: 'Tỷ lệ ngừng PSC MyTV', value: 'TYLE_NGUNG_PSC_MYTV' },
  { title: 'Doanh thu duy trì Fiber + MyTV', value: 'BC_DT_DUY_TRI_FIBER_MYTV' },
]
const selectedProcedure = ref<'TONG_HOP_KPI' | KpiTrendProcedure | KpiPscProcedure | KpiMaintenanceProcedure>('TONG_HOP_KPI')
const rows = ref<KpiRow[]>([])
const trendRows = ref<KpiTrendRow[]>([])
const pscRows = ref<KpiPscRow[]>([])
const maintenanceRows = ref<KpiMaintenanceRow[]>([])
const selectedKpiNames = ref<string[]>([])
const cumulativeMode = ref(false)
const chipColors = ['#d9efff', '#def5ec', '#fff0d6', '#eee5ff', '#ffe4e4', '#e4edff', '#e5f2d9']
const chartRows = computed(() => selectedKpiNames.value.length
  ? rows.value.filter(row => selectedKpiNames.value.includes(row.name))
  : rows.value)
type SortDirection = 'asc' | 'desc'
const shareSort = ref<SortDirection>('desc')
const monthlySort = ref<SortDirection>('desc')
const cumulativeRateSort = ref<SortDirection>('desc')
const revenueSort = ref<SortDirection>('asc')
const subscriberSort = ref<SortDirection>('asc')
const selectedSnapshotMonth = ref<string | null>(null)
const snapshotMonthlyView = ref<'value' | 'rate'>('value')
const sortIcon = (direction: SortDirection) => direction === 'desc' ? 'mdi-sort-descending' : 'mdi-sort-ascending'
const sortTitle = (direction: SortDirection, byMonth = false) => `Đang xếp ${direction === 'desc' ? 'giảm' : 'tăng'} dần theo ${byMonth ? 'tháng' : 'giá trị'}. Bấm để đảo chiều.`
const toggleSort = (direction: SortDirection): SortDirection => direction === 'desc' ? 'asc' : 'desc'
const monthlyChartRows = computed(() => [...chartRows.value].sort((a, b) =>
  (monthlySort.value === 'asc' ? 1 : -1) * (a.monthlyActual - b.monthlyActual) || a.name.localeCompare(b.name, 'vi')))
const cumulativeRateRows = computed(() => [...chartRows.value].sort((a, b) =>
  (cumulativeRateSort.value === 'asc' ? 1 : -1) * ((a.cumulativeRate ?? 0) - (b.cumulativeRate ?? 0)) || a.name.localeCompare(b.name, 'vi')))
const shareRows = computed(() => {
  const values = rows.value.map(row => ({ name: row.name, actual: cumulativeMode.value ? row.cumulativeActual : row.monthlyActual }))
  const total = values.reduce((sum, row) => sum + Math.max(row.actual, 0), 0)
  return values.map(row => ({ ...row, value: total ? Math.max(row.actual, 0) / total * 100 : 0 })).sort((a, b) =>
    (shareSort.value === 'asc' ? 1 : -1) * (a.value - b.value) || a.name.localeCompare(b.name, 'vi'))
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
const isPscProcedure = (procedure: string): procedure is KpiPscProcedure => procedure === 'TYLE_NGUNG_PSC_FIBER' || procedure === 'TYLE_NGUNG_PSC_MYTV'
const isMaintenanceProcedure = (procedure: string): procedure is KpiMaintenanceProcedure => procedure === 'BC_DT_DUY_TRI_FIBER_MYTV'
const snapshotKpiCodes: Readonly<Record<string, string | undefined>> = {
  TONG_HOP_KPI_BRCD: 'F1.FIBER_C2',
  TONG_HOP_KPI_MYTV: 'F1.MYTV_C2',
  TONG_HOP_KPI_CAM: 'F1.CAM_C2',
  TONG_HOP_KPI_MESH: 'F1.MESH_C2',
  TONG_HOP_KPI_DITT: 'F1.DITT_C2',
  TONG_HOP_KPI_TSL: 'F4.3_C2',
  TONG_HOP_KPI_CNTT: 'F4.1_C2',
}
const snapshotKpiCode = computed(() => snapshotKpiCodes[selectedProcedure.value] ?? '')
const isSnapshotTrend = computed(() => Boolean(snapshotKpiCode.value))
function isSnapshotProcedure(procedure: string): procedure is KpiTrendProcedure {
  return Boolean(snapshotKpiCodes[procedure])
}
const pageDescription = computed(() => selectedProcedure.value === 'TONG_HOP_KPI'
  ? 'Kế hoạch và kết quả thực hiện theo từng chỉ tiêu trong'
  : isPscProcedure(selectedProcedure.value)
    ? 'Tỷ lệ ngừng phát sinh cước theo đơn vị trong'
    : isMaintenanceProcedure(selectedProcedure.value)
      ? 'Ước tính doanh thu duy trì Fiber và MyTV theo đơn vị, lũy kế đến'
    : isSnapshotTrend.value
      ? `Kế hoạch và doanh thu ${selectedProcedureLabel.value} theo từng tháng đến`
    : `Doanh thu và số thuê bao ${selectedProcedureLabel.value} từ đầu năm đến`)
const pscTotal = computed(() => pscRows.value.find(row => row.unitCode === 'TONG'))
const pscUnitRows = computed(() => pscRows.value.filter(row => row.unitCode !== 'TONG'))
type PscValueKey = 'monthlyNew' | 'monthlyPsc' | 'cumulativeNew' | 'cumulativePsc' | 'cumulativeNetGrowth' | 'cumulativeStopped'
const pscRateSort = ref<SortDirection>('desc')
const pscMonthlySort = ref<SortDirection>('desc')
const pscCumulativeSort = ref<SortDirection>('desc')
function sortedPscRows(metric: PscValueKey | 'cumulativeStopRate', direction: SortDirection) {
  const factor = direction === 'asc' ? 1 : -1
  return pscUnitRows.value
    .filter(row => row[metric] != null)
    .sort((a, b) => factor * ((a[metric] ?? 0) - (b[metric] ?? 0)) || a.unitName.localeCompare(b.unitName, 'vi'))
}
const pscChartRows = computed(() => sortedPscRows('cumulativeStopRate', pscRateSort.value))
const pscMonthlyMetrics: { title: string; value: PscValueKey }[] = [
  { title: 'Phát triển mới', value: 'monthlyNew' },
  { title: 'Phát sinh cước', value: 'monthlyPsc' },
]
const pscCumulativeMetrics: { title: string; value: PscValueKey }[] = [
  { title: 'PTM lũy kế', value: 'cumulativeNew' },
  { title: 'PSC lũy kế', value: 'cumulativePsc' },
  { title: 'Thực tăng', value: 'cumulativeNetGrowth' },
  { title: 'Ngừng PSC', value: 'cumulativeStopped' },
]
const pscMonthlyMetric = ref<PscValueKey>('monthlyNew')
const pscCumulativeMetric = ref<PscValueKey>('cumulativePsc')
const pscMonthlyMetricLabel = computed(() => pscMonthlyMetrics.find(metric => metric.value === pscMonthlyMetric.value)?.title ?? '')
const pscCumulativeMetricLabel = computed(() => pscCumulativeMetrics.find(metric => metric.value === pscCumulativeMetric.value)?.title ?? '')
const pscMonthlyChartRows = computed(() => sortedPscRows(pscMonthlyMetric.value, pscMonthlySort.value))
const pscCumulativeChartRows = computed(() => sortedPscRows(pscCumulativeMetric.value, pscCumulativeSort.value))
const maintenanceRevenueSort = ref<SortDirection>('desc')
const maintenanceRateSort = ref<SortDirection>('asc')
const maintenanceSubscriberSort = ref<SortDirection>('desc')
const maintenanceRevenueView = ref<'monthlyBase' | 'cumulativeBase' | 'stoppedRevenue' | 'canceledRevenue' | 'maintained'>('canceledRevenue')
const maintenanceOtherView = ref<'subscribers' | 'stoppedSubscribers' | 'arpu'>('stoppedSubscribers')
const selectedMaintenanceUnit = ref<string | null>(null)
const selectedMaintenanceRow = computed(() => maintenanceRows.value.find(row => row.unitCode === selectedMaintenanceUnit.value) ?? null)
type MaintenanceMetric = keyof Pick<KpiMaintenanceRow,
  'baseRevenueFiber' | 'baseRevenueMyTv' | 'baseRevenue' |
  'cumulativeBaseRevenueFiber' | 'cumulativeBaseRevenueMyTv' | 'cumulativeBaseRevenue' |
  'stoppedFiberRevenue' | 'stoppedMyTvRevenue' | 'stoppedRevenue' |
  'estimatedCanceledFiberRevenue' | 'estimatedCanceledMyTvRevenue' | 'estimatedCanceledRevenue' |
  'maintainedRevenue' | 'fiberSubscribers' | 'mytvSubscribers' | 'subscribers' |
  'stoppedFiberSubscribers' | 'stoppedMyTvSubscribers' | 'stoppedSubscribers' | 'arpuFiber' | 'arpuMyTv'>
type MaintenanceChartMetric = { title: string; key: MaintenanceMetric; color: string }
const maintenanceRevenueMetricSets: Record<typeof maintenanceRevenueView.value, MaintenanceChartMetric[]> = {
  monthlyBase: [
    { title: 'Fiber', key: 'baseRevenueFiber', color: '#0c8b8d' },
    { title: 'MyTV', key: 'baseRevenueMyTv', color: '#3678c4' },
  ],
  cumulativeBase: [
    { title: 'Fiber', key: 'cumulativeBaseRevenueFiber', color: '#0c8b8d' },
    { title: 'MyTV', key: 'cumulativeBaseRevenueMyTv', color: '#3678c4' },
  ],
  stoppedRevenue: [
    { title: 'Fiber', key: 'stoppedFiberRevenue', color: '#0c8b8d' },
    { title: 'MyTV', key: 'stoppedMyTvRevenue', color: '#3678c4' },
  ],
  canceledRevenue: [
    { title: 'Fiber', key: 'estimatedCanceledFiberRevenue', color: '#0c8b8d' },
    { title: 'MyTV', key: 'estimatedCanceledMyTvRevenue', color: '#3678c4' },
  ],
  maintained: [{ title: 'Doanh thu duy trì ước tính', key: 'maintainedRevenue', color: '#0c8b8d' }],
}
const maintenanceOtherMetricSets: Record<typeof maintenanceOtherView.value, MaintenanceChartMetric[]> = {
  subscribers: [
    { title: 'Fiber', key: 'fiberSubscribers', color: '#0c8b8d' },
    { title: 'MyTV', key: 'mytvSubscribers', color: '#3678c4' },
  ],
  stoppedSubscribers: [
    { title: 'Fiber', key: 'stoppedFiberSubscribers', color: '#0c8b8d' },
    { title: 'MyTV', key: 'stoppedMyTvSubscribers', color: '#3678c4' },
  ],
  arpu: [
    { title: 'ARPU Fiber', key: 'arpuFiber', color: '#0c8b8d' },
    { title: 'ARPU MyTV', key: 'arpuMyTv', color: '#3678c4' },
  ],
}
const maintenanceRevenueViewOptions = [
  { title: 'Doanh thu hủy ước tính', value: 'canceledRevenue' },
  { title: 'Doanh thu duy trì ước tính', value: 'maintained' },
  { title: 'Doanh thu tháng gốc', value: 'monthlyBase' },
  { title: 'Doanh thu gốc tính theo số tháng', value: 'cumulativeBase' },
  { title: 'Doanh thu trước khi ngừng PSC', value: 'stoppedRevenue' },
] as const
const maintenanceOtherViewOptions = [
  { title: 'Thuê bao ngừng PSC', value: 'stoppedSubscribers' },
  { title: 'Thuê bao tháng gốc', value: 'subscribers' },
  { title: 'Doanh thu bình quân / thuê bao', value: 'arpu' },
] as const
function sortMaintenanceRows(metric: MaintenanceMetric | 'maintainedRate', direction: SortDirection) {
  const factor = direction === 'asc' ? 1 : -1
  return [...maintenanceRows.value].sort((a, b) => {
    if (a[metric] == null && b[metric] == null) return a.unitName.localeCompare(b.unitName, 'vi')
    if (a[metric] == null) return 1
    if (b[metric] == null) return -1
    return factor * (a[metric]! - b[metric]!) || a.unitName.localeCompare(b.unitName, 'vi')
  })
}
const maintenanceRateRows = computed(() => sortMaintenanceRows('maintainedRate', maintenanceRateSort.value))
function sumMaintenanceMetric(chartRows: KpiMaintenanceRow[], key: MaintenanceMetric): number | null {
  if (!chartRows.length || chartRows.some(row => row[key] == null)) return null
  return chartRows.reduce((sum, row) => sum + row[key]!, 0)
}
const maintenanceScopeRows = computed(() => selectedMaintenanceRow.value ? [selectedMaintenanceRow.value] : maintenanceRows.value)
const maintenanceTotals = computed(() => ({
  base: sumMaintenanceMetric(maintenanceScopeRows.value, 'cumulativeBaseRevenue'),
  maintained: sumMaintenanceMetric(maintenanceScopeRows.value, 'maintainedRevenue'),
  canceled: sumMaintenanceMetric(maintenanceScopeRows.value, 'estimatedCanceledRevenue'),
  stoppedSubscribers: sumMaintenanceMetric(maintenanceScopeRows.value, 'stoppedSubscribers'),
  canceledFiber: sumMaintenanceMetric(maintenanceScopeRows.value, 'estimatedCanceledFiberRevenue'),
  canceledMyTv: sumMaintenanceMetric(maintenanceScopeRows.value, 'estimatedCanceledMyTvRevenue'),
  stoppedFiber: sumMaintenanceMetric(maintenanceScopeRows.value, 'stoppedFiberSubscribers'),
  stoppedMyTv: sumMaintenanceMetric(maintenanceScopeRows.value, 'stoppedMyTvSubscribers'),
}))
const maintenanceNetworkRate = computed(() => {
  const base = sumMaintenanceMetric(maintenanceRows.value, 'cumulativeBaseRevenue')
  const maintained = sumMaintenanceMetric(maintenanceRows.value, 'maintainedRevenue')
  return base != null && base > 0 && maintained != null ? maintained / base * 100 : null
})
const maintenanceSelectedName = computed(() => selectedMaintenanceRow.value?.unitName || 'Toàn bộ đơn vị')
const maintenanceRevenueTotalKeys: Record<typeof maintenanceRevenueView.value, MaintenanceMetric> = {
  monthlyBase: 'baseRevenue', cumulativeBase: 'cumulativeBaseRevenue', stoppedRevenue: 'stoppedRevenue',
  canceledRevenue: 'estimatedCanceledRevenue', maintained: 'maintainedRevenue',
}
const maintenanceOtherTotalKey = computed<MaintenanceMetric | null>(() => maintenanceOtherView.value === 'subscribers' ? 'subscribers' : maintenanceOtherView.value === 'stoppedSubscribers' ? 'stoppedSubscribers' : null)
const maintenanceRevenueChartRows = computed(() => sortMaintenanceRows(maintenanceRevenueTotalKeys[maintenanceRevenueView.value], maintenanceRevenueSort.value))
const maintenanceOtherChartRows = computed(() => sortMaintenanceRows(maintenanceOtherTotalKey.value ?? 'arpuFiber', maintenanceSubscriberSort.value))
const maintenanceLowestUnit = computed(() => sortMaintenanceRows('maintainedRate', 'asc').find(row => row.maintainedRate != null))
const maintenanceLargestLossUnit = computed(() => sortMaintenanceRows('estimatedCanceledRevenue', 'desc').find(row => row.estimatedCanceledRevenue != null))
const maintenanceBelowNetwork = computed(() => maintenanceNetworkRate.value == null ? 0 : maintenanceRows.value.filter(row => row.maintainedRate != null && row.maintainedRate < maintenanceNetworkRate.value!).length)
const maintenanceBaseMonth = computed(() => `12/${year.value - 1}`)
const maintenanceRevenueCaption = computed(() => {
  if (maintenanceRevenueView.value === 'monthlyBase') return `Doanh thu tháng gốc ${maintenanceBaseMonth.value}; không phải doanh thu tháng báo cáo`
  if (maintenanceRevenueView.value === 'cumulativeBase') return `Doanh thu tháng gốc × ${monthNumber.value} tháng báo cáo`
  if (maintenanceRevenueView.value === 'stoppedRevenue') return 'Tổng doanh thu kỳ cước trước khi thuê bao ngừng PSC; khác doanh thu hủy ước tính'
  if (maintenanceRevenueView.value === 'maintained') return `Doanh thu tháng gốc tính cho ${monthNumber.value} tháng trừ doanh thu hủy ước tính`
  return 'Tách Fiber / MyTV để nhận diện phần doanh thu hủy ước tính lớn nhất'
})
const maintenanceUnitChartTitle = computed(() => maintenanceRevenueViewOptions.find(option => option.value === maintenanceRevenueView.value)?.title ?? '')
const maintenanceOtherChartTitle = computed(() => maintenanceOtherViewOptions.find(option => option.value === maintenanceOtherView.value)?.title ?? '')
function maintenanceMetricOption(chartRows: KpiMaintenanceRow[], metrics: MaintenanceChartMetric[], unit: 'money' | 'count' | 'arpu', totalKey: MaintenanceMetric | null) {
  const valueFormat = (value: number | null) => value == null ? '—' : unit === 'money' ? formatRevenue(value) : `${numberFormat.format(value)} ${unit === 'arpu' ? 'đồng/thuê bao' : 'thuê bao'}`
  return {
    tooltip: { trigger: 'axis', renderMode: 'richText', confine: true, axisPointer: { type: 'shadow' }, formatter: (items: Array<{ dataIndex: number }>) => {
      const row = chartRows[items[0]?.dataIndex ?? -1]
      if (!row) return ''
      const lines = [row.unitName, ...metrics.map(metric => `${metric.title}: ${valueFormat(row[metric.key])}`)]
      if (totalKey && metrics.length > 1) lines.push(`Tổng: ${valueFormat(row[totalKey])}`)
      if (unit === 'money') lines.push(`Tỷ lệ duy trì: ${row.maintainedRate == null ? '—' : `${numberFormat.format(row.maintainedRate)}%`}`)
      return lines.join('\n')
    } },
    legend: { top: 0, textStyle: { color: '#526a7b' } },
    grid: { left: 105, right: 30, top: 42, bottom: 38 },
    xAxis: { type: 'value', min: (range: { min: number }) => Math.min(0, range.min * 1.1), axisLabel: { color: '#526a7b', formatter: (value: number) => unit === 'money' ? compactNumberFormat.format(value) : numberFormat.format(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
    yAxis: { type: 'category', inverse: true, data: chartRows.map(row => row.unitName || row.unitCode), axisLabel: { color: '#526a7b', width: 90, overflow: 'truncate' }, axisTick: { show: false } },
    series: metrics.map(metric => ({
      name: metric.title,
      type: 'bar',
      stack: unit === 'arpu' ? undefined : 'services',
      barMaxWidth: unit === 'arpu' ? 13 : 23,
      data: chartRows.map(row => ({
        value: row[metric.key],
        itemStyle: { color: metric.color, opacity: selectedMaintenanceUnit.value && selectedMaintenanceUnit.value !== row.unitCode ? 0.45 : 1 },
        emphasis: { itemStyle: { opacity: 1 } },
      })),
      itemStyle: { color: metric.color, borderRadius: [0, 4, 4, 0] },
    })),
  }
}
const maintenanceRevenueOption = computed(() => maintenanceMetricOption(maintenanceRevenueChartRows.value, maintenanceRevenueMetricSets[maintenanceRevenueView.value], 'money', maintenanceRevenueTotalKeys[maintenanceRevenueView.value]))
const maintenanceOtherOption = computed(() => maintenanceMetricOption(maintenanceOtherChartRows.value, maintenanceOtherMetricSets[maintenanceOtherView.value], maintenanceOtherView.value === 'arpu' ? 'arpu' : 'count', maintenanceOtherTotalKey.value))
function selectMaintenanceUnit(event: { dataIndex?: number }, chartRows: KpiMaintenanceRow[]) {
  const row = event.dataIndex == null ? null : chartRows[event.dataIndex]
  if (row) selectedMaintenanceUnit.value = selectedMaintenanceUnit.value === row.unitCode ? null : row.unitCode
}
function clearMaintenanceUnit() { selectedMaintenanceUnit.value = null }
const maintenanceRateTotal = computed(() => selectedMaintenanceRow.value ? selectedMaintenanceRow.value.maintainedRate : maintenanceNetworkRate.value)
const maintenanceLossShare = computed(() => maintenanceTotals.value.base != null && maintenanceTotals.value.base > 0 && maintenanceTotals.value.canceled != null ? maintenanceTotals.value.canceled / maintenanceTotals.value.base * 100 : null)
function maintenanceMoney(value: number | null) { return value == null ? '—' : formatRevenue(value) }
function maintenanceCount(value: number | null) { return value == null ? '—' : numberFormat.format(value) }
const maintenanceTableView = ref<'overview' | 'revenue' | 'subscribers'>('overview')
const maintenanceTableColumns: Record<typeof maintenanceTableView.value, Array<[string, MaintenanceMetric | 'maintainedRate']>> = {
  overview: [
    ['Tỷ lệ duy trì', 'maintainedRate'], ['DT hủy ước tính', 'estimatedCanceledRevenue'],
    ['DT duy trì ước tính', 'maintainedRevenue'], ['DT gốc tính theo số tháng', 'cumulativeBaseRevenue'], ['Thuê bao ngừng PSC', 'stoppedSubscribers'],
  ],
  revenue: [
    ['DT gốc Fiber', 'baseRevenueFiber'], ['DT gốc MyTV', 'baseRevenueMyTv'], ['Tổng DT gốc', 'baseRevenue'],
    ['DT gốc LK Fiber', 'cumulativeBaseRevenueFiber'], ['DT gốc LK MyTV', 'cumulativeBaseRevenueMyTv'], ['Tổng DT gốc LK', 'cumulativeBaseRevenue'],
    ['DT trước ngừng Fiber', 'stoppedFiberRevenue'], ['DT trước ngừng MyTV', 'stoppedMyTvRevenue'], ['Tổng DT trước ngừng', 'stoppedRevenue'],
    ['DT hủy ước tính Fiber', 'estimatedCanceledFiberRevenue'], ['DT hủy ước tính MyTV', 'estimatedCanceledMyTvRevenue'], ['Tổng DT hủy ước tính', 'estimatedCanceledRevenue'],
    ['DT duy trì ước tính', 'maintainedRevenue'], ['Tỷ lệ duy trì', 'maintainedRate'],
  ],
  subscribers: [
    ['Thuê bao gốc Fiber', 'fiberSubscribers'], ['Thuê bao gốc MyTV', 'mytvSubscribers'], ['Tổng thuê bao gốc', 'subscribers'],
    ['Ngừng PSC Fiber', 'stoppedFiberSubscribers'], ['Ngừng PSC MyTV', 'stoppedMyTvSubscribers'], ['Tổng ngừng PSC', 'stoppedSubscribers'],
    ['ARPU Fiber (đồng/TB)', 'arpuFiber'], ['ARPU MyTV (đồng/TB)', 'arpuMyTv'],
  ],
}
const maintenanceTableHeaders = computed(() => [
  { title: 'Đơn vị', key: 'unitName', fixed: 'start' as const, width: 190 },
  ...maintenanceTableColumns[maintenanceTableView.value].map(([title, key]) => ({ title, key, align: 'end' as const })),
])
const maintenanceTableNumberKeys = computed(() => maintenanceTableColumns[maintenanceTableView.value].map(([, key]) => key).filter(key => key !== 'maintainedRate'))
const maintenanceTableRows = computed(() => sortMaintenanceRows('estimatedCanceledRevenue', 'desc'))
const trendHasData = computed(() => trendRows.value.some(row => row.revenue != null || row.subscribers != null))
const trendHasRevenue = computed(() => trendRows.value.some(row => row.revenue != null))
const trendHasSubscribers = computed(() => trendRows.value.some(row => row.subscribers != null))
const revenueChartRows = computed(() => revenueSort.value === 'asc' ? trendRows.value : [...trendRows.value].reverse())
const subscriberChartRows = computed(() => subscriberSort.value === 'asc' ? trendRows.value : [...trendRows.value].reverse())
const snapshotMonthlyRows = computed(() => revenueSort.value === 'asc' ? trendRows.value : [...trendRows.value].reverse())
const snapshotCumulativeRows = computed(() => subscriberSort.value === 'asc' ? trendRows.value : [...trendRows.value].reverse())
const currentTrend = computed(() => trendRows.value[trendRows.value.length - 1])
const snapshotSummaryTrend = computed(() => trendRows.value.find(row => row.month === selectedSnapshotMonth.value) ?? currentTrend.value)
function selectSnapshotMonth(event: { dataIndex?: number }, chartRows: KpiTrendRow[]) {
  const row = event.dataIndex == null ? null : chartRows[event.dataIndex]
  if (row) selectedSnapshotMonth.value = row.month
}
const snapshotViewingLabel = computed(() => {
  const period = snapshotSummaryTrend.value?.month
  return period ? `tháng ${Number(period.slice(5))}/${period.slice(0, 4)}` : monthLabel.value
})
const snapshotRevenueChange = computed(() => {
  const index = trendRows.value.findIndex(row => row.month === snapshotSummaryTrend.value?.month)
  const row = trendRows.value[index]
  const previous = trendRows.value[index - 1]
  if (!row || !previous || row.month.slice(0, 4) !== previous.month.slice(0, 4) || Number(row.month.slice(5)) - Number(previous.month.slice(5)) !== 1) return null
  return trendChangeAt(index, 'revenue')
})
function snapshotGap(actual: number | null | undefined, plan: number | null | undefined) {
  if (actual == null || plan == null) return 'Chưa có đủ dữ liệu đối chiếu kế hoạch'
  const gap = actual - plan
  if (Math.abs(gap) < 1) return 'Đạt kế hoạch'
  return `${gap < 0 ? 'Còn thiếu' : 'Vượt kế hoạch'} ${formatRevenue(Math.abs(gap))}`
}
const snapshotPlanDiscrepancies = computed(() => {
  let sum = 0
  const periods: string[] = []
  for (const [index, row] of trendRows.value.entries()) {
    // Only compare a complete sequence from January; source plans remain unchanged.
    if (Number(row.month.slice(5)) !== index + 1 || row.plan == null) return []
    sum += row.plan
    if (row.cumulativePlan != null && Math.abs(sum - row.cumulativePlan) > 1) periods.push(`T${Number(row.month.slice(5))}`)
  }
  return periods
})
const snapshotAnnualScale = computed(() => {
  const row = snapshotSummaryTrend.value
  if (row?.cumulativeRevenue == null || row.annualPlan == null || row.annualPlan <= 0 || row.cumulativeRevenue < 0) return null
  const max = Math.max(row.cumulativeRevenue, row.annualPlan)
  return { actual: row.cumulativeRevenue / max * 100, target: row.annualPlan / max * 100 }
})
const snapshotTableHeaders = [
  { title: 'Tháng', key: 'month', fixed: 'start' as const, width: 150, sortable: false },
  { title: 'Trong tháng', align: 'center' as const, children: [
    { title: 'Kế hoạch', key: 'plan', align: 'end' as const, sortable: false },
    { title: 'Doanh thu', key: 'revenue', align: 'end' as const, sortable: false },
    { title: 'Hoàn thành', key: 'completionRate', align: 'end' as const, sortable: false },
  ] },
  { title: 'Lũy kế đến tháng', align: 'center' as const, children: [
    { title: 'Kế hoạch', key: 'cumulativePlan', align: 'end' as const, sortable: false },
    { title: 'Doanh thu', key: 'cumulativeRevenue', align: 'end' as const, sortable: false },
    { title: 'Hoàn thành', key: 'cumulativeRate', align: 'end' as const, sortable: false },
  ] },
  { title: 'Kế hoạch năm', align: 'center' as const, children: [
    { title: 'Mục tiêu', key: 'annualPlan', align: 'end' as const, sortable: false },
    { title: 'Hoàn thành', key: 'annualRate', align: 'end' as const, sortable: false },
  ] },
]
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
function trendTooltip(index: number, metric: TrendMetric, chartRows: KpiTrendRow[]) {
  const row = chartRows[index]
  if (!row) return ''
  const chronologicalIndex = trendRows.value.findIndex(item => item.month === row.month)
  const value = row[metric]
  const label = metric === 'revenue' ? 'Doanh thu' : 'Số thuê bao'
  const formatted = value == null ? '—' : metric === 'revenue' ? formatRevenue(value) : numberFormat.format(value)
  return `<strong>Tháng ${Number(row.month.slice(5))}/${row.month.slice(0, 4)}</strong><br/>${label}: ${formatted}<br/>So với tháng trước: ${signedChange(trendChangeAt(chronologicalIndex, metric), metric)}`
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
  yAxis: { type: 'category', inverse: true, data: monthlyChartRows.value.map(row => row.name), axisLabel: { color: '#526a7b', width: 180, overflow: 'truncate' }, axisTick: { show: false } },
  series: [
    { name: 'Kế hoạch tháng', type: 'bar', barMaxWidth: 17, data: monthlyChartRows.value.map(row => row.monthlyPlan), itemStyle: { color: '#6091bd', borderRadius: [0, 4, 4, 0] } },
    { name: 'Thực hiện tháng', type: 'bar', barMaxWidth: 17, data: monthlyChartRows.value.map(row => row.monthlyActual), itemStyle: { color: '#e07b34', borderRadius: [0, 4, 4, 0] } },
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
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (items: Array<{ dataIndex: number }>) => trendTooltip(items[0]?.dataIndex ?? -1, 'revenue', revenueChartRows.value) },
  grid: { left: 82, right: 24, top: 28, bottom: 42 },
  xAxis: { type: 'category', data: revenueChartRows.value.map(row => `T${Number(row.month.slice(5))}`), axisLabel: { color: '#526a7b' } },
  yAxis: { type: 'value', min: 0, axisLabel: { color: '#526a7b', formatter: (value: number) => formatRevenue(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  series: [{ name: 'Doanh thu', type: 'bar', barMaxWidth: 42, data: revenueChartRows.value.map(row => row.revenue), itemStyle: { color: '#0c8b8d', borderRadius: [5, 5, 0, 0] }, emphasis: { itemStyle: { color: '#11a3a5', shadowBlur: 10, shadowColor: 'rgba(12,139,141,.22)' } } }],
}))
const trendSubscribersOption = computed(() => ({
  tooltip: { trigger: 'axis', formatter: (items: Array<{ dataIndex: number }>) => trendTooltip(items[0]?.dataIndex ?? -1, 'subscribers', subscriberChartRows.value) },
  grid: { left: 72, right: 24, top: 28, bottom: 42 },
  xAxis: { type: 'category', data: subscriberChartRows.value.map(row => `T${Number(row.month.slice(5))}`), axisLabel: { color: '#526a7b' } },
  yAxis: { type: 'value', min: subscriberRange.value.min, max: subscriberRange.value.max, axisLabel: { color: '#526a7b', formatter: (value: number) => numberFormat.format(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  series: [{ name: 'Số thuê bao', type: 'line', data: subscriberChartRows.value.map(row => row.subscribers), smooth: 0.25, symbol: 'circle', symbolSize: 8, lineStyle: { width: 3, color: '#3678c4' }, itemStyle: { color: '#3678c4', borderColor: '#fff', borderWidth: 2 }, emphasis: { scale: 1.3 } }],
}))
function snapshotTooltip(row: KpiTrendRow | undefined, cumulative = false) {
  if (!row) return ''
  const actual = cumulative ? row.cumulativeRevenue : row.revenue
  const plan = cumulative ? row.cumulativePlan : row.plan
  const rate = cumulative ? row.cumulativeRate : row.completionRate
  const period = `Tháng ${Number(row.month.slice(5))}/${row.month.slice(0, 4)}`
  const lines = [period, `Doanh thu${cumulative ? ' lũy kế' : ''}: ${actual == null ? '—' : formatRevenue(actual)}`, `Kế hoạch: ${plan == null ? '—' : formatRevenue(plan)}`, `Hoàn thành: ${rate == null ? '—' : `${numberFormat.format(rate)}%`}`, snapshotGap(actual, plan)]
  if (!cumulative) {
    const index = trendRows.value.findIndex(item => item.month === row.month)
    const previous = trendRows.value[index - 1]
    if (previous && Number(row.month.slice(5)) - Number(previous.month.slice(5)) === 1) lines.push(`So tháng trước: ${signedChange(trendChangeAt(index, 'revenue'), 'revenue')}`)
  } else if (snapshotPlanDiscrepancies.value.includes(`T${Number(row.month.slice(5))}`)) {
    lines.push('Lưu ý: kế hoạch lũy kế nguồn khác tổng kế hoạch các tháng.')
  }
  return lines.join('\n')
}
const snapshotMonthlyOption = computed(() => {
  const isRate = snapshotMonthlyView.value === 'rate'
  const point = (row: KpiTrendRow, value: number | null | undefined) => ({ value, itemStyle: { opacity: selectedSnapshotMonth.value && selectedSnapshotMonth.value !== row.month ? 0.4 : 1 } })
  return {
  tooltip: { trigger: 'axis', renderMode: 'richText', confine: true, axisPointer: { type: 'shadow' }, formatter: (items: Array<{ dataIndex: number }>) => snapshotTooltip(snapshotMonthlyRows.value[items[0]?.dataIndex ?? -1]) },
  legend: { top: 4, textStyle: { color: '#526a7b' } },
  grid: { left: 82, right: 24, top: 48, bottom: 42 },
  xAxis: { type: 'category', data: snapshotMonthlyRows.value.map(row => `T${Number(row.month.slice(5))}`), axisLabel: { color: '#526a7b' } },
  yAxis: { type: 'value', min: 0, ...(isRate ? { max: (range: { max: number }) => Math.max(110, Math.ceil(range.max / 10) * 10) } : {}), axisLabel: { color: '#526a7b', formatter: (value: number) => isRate ? `${numberFormat.format(value)}%` : formatRevenue(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  series: isRate ? [
    { name: 'Hoàn thành tháng', type: 'bar', barMaxWidth: 32, data: snapshotMonthlyRows.value.map(row => point(row, row.completionRate)), itemStyle: { color: '#0c8b8d', borderRadius: [5, 5, 0, 0] }, markLine: { silent: true, symbol: 'none', lineStyle: { color: '#e58a3a', type: 'dashed' }, label: { formatter: '100%' }, data: [{ yAxis: 100 }] } },
  ] : [
    { name: 'Kế hoạch tháng', type: 'bar', barMaxWidth: 24, data: snapshotMonthlyRows.value.map(row => point(row, row.plan)), itemStyle: { color: '#7997b4', borderRadius: [5, 5, 0, 0] } },
    { name: 'Doanh thu tháng', type: 'bar', barMaxWidth: 24, data: snapshotMonthlyRows.value.map(row => point(row, row.revenue)), itemStyle: { color: '#0c8b8d', borderRadius: [5, 5, 0, 0] } },
  ],
}})
const snapshotCumulativeOption = computed(() => ({
  tooltip: { trigger: 'axis', renderMode: 'richText', confine: true, formatter: (items: Array<{ dataIndex: number }>) => snapshotTooltip(snapshotCumulativeRows.value[items[0]?.dataIndex ?? -1], true) },
  legend: { top: 4, textStyle: { color: '#526a7b' } },
  grid: { left: 82, right: 24, top: 48, bottom: 42 },
  xAxis: { type: 'category', data: snapshotCumulativeRows.value.map(row => `T${Number(row.month.slice(5))}`), axisLabel: { color: '#526a7b' } },
  yAxis: { type: 'value', min: 0, axisLabel: { color: '#526a7b', formatter: (value: number) => formatRevenue(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  series: [
    { name: 'Kế hoạch lũy kế', type: 'line', data: snapshotCumulativeRows.value.map(row => ({ value: row.cumulativePlan, symbolSize: row.month === snapshotSummaryTrend.value?.month ? 11 : 7 })), smooth: false, symbol: 'circle', symbolSize: 7, lineStyle: { width: 2, type: 'dashed', color: '#7997b4' }, itemStyle: { color: '#7997b4' } },
    { name: 'Doanh thu lũy kế', type: 'line', data: snapshotCumulativeRows.value.map(row => ({ value: row.cumulativeRevenue, symbolSize: row.month === snapshotSummaryTrend.value?.month ? 11 : 7 })), smooth: false, symbol: 'circle', symbolSize: 7, lineStyle: { width: 3, color: '#0c8b8d' }, itemStyle: { color: '#0c8b8d' } },
  ],
}))
const maintenanceRateOption = computed(() => ({
  tooltip: { trigger: 'axis', renderMode: 'richText', confine: true, axisPointer: { type: 'shadow' }, formatter: (items: Array<{ dataIndex: number }>) => {
    const row = maintenanceRateRows.value[items[0]?.dataIndex ?? -1]
    return row ? `${row.unitName}\nTỷ lệ duy trì: ${row.maintainedRate == null ? '—' : `${numberFormat.format(row.maintainedRate)}%`}\nDoanh thu duy trì ước tính: ${maintenanceMoney(row.maintainedRevenue)}\nDoanh thu hủy ước tính: ${maintenanceMoney(row.estimatedCanceledRevenue)}` : ''
  } },
  grid: { left: 105, right: 62, top: 42, bottom: 38 },
  xAxis: { type: 'value', min: (range: { min: number }) => Math.min(0, range.min), max: (range: { max: number }) => Math.max(100, Math.ceil(range.max / 10) * 10), axisLabel: { color: '#526a7b', formatter: (value: number) => `${numberFormat.format(value)}%` }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  yAxis: { type: 'category', inverse: true, data: maintenanceRateRows.value.map(row => row.unitName || row.unitCode), axisLabel: { color: '#526a7b', width: 90, overflow: 'truncate' }, axisTick: { show: false } },
  series: [{ type: 'bar', barMaxWidth: 23, data: maintenanceRateRows.value.map(row => ({ value: row.maintainedRate, itemStyle: { color: row.maintainedRate != null && maintenanceNetworkRate.value != null && row.maintainedRate < maintenanceNetworkRate.value ? '#cf873b' : '#0c8b8d', opacity: selectedMaintenanceUnit.value && selectedMaintenanceUnit.value !== row.unitCode ? 0.45 : 1 } })), itemStyle: { borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: '#244252', formatter: ({ value }: { value: number | null }) => value == null ? '' : `${numberFormat.format(value)}%` }, markLine: maintenanceNetworkRate.value == null ? undefined : { silent: true, symbol: 'none', data: [{ xAxis: maintenanceNetworkRate.value }], lineStyle: { color: '#526a7b', type: 'dashed' }, label: { show: false } } }],
}))

const pscRateOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    renderMode: 'richText',
    formatter: ({ dataIndex }: { dataIndex: number }) => {
      const row = pscChartRows.value[dataIndex]
      return row ? `${row.unitName || row.unitCode}\nTỷ lệ ngừng PSC lũy kế: ${numberFormat.format(row.cumulativeStopRate ?? 0)}%\nNgừng PSC lũy kế: ${row.cumulativeStopped == null ? '—' : numberFormat.format(row.cumulativeStopped)}\nPSC lũy kế: ${row.cumulativePsc == null ? '—' : numberFormat.format(row.cumulativePsc)}` : ''
    },
  },
  grid: { left: 230, right: 65, top: 28, bottom: 40 },
  xAxis: { type: 'value', min: (range: { min: number }) => Math.min(0, Math.floor(range.min * 10) / 10), max: (range: { max: number }) => Math.max(0.1, Math.ceil(range.max * 11.5) / 10), axisLabel: { color: '#526a7b', formatter: (value: number) => `${numberFormat.format(value)}%` }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  yAxis: { type: 'category', inverse: true, data: pscChartRows.value.map(row => row.unitName || row.unitCode), axisLabel: { color: '#526a7b', width: 210, overflow: 'truncate' }, axisTick: { show: false } },
  series: [{ type: 'bar', barMaxWidth: 24, data: pscChartRows.value.map(row => row.cumulativeStopRate), itemStyle: { color: '#0c8b8d', borderRadius: [0, 5, 5, 0] }, emphasis: { itemStyle: { color: '#11a3a5' } }, label: { show: true, position: 'right', color: '#244252', formatter: ({ value }: { value: number }) => `${numberFormat.format(value)}%` } }],
}))

function pscCountOption(metric: PscValueKey, chartRows: KpiPscRow[], color: string) {
  const label = [...pscMonthlyMetrics, ...pscCumulativeMetrics].find(item => item.value === metric)?.title ?? ''
  return {
    tooltip: {
      trigger: 'item',
      renderMode: 'richText',
      formatter: ({ dataIndex }: { dataIndex: number }) => {
        const row = chartRows[dataIndex]
        return row ? `${row.unitName || row.unitCode}\n${label}: ${numberFormat.format(row[metric] ?? 0)}` : ''
      },
    },
    grid: { left: 120, right: 75, top: 28, bottom: 40 },
    xAxis: {
      type: 'value',
      min: (range: { min: number }) => Math.min(0, Math.floor(range.min * 1.15)),
      max: (range: { max: number }) => Math.max(1, Math.ceil(range.max * 1.15)),
      axisLabel: { color: '#526a7b', formatter: (value: number) => compactNumberFormat.format(value) },
      splitLine: { lineStyle: { color: '#e8eef3' } },
    },
    yAxis: { type: 'category', inverse: true, data: chartRows.map(row => row.unitName || row.unitCode), axisLabel: { color: '#526a7b', width: 105, overflow: 'truncate' }, axisTick: { show: false } },
    series: [{ type: 'bar', barMaxWidth: 24, data: chartRows.map(row => ({ value: row[metric], itemStyle: { color: (row[metric] ?? 0) < 0 ? '#d97745' : color, borderRadius: (row[metric] ?? 0) < 0 ? [5, 0, 0, 5] : [0, 5, 5, 0] }, label: { position: (row[metric] ?? 0) < 0 ? 'left' : 'right' } })), label: { show: true, color: '#244252', formatter: ({ value }: { value: number }) => numberFormat.format(value) } }],
  }
}
const pscMonthlyOption = computed(() => pscCountOption(pscMonthlyMetric.value, pscMonthlyChartRows.value, '#0c8b8d'))
const pscCumulativeOption = computed(() => pscCountOption(pscCumulativeMetric.value, pscCumulativeChartRows.value, '#437ac6'))

let loadVersion = 0
async function load() {
  if (!month.value) return
  const version = ++loadVersion
  const procedure = selectedProcedure.value
  const queryMonth = month.value
  loading.value = true
  loaded.value = false
  selectedSnapshotMonth.value = null
  selectedMaintenanceUnit.value = null
  rows.value = []
  trendRows.value = []
  pscRows.value = []
  maintenanceRows.value = []
  error.value = ''
  try {
    if (procedure === 'TONG_HOP_KPI') {
      const result = await kpiApi.summary(queryMonth)
      if (version !== loadVersion) return
      rows.value = result.rows
      trendRows.value = []
      selectedKpiNames.value = selectedKpiNames.value.filter(name => result.rows.some(row => row.name === name))
    } else if (isPscProcedure(procedure)) {
      const result = await kpiApi.psc(queryMonth, procedure)
      if (version !== loadVersion) return
      pscRows.value = result.rows
    } else if (isMaintenanceProcedure(procedure)) {
      const result = await kpiApi.maintenance(queryMonth)
      if (version !== loadVersion) return
      maintenanceRows.value = result.rows
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
    pscRows.value = []
    maintenanceRows.value = []
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
let selectionVersion = 0
watch([selectedProcedure, monthNumber, year], async ([procedure], [previousProcedure]) => {
  if (!initialized.value) return
  const version = ++selectionVersion
  if (procedure !== previousProcedure && isSnapshotProcedure(procedure)) {
    try {
      const latest = await kpiApi.latestMonth(procedure)
      if (version !== selectionVersion || selectedProcedure.value !== procedure) return
      if (latest) {
        const [latestYear, latestMonth] = latest.split('-').map(Number)
        if (latestYear && latestMonth && (year.value !== latestYear || monthNumber.value !== latestMonth)) {
          year.value = latestYear
          monthNumber.value = latestMonth
          return
        }
      }
    } catch {
      // Continue with the currently selected month if the snapshot lookup is unavailable.
    }
  }
  if (version === selectionVersion) void load()
})
</script>

<template>
  <v-container class="kpi-page" fluid>
    <header class="page-head">
      <div><span class="eyebrow">HỆ THỐNG DỮ LIỆU GIAO BAN</span><h1>{{ isMaintenanceProcedure(selectedProcedure) ? 'Doanh thu duy trì Fiber + MyTV' : 'Tổng hợp chỉ tiêu KPI' }}</h1><p>{{ pageDescription }} <strong>{{ monthLabel }}</strong>.</p></div>
    </header>
    <v-card class="filter-card" elevation="0"><v-card-text class="filter-row">
      <v-select v-model="selectedProcedure" :items="procedureOptions" label="Chỉ tiêu" variant="outlined" hide-details />
      <v-select v-model="monthNumber" :items="monthOptions" :label="isSnapshotTrend ? 'Bộ số liệu tháng' : 'Tháng báo cáo'" variant="outlined" hide-details />
      <v-select v-model="year" :items="yearOptions" label="Năm" variant="outlined" hide-details />
      <v-btn color="primary" prepend-icon="mdi-chart-box-outline" :loading="loading" @click="load">Xem số liệu</v-btn>
      <div v-if="selectedProcedure === 'TONG_HOP_KPI'" class="mode-toggle"><span>{{ cumulativeMode ? 'L\u0169y k\u1ebf' : 'Theo th\u00e1ng' }}</span><v-switch v-model="cumulativeMode" color="primary" density="compact" inset hide-details /></div>
    </v-card-text></v-card>
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
            <div class="chart-sort-header"><v-card-title><div><strong>{{ cumulativeMode ? 'Cơ cấu thực hiện lũy kế theo KPI' : 'Cơ cấu thực hiện theo KPI' }}</strong><span>Tỷ trọng {{ cumulativeMode ? 'lũy kế đến' : 'trong' }} {{ monthLabel }}</span></div></v-card-title><v-btn class="chart-sort-button" :icon="sortIcon(shareSort)" size="small" variant="tonal" color="primary" :title="sortTitle(shareSort)" :aria-label="sortTitle(shareSort)" @click="shareSort = toggleSort(shareSort)" /></div>
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
        <v-col cols="12" lg="6"><v-card class="chart-card" elevation="0"><div class="chart-sort-header"><v-card-title><strong>Kế hoạch và thực hiện theo KPI</strong><span>So sánh giá trị tháng {{ monthLabel }}</span></v-card-title><v-btn class="chart-sort-button" :icon="sortIcon(monthlySort)" size="small" variant="tonal" color="primary" :title="sortTitle(monthlySort)" :aria-label="sortTitle(monthlySort)" @click="monthlySort = toggleSort(monthlySort)" /></div><v-card-text><ZoomableKpiChart class="chart" :option="monthlyBarOption" axis="y" :count="chartRows.length" /></v-card-text></v-card></v-col>
        <v-col cols="12" lg="6"><v-card class="chart-card" elevation="0"><div class="chart-sort-header"><v-card-title><strong>Hoàn thành kế hoạch lũy kế theo KPI</strong><span>Tỷ lệ đến {{ monthLabel }} · đường nét đứt là mốc 100%</span></v-card-title><v-btn class="chart-sort-button" :icon="sortIcon(cumulativeRateSort)" size="small" variant="tonal" color="primary" :title="sortTitle(cumulativeRateSort)" :aria-label="sortTitle(cumulativeRateSort)" @click="cumulativeRateSort = toggleSort(cumulativeRateSort)" /></div><v-card-text><ZoomableKpiChart class="chart" :option="cumulativeRateOption" axis="y" :count="cumulativeRateRows.length" /></v-card-text></v-card></v-col>
      </v-row>
      </template>
      <template v-else-if="isPscProcedure(selectedProcedure)">
        <v-alert v-if="!pscRows.length" class="mt-4" type="info" variant="tonal">Không có dữ liệu {{ selectedProcedureLabel }} trong {{ monthLabel }}.</v-alert>
        <template v-else>
          <v-row class="summary-row">
            <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>TỶ LỆ NGỪNG PSC LŨY KẾ</small><strong>{{ pscTotal?.cumulativeStopRate == null ? '—' : `${numberFormat.format(pscTotal.cumulativeStopRate)}%` }}</strong></v-card></v-col>
            <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>NGỪNG PSC LŨY KẾ</small><strong>{{ pscTotal?.cumulativeStopped == null ? '—' : numberFormat.format(pscTotal.cumulativeStopped) }}<span v-if="pscTotal?.cumulativeStopped != null" class="summary-unit"> thuê bao</span></strong></v-card></v-col>
            <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>PSC LŨY KẾ</small><strong>{{ pscTotal?.cumulativePsc == null ? '—' : numberFormat.format(pscTotal.cumulativePsc) }}<span v-if="pscTotal?.cumulativePsc != null" class="summary-unit"> thuê bao</span></strong></v-card></v-col>
          </v-row>
          <v-card v-if="pscChartRows.length" class="chart-card psc-chart-card" elevation="0">
            <v-card-title><strong>Tỷ lệ ngừng PSC lũy kế theo đơn vị</strong><span>{{ selectedProcedureLabel }} · {{ monthLabel }}</span></v-card-title>
            <div class="psc-rate-toolbar"><v-btn class="psc-sort-control" size="small" variant="tonal" color="primary" :icon="sortIcon(pscRateSort)" :title="sortTitle(pscRateSort)" :aria-label="sortTitle(pscRateSort)" @click="pscRateSort = toggleSort(pscRateSort)" /></div>
            <v-card-text><ZoomableKpiChart class="chart psc-chart" :option="pscRateOption" axis="y" :count="pscChartRows.length" /></v-card-text>
          </v-card>
          <v-row v-if="pscUnitRows.length" class="chart-row psc-metric-row">
            <v-col cols="12" lg="6">
              <v-card class="chart-card" elevation="0">
                <v-card-title><strong>{{ pscMonthlyMetricLabel }} trong tháng theo đơn vị</strong><span>{{ monthLabel }} · chọn chỉ số để so sánh</span></v-card-title>
                <div class="psc-metric-filters">
                  <v-chip v-for="metric in pscMonthlyMetrics" :key="metric.value" :color="metric.value === pscMonthlyMetric ? '#0c8b8d' : undefined" :variant="metric.value === pscMonthlyMetric ? 'flat' : 'outlined'" @click="pscMonthlyMetric = metric.value">{{ metric.title }}</v-chip>
                  <v-btn class="psc-sort-control" size="small" variant="tonal" color="primary" :icon="sortIcon(pscMonthlySort)" :title="sortTitle(pscMonthlySort)" :aria-label="sortTitle(pscMonthlySort)" @click="pscMonthlySort = toggleSort(pscMonthlySort)" />
                </div>
                <v-card-text v-if="pscMonthlyChartRows.length"><ZoomableKpiChart class="chart psc-chart" :option="pscMonthlyOption" axis="y" :count="pscMonthlyChartRows.length" /></v-card-text>
                <v-card-text v-else>Không có dữ liệu chỉ số này.</v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" lg="6">
              <v-card class="chart-card" elevation="0">
                <v-card-title><strong>{{ pscCumulativeMetricLabel }} theo đơn vị</strong><span>Đến {{ monthLabel }}<template v-if="pscCumulativeMetric === 'cumulativeNetGrowth'"> · giá trị âm thể hiện thực giảm</template></span></v-card-title>
                <div class="psc-metric-filters">
                  <v-chip v-for="metric in pscCumulativeMetrics" :key="metric.value" :color="metric.value === pscCumulativeMetric ? '#437ac6' : undefined" :variant="metric.value === pscCumulativeMetric ? 'flat' : 'outlined'" @click="pscCumulativeMetric = metric.value">{{ metric.title }}</v-chip>
                  <v-btn class="psc-sort-control" size="small" variant="tonal" color="primary" :icon="sortIcon(pscCumulativeSort)" :title="sortTitle(pscCumulativeSort)" :aria-label="sortTitle(pscCumulativeSort)" @click="pscCumulativeSort = toggleSort(pscCumulativeSort)" />
                </div>
                <v-card-text v-if="pscCumulativeChartRows.length"><ZoomableKpiChart class="chart psc-chart" :option="pscCumulativeOption" axis="y" :count="pscCumulativeChartRows.length" /></v-card-text>
                <v-card-text v-else>Không có dữ liệu chỉ số này.</v-card-text>
              </v-card>
            </v-col>
          </v-row>
          <v-card class="table-card psc-table-card" elevation="0">
            <v-card-title><div><strong>Chi tiết {{ selectedProcedureLabel }} theo đơn vị</strong><span>Số liệu tháng và lũy kế đến {{ monthLabel }}</span></div></v-card-title>
            <v-data-table
              :headers="[{ title: 'Đơn vị', key: 'unitName', fixed: 'start', width: 190 }, { title: 'PTM tháng', key: 'monthlyNew', align: 'end' }, { title: 'PSC tháng', key: 'monthlyPsc', align: 'end' }, { title: 'PTM lũy kế', key: 'cumulativeNew', align: 'end' }, { title: 'PSC lũy kế', key: 'cumulativePsc', align: 'end' }, { title: 'Thực tăng lũy kế', key: 'cumulativeNetGrowth', align: 'end' }, { title: 'Ngừng PSC lũy kế', key: 'cumulativeStopped', align: 'end' }, { title: 'Tỷ lệ ngừng PSC lũy kế', key: 'cumulativeStopRate', align: 'end' }]"
              :items="pscRows"
              :items-per-page="20"
              :items-per-page-options="[10, 20, 50]"
              density="comfortable"
              hover
              class="kpi-table"
            >
              <template #item.unitName="{ item }">{{ item.unitCode === 'TONG' ? 'TỔNG CỘNG' : item.unitName || item.unitCode }}</template>
              <template #item.monthlyNew="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.monthlyPsc="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.cumulativeNew="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.cumulativePsc="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.cumulativeNetGrowth="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.cumulativeStopped="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.cumulativeStopRate="{ value }">{{ value == null ? '—' : `${numberFormat.format(value)}%` }}</template>
            </v-data-table>
          </v-card>
        </template>
      </template>
      <template v-else-if="isMaintenanceProcedure(selectedProcedure)">
        <v-alert v-if="!maintenanceRows.length" class="mt-4" type="info" variant="tonal">Không có dữ liệu doanh thu duy trì Fiber và MyTV trong {{ monthLabel }}.</v-alert>
        <template v-else>
          <div class="maintenance-context">
            <div><strong><v-icon icon="mdi-office-building-outline" size="18" /> {{ maintenanceSelectedName }}</strong><span>Lũy kế từ tháng 1 đến {{ monthLabel }} · Tháng gốc {{ maintenanceBaseMonth }}</span></div>
            <v-btn v-if="selectedMaintenanceRow" size="small" variant="tonal" color="primary" prepend-icon="mdi-close-circle-outline" @click="clearMaintenanceUnit">Xem toàn bộ đơn vị</v-btn>
          </div>
          <v-row class="summary-row">
            <v-col cols="12" sm="6" lg="3"><v-card class="summary-card maintenance-summary" elevation="0"><small>DOANH THU DUY TRÌ ƯỚC TÍNH</small><strong>{{ maintenanceMoney(maintenanceTotals.maintained) }}</strong><p>Doanh thu tháng gốc tính cho {{ monthNumber }} tháng</p><span>{{ maintenanceMoney(maintenanceTotals.base) }}</span></v-card></v-col>
            <v-col cols="12" sm="6" lg="3"><v-card class="summary-card maintenance-summary" elevation="0"><small>TỶ LỆ DOANH THU DUY TRÌ</small><strong>{{ maintenanceRateTotal == null ? '—' : `${numberFormat.format(maintenanceRateTotal)}%` }}</strong><p v-if="selectedMaintenanceRow">Mức chung {{ maintenanceNetworkRate == null ? '—' : `${numberFormat.format(maintenanceNetworkRate)}%` }}</p><p v-else>{{ maintenanceBelowNetwork }}/{{ maintenanceRows.length }} đơn vị dưới mức chung</p><span>Tính theo tỷ trọng doanh thu gốc</span></v-card></v-col>
            <v-col cols="12" sm="6" lg="3"><v-card class="summary-card maintenance-summary maintenance-summary-loss" elevation="0"><small>DOANH THU HỦY ƯỚC TÍNH</small><strong>{{ maintenanceMoney(maintenanceTotals.canceled) }}</strong><p>Fiber {{ maintenanceMoney(maintenanceTotals.canceledFiber) }}</p><span>MyTV {{ maintenanceMoney(maintenanceTotals.canceledMyTv) }}<br>Tỷ lệ doanh thu hủy: {{ maintenanceLossShare == null ? '—' : `${numberFormat.format(maintenanceLossShare)}%` }}</span></v-card></v-col>
            <v-col cols="12" sm="6" lg="3"><v-card class="summary-card maintenance-summary" elevation="0"><small>THUÊ BAO NGỪNG PSC LŨY KẾ</small><strong>{{ maintenanceCount(maintenanceTotals.stoppedSubscribers) }}<span class="summary-unit"> thuê bao</span></strong><p>Fiber {{ maintenanceCount(maintenanceTotals.stoppedFiber) }} · MyTV {{ maintenanceCount(maintenanceTotals.stoppedMyTv) }}</p><span>PSC: phát sinh cước</span></v-card></v-col>
          </v-row>
          <div class="maintenance-highlights">
            <button v-if="maintenanceLowestUnit" type="button" :aria-pressed="selectedMaintenanceUnit === maintenanceLowestUnit.unitCode" @click="selectedMaintenanceUnit = maintenanceLowestUnit.unitCode"><v-icon icon="mdi-chart-bar" size="18" /><span>Tỷ lệ duy trì thấp nhất <strong>{{ maintenanceLowestUnit.unitName }} · {{ maintenanceLowestUnit.maintainedRate == null ? '—' : `${numberFormat.format(maintenanceLowestUnit.maintainedRate)}%` }}</strong></span><v-icon icon="mdi-chevron-right" size="18" /></button>
            <button v-if="maintenanceLargestLossUnit" type="button" :aria-pressed="selectedMaintenanceUnit === maintenanceLargestLossUnit.unitCode" @click="selectedMaintenanceUnit = maintenanceLargestLossUnit.unitCode"><v-icon icon="mdi-cash-minus" size="18" /><span>Doanh thu hủy ước tính lớn nhất <strong>{{ maintenanceLargestLossUnit.unitName }} · {{ maintenanceMoney(maintenanceLargestLossUnit.estimatedCanceledRevenue) }}</strong></span><v-icon icon="mdi-chevron-right" size="18" /></button>
          </div>
          <v-row class="chart-row maintenance-overview-row">
            <v-col cols="12" lg="6">
              <v-card class="chart-card" elevation="0">
                <div class="chart-sort-header"><v-card-title><strong>Tỷ lệ duy trì theo đơn vị</strong><span>Mặc định xếp thấp nhất trước · Bấm đơn vị để xem chi tiết</span></v-card-title><v-btn class="chart-sort-button" :icon="sortIcon(maintenanceRateSort)" size="small" variant="tonal" color="primary" :title="sortTitle(maintenanceRateSort)" :aria-label="sortTitle(maintenanceRateSort)" @click="maintenanceRateSort = toggleSort(maintenanceRateSort)" /></div>
                <div class="maintenance-chart-toolbar maintenance-rate-note"><span><i /> Dưới mức chung</span><span>Nét đứt: mức chung {{ maintenanceNetworkRate == null ? '—' : `${numberFormat.format(maintenanceNetworkRate)}%` }}</span></div>
                <v-card-text><ZoomableKpiChart class="chart maintenance-chart" :option="maintenanceRateOption" axis="y" :count="maintenanceRateRows.length" @click="selectMaintenanceUnit($event, maintenanceRateRows)" /></v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" lg="6">
              <v-card class="chart-card" elevation="0">
                <div class="chart-sort-header"><v-card-title><strong>{{ maintenanceUnitChartTitle }} theo đơn vị</strong><span>{{ maintenanceRevenueCaption }}</span></v-card-title><v-btn class="chart-sort-button" :icon="sortIcon(maintenanceRevenueSort)" size="small" variant="tonal" color="primary" :title="sortTitle(maintenanceRevenueSort)" :aria-label="sortTitle(maintenanceRevenueSort)" @click="maintenanceRevenueSort = toggleSort(maintenanceRevenueSort)" /></div>
                <div class="maintenance-chart-toolbar"><v-select v-model="maintenanceRevenueView" :items="maintenanceRevenueViewOptions" label="Chỉ tiêu doanh thu" density="compact" variant="outlined" hide-details /></div>
                <v-card-text><ZoomableKpiChart class="chart maintenance-chart" :option="maintenanceRevenueOption" axis="y" :count="maintenanceRevenueChartRows.length" @click="selectMaintenanceUnit($event, maintenanceRevenueChartRows)" /></v-card-text>
              </v-card>
            </v-col>
          </v-row>
          <v-expansion-panels class="maintenance-details" variant="accordion">
            <v-expansion-panel elevation="0">
              <v-expansion-panel-title>Phân tích thêm: thuê bao và doanh thu bình quân</v-expansion-panel-title>
              <v-expansion-panel-text>
                <div class="chart-sort-header"><div><strong>{{ maintenanceOtherChartTitle }} theo đơn vị</strong><p class="maintenance-detail-caption">{{ maintenanceOtherView === 'arpu' ? `Tháng gốc ${maintenanceBaseMonth} · Đơn vị: đồng/thuê bao · Xếp theo ARPU Fiber` : maintenanceOtherView === 'subscribers' ? `Số thuê bao trong tháng gốc ${maintenanceBaseMonth}` : `Thuê bao ngừng phát sinh cước lũy kế đến ${monthLabel}` }}</p></div><v-btn :icon="sortIcon(maintenanceSubscriberSort)" size="small" variant="tonal" color="primary" :title="sortTitle(maintenanceSubscriberSort)" :aria-label="sortTitle(maintenanceSubscriberSort)" @click="maintenanceSubscriberSort = toggleSort(maintenanceSubscriberSort)" /></div>
                <div class="maintenance-metric-filters"><v-chip v-for="item in maintenanceOtherViewOptions" :key="item.value" :color="maintenanceOtherView === item.value ? 'primary' : undefined" :variant="maintenanceOtherView === item.value ? 'flat' : 'outlined'" size="small" @click="maintenanceOtherView = item.value">{{ item.title }}</v-chip></div>
                <ZoomableKpiChart class="chart maintenance-chart" :option="maintenanceOtherOption" axis="y" :count="maintenanceOtherChartRows.length" @click="selectMaintenanceUnit($event, maintenanceOtherChartRows)" />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
          <v-card class="table-card trend-table-card" elevation="0">
            <v-card-title><div><strong>Chi tiết theo đơn vị</strong><span>Đơn vị tiền: đồng · Mặc định xếp doanh thu hủy ước tính giảm dần · Bấm tên đơn vị để xem các thẻ phía trên</span></div></v-card-title>
            <div class="maintenance-table-toolbar"><v-btn-toggle v-model="maintenanceTableView" mandatory density="compact" variant="tonal" color="primary" aria-label="Nhóm số liệu trong bảng"><v-btn value="overview" size="small">Tổng quan</v-btn><v-btn value="revenue" size="small">Doanh thu</v-btn><v-btn value="subscribers" size="small">Thuê bao &amp; ARPU</v-btn></v-btn-toggle></div>
            <v-data-table
              :headers="maintenanceTableHeaders"
              :items="maintenanceTableRows"
              :items-per-page="20"
              :items-per-page-options="[10, 20, 50]"
              density="comfortable"
              hover
              class="kpi-table"
            >
              <template #item.unitName="{ item }"><button type="button" class="snapshot-table-month" :class="{ 'is-selected': selectedMaintenanceUnit === item.unitCode }" :aria-pressed="selectedMaintenanceUnit === item.unitCode" @click="selectedMaintenanceUnit = selectedMaintenanceUnit === item.unitCode ? null : item.unitCode">{{ item.unitName }}</button></template>
              <template v-for="key in maintenanceTableNumberKeys" :key="key" #[`item.${key}`]="{ value }">{{ maintenanceCount(value) }}</template>
              <template #item.maintainedRate="{ value }">{{ value == null ? '—' : `${numberFormat.format(value)}%` }}</template>
            </v-data-table>
          </v-card>
        </template>
      </template>
      <template v-else>
        <div v-if="isSnapshotTrend && trendRows.length" class="snapshot-context">
          <div><span class="snapshot-period"><v-icon icon="mdi-calendar-month-outline" size="17" /> Đang xem <strong>{{ snapshotViewingLabel }}</strong></span><small>Bộ số liệu {{ monthLabel }}<template v-if="snapshotSummaryTrend?.updatedAt"> · Cập nhật {{ snapshotSummaryTrend.updatedAt }}</template></small></div>
          <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-history" :disabled="!selectedSnapshotMonth || selectedSnapshotMonth === currentTrend?.month" @click="selectedSnapshotMonth = null">Tháng mới nhất</v-btn>
        </div>
        <v-row class="summary-row">
          <template v-if="isSnapshotTrend">
            <v-col cols="12" sm="6" lg="3"><v-card class="summary-card snapshot-summary" elevation="0"><small>DOANH THU THÁNG</small><strong>{{ snapshotSummaryTrend?.revenue == null ? '—' : formatRevenue(snapshotSummaryTrend.revenue) }}</strong><p :class="snapshotRevenueChange && snapshotRevenueChange.delta < 0 ? 'snapshot-negative' : ''"><v-icon :icon="snapshotRevenueChange && snapshotRevenueChange.delta > 0 ? 'mdi-trending-up' : snapshotRevenueChange && snapshotRevenueChange.delta < 0 ? 'mdi-trending-down' : 'mdi-minus'" size="15" /> {{ signedChange(snapshotRevenueChange, 'revenue') }}</p><span>So với tháng trước</span></v-card></v-col>
            <v-col cols="12" sm="6" lg="3"><v-card class="summary-card snapshot-summary" elevation="0"><small>HOÀN THÀNH THÁNG</small><strong :class="snapshotSummaryTrend?.completionRate != null && snapshotSummaryTrend.completionRate < 100 ? 'snapshot-negative' : ''">{{ snapshotSummaryTrend?.completionRate == null ? '—' : `${numberFormat.format(snapshotSummaryTrend.completionRate)}%` }}</strong><p>{{ snapshotGap(snapshotSummaryTrend?.revenue, snapshotSummaryTrend?.plan) }}</p><span>Kế hoạch: {{ snapshotSummaryTrend?.plan == null ? '—' : formatRevenue(snapshotSummaryTrend.plan) }}</span></v-card></v-col>
            <v-col cols="12" sm="6" lg="3"><v-card class="summary-card snapshot-summary" elevation="0"><small>DOANH THU LŨY KẾ</small><strong>{{ snapshotSummaryTrend?.cumulativeRevenue == null ? '—' : formatRevenue(snapshotSummaryTrend.cumulativeRevenue) }}</strong><p>Kế hoạch: {{ snapshotSummaryTrend?.cumulativePlan == null ? '—' : formatRevenue(snapshotSummaryTrend.cumulativePlan) }}</p><span>Từ đầu năm đến {{ snapshotViewingLabel }}</span></v-card></v-col>
            <v-col cols="12" sm="6" lg="3"><v-card class="summary-card snapshot-summary" elevation="0"><small>HOÀN THÀNH LŨY KẾ</small><strong :class="snapshotSummaryTrend?.cumulativeRate != null && snapshotSummaryTrend.cumulativeRate < 100 ? 'snapshot-negative' : ''">{{ snapshotSummaryTrend?.cumulativeRate == null ? '—' : `${numberFormat.format(snapshotSummaryTrend.cumulativeRate)}%` }}</strong><p>{{ snapshotGap(snapshotSummaryTrend?.cumulativeRevenue, snapshotSummaryTrend?.cumulativePlan) }}</p><span>So với kế hoạch lũy kế đến tháng</span></v-card></v-col>
          </template>
          <template v-else>
            <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>DOANH THU THÁNG </small><strong>{{ currentTrend?.revenue == null ? '—' : formatRevenue(currentTrend.revenue) }}</strong></v-card></v-col>
            <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>DOANH THU LŨY KẾ</small><strong>{{ trendHasRevenue ? formatRevenue(cumulativeRevenue) : '—' }}</strong></v-card></v-col>
            <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>SỐ THUÊ BAO THÁNG</small><strong>{{ currentTrend?.subscribers == null ? '—' : numberFormat.format(currentTrend.subscribers) }}</strong></v-card></v-col>
          </template>
        </v-row>
        <v-alert v-if="!trendHasData" class="mt-4" type="info" variant="tonal">Không có dữ liệu {{ selectedProcedureLabel }} từ đầu năm đến {{ monthLabel }}.</v-alert>
        <template v-else>
          <v-row class="chart-row trend-chart-row">
            <template v-if="isSnapshotTrend">
              <v-col cols="12" lg="6">
                <v-card class="chart-card" elevation="0">
                  <div class="chart-sort-header"><v-card-title><strong>Kế hoạch và doanh thu từng tháng</strong><span>Bấm cột để xem chi tiết tháng tương ứng</span></v-card-title><v-btn class="chart-sort-button" :icon="sortIcon(revenueSort)" size="small" variant="tonal" color="primary" :title="sortTitle(revenueSort, true)" :aria-label="sortTitle(revenueSort, true)" @click="revenueSort = toggleSort(revenueSort)" /></div>
                  <div class="snapshot-chart-mode"><v-btn-toggle v-model="snapshotMonthlyView" mandatory density="compact" color="primary" variant="tonal" aria-label="Cách xem biểu đồ tháng"><v-btn value="value" size="small">Giá trị</v-btn><v-btn value="rate" size="small">Tỷ lệ hoàn thành</v-btn></v-btn-toggle></div>
                  <v-card-text><ZoomableKpiChart :key="`${selectedProcedure}-${snapshotMonthlyView}`" class="chart" :option="snapshotMonthlyOption" axis="y" :count="trendRows.length" @click="selectSnapshotMonth($event, snapshotMonthlyRows)" /></v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" lg="6">
                <v-card class="chart-card" elevation="0">
                  <div class="chart-sort-header"><v-card-title><strong>Tiến độ doanh thu lũy kế</strong><span>Nét đứt: kế hoạch · Nét liền: thực hiện</span></v-card-title><v-btn class="chart-sort-button" :icon="sortIcon(subscriberSort)" size="small" variant="tonal" color="primary" :title="sortTitle(subscriberSort, true)" :aria-label="sortTitle(subscriberSort, true)" @click="subscriberSort = toggleSort(subscriberSort)" /></div>
                  <div class="snapshot-chart-caption">{{ snapshotGap(snapshotSummaryTrend?.cumulativeRevenue, snapshotSummaryTrend?.cumulativePlan) }} · {{ snapshotViewingLabel }}</div>
                  <v-card-text><ZoomableKpiChart :key="selectedProcedure" class="chart" :option="snapshotCumulativeOption" axis="y" :count="trendRows.length" @click="selectSnapshotMonth($event, snapshotCumulativeRows)" /></v-card-text>
                </v-card>
              </v-col>
            </template>
            <template v-else>
            <v-col v-if="trendHasRevenue" cols="12" :lg="trendHasSubscribers ? 6 : 12">
              <v-card class="chart-card" elevation="0">
                <div class="chart-sort-header"><v-card-title><strong>Doanh thu {{ selectedProcedureLabel }}</strong><span>Theo tháng đến {{ monthLabel }}</span></v-card-title><v-btn class="chart-sort-button" :icon="sortIcon(revenueSort)" size="small" variant="tonal" color="primary" :title="sortTitle(revenueSort, true)" :aria-label="sortTitle(revenueSort, true)" @click="revenueSort = toggleSort(revenueSort)" /></div>
                <div class="trend-chart-kpi">
                  <div><small>DOANH THU THÁNG MỚI NHẤT</small><strong>{{ currentTrend?.revenue == null ? '—' : formatRevenue(currentTrend.revenue) }}</strong></div>
                  <div class="trend-chart-change" :class="revenueChange ? (revenueChange.delta > 0 ? 'is-up' : revenueChange.delta < 0 ? 'is-down' : 'is-neutral') : 'is-neutral'">
                    <v-icon :icon="revenueChange && revenueChange.delta > 0 ? 'mdi-trending-up' : revenueChange && revenueChange.delta < 0 ? 'mdi-trending-down' : 'mdi-minus'" size="18" />
                    <span>{{ signedChange(revenueChange, 'revenue') }}</span>
                  </div>
                </div>
                <v-card-text><ZoomableKpiChart class="chart" :option="trendRevenueOption" axis="y" :count="trendRows.length" /></v-card-text>
              </v-card>
            </v-col>
            <v-col v-if="trendHasSubscribers" cols="12" :lg="trendHasRevenue ? 6 : 12">
              <v-card class="chart-card" elevation="0">
                <div class="chart-sort-header"><v-card-title><strong>Số thuê bao {{ selectedProcedureLabel }}</strong>
                  <span>Xu hướng đến {{ monthLabel }}</span>
                
                </v-card-title><v-btn class="chart-sort-button" :icon="sortIcon(subscriberSort)" size="small" variant="tonal" color="primary" :title="sortTitle(subscriberSort, true)" :aria-label="sortTitle(subscriberSort, true)" @click="subscriberSort = toggleSort(subscriberSort)" /></div>
                <div class="trend-chart-kpi">
                  <div><small>SỐ THUÊ BAO THÁNG MỚI NHẤT</small><strong>{{ currentTrend?.subscribers == null ? '—' : numberFormat.format(currentTrend.subscribers) }}</strong></div>
                  <div class="trend-chart-change" :class="subscriberChange ? (subscriberChange.delta > 0 ? 'is-up' : subscriberChange.delta < 0 ? 'is-down' : 'is-neutral') : 'is-neutral'">
                    <v-icon :icon="subscriberChange && subscriberChange.delta > 0 ? 'mdi-trending-up' : subscriberChange && subscriberChange.delta < 0 ? 'mdi-trending-down' : 'mdi-minus'" size="18" />
                    <span>{{ signedChange(subscriberChange, 'subscribers') }}</span>
                  </div>
                </div>
                <v-card-text><ZoomableKpiChart class="chart" :option="trendSubscribersOption" axis="y" :count="trendRows.length" /></v-card-text>
              </v-card>
            </v-col>
            </template>
          </v-row>
          <template v-if="isSnapshotTrend">
            <v-card class="snapshot-annual" elevation="0">
              <div class="snapshot-annual-head"><div><strong>Tiến độ kế hoạch năm</strong><span>Lũy kế đến {{ snapshotViewingLabel }}</span></div><strong class="snapshot-annual-rate">{{ snapshotSummaryTrend?.annualRate == null ? '—' : `${numberFormat.format(snapshotSummaryTrend.annualRate)}%` }}</strong></div>
              <div v-if="snapshotAnnualScale" class="snapshot-annual-track" role="img" :aria-label="`Doanh thu lũy kế ${formatRevenue(snapshotSummaryTrend!.cumulativeRevenue!)}; kế hoạch năm ${formatRevenue(snapshotSummaryTrend!.annualPlan!)}; hoàn thành ${snapshotSummaryTrend?.annualRate == null ? 'chưa có tỷ lệ' : `${numberFormat.format(snapshotSummaryTrend.annualRate)}%`}`"><div class="snapshot-annual-fill" :style="{ width: `${snapshotAnnualScale.actual}%` }" /><div class="snapshot-annual-target" :style="{ left: `${snapshotAnnualScale.target}%` }" /></div>
              <p v-else class="snapshot-annual-empty">Chưa có đủ số liệu để vẽ tiến độ kế hoạch năm.</p>
              <div class="snapshot-annual-values"><span><i class="snapshot-legend-actual" /> Đã thực hiện <b>{{ snapshotSummaryTrend?.cumulativeRevenue == null ? '—' : formatRevenue(snapshotSummaryTrend.cumulativeRevenue) }}</b></span><span><i class="snapshot-legend-target" /> Kế hoạch năm <b>{{ snapshotSummaryTrend?.annualPlan == null ? '—' : formatRevenue(snapshotSummaryTrend.annualPlan) }}</b></span><span>{{ snapshotGap(snapshotSummaryTrend?.cumulativeRevenue, snapshotSummaryTrend?.annualPlan) }}</span></div>
              <small>Vạch đứng là mục tiêu năm. Tiến độ so với kế hoạch đến tháng được thể hiện ở thẻ hoàn thành lũy kế phía trên.</small>
            </v-card>
            <v-alert v-if="snapshotPlanDiscrepancies.length" type="warning" variant="tonal" density="compact" class="snapshot-check">Kế hoạch lũy kế tại {{ snapshotPlanDiscrepancies.join(', ') }} trong nguồn khác tổng kế hoạch các tháng trước đó và tháng hiện tại. Biểu đồ và bảng giữ nguyên số liệu nguồn; cần đối chiếu kế hoạch kỳ này.</v-alert>
          </template>
          <v-card v-if="isSnapshotTrend" class="table-card trend-table-card snapshot-table" elevation="0">
            <v-card-title><div><strong>Chi tiết {{ selectedProcedureLabel }} theo tháng</strong><span>Bộ số liệu {{ monthLabel }} · Đơn vị tiền: đồng</span></div></v-card-title>
            <v-data-table
              :headers="snapshotTableHeaders"
              :items="trendRows"
              :items-per-page="12"
              hide-default-footer
              density="comfortable"
              hover
              class="kpi-table"
            >
              <template #item.month="{ value }"><button type="button" class="snapshot-table-month" :class="{ 'is-selected': value === snapshotSummaryTrend?.month }" :aria-pressed="value === snapshotSummaryTrend?.month" @click="selectedSnapshotMonth = value">Tháng {{ Number(value.slice(5)) }}/{{ value.slice(0, 4) }}</button></template>
              <template #item.plan="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.revenue="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.completionRate="{ value }">{{ value == null ? '—' : `${numberFormat.format(value)}%` }}</template>
              <template #item.cumulativePlan="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.cumulativeRevenue="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.cumulativeRate="{ value }">{{ value == null ? '—' : `${numberFormat.format(value)}%` }}</template>
              <template #item.annualPlan="{ value }">{{ value == null ? '—' : numberFormat.format(value) }}</template>
              <template #item.annualRate="{ value }">{{ value == null ? '—' : `${numberFormat.format(value)}%` }}</template>
            </v-data-table>
          </v-card>
          <v-card v-else class="table-card trend-table-card" elevation="0">
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
.psc-chart-card,.psc-table-card{height:auto;margin-top:20px}.psc-chart{height:440px}
.psc-metric-row .chart-card{height:100%}.psc-metric-filters{display:flex;flex-wrap:wrap;gap:8px;padding:8px 21px 12px}.psc-metric-filters :deep(.v-chip){font-size:12px;font-weight:600}
.summary-unit{color:rgba(var(--v-theme-on-surface),.58);font-size:13px;font-weight:500;white-space:nowrap}
.psc-rate-toolbar{display:flex;justify-content:flex-end;padding:0 21px 8px}.psc-sort-control{margin-left:auto;flex:0 0 auto;text-transform:none;letter-spacing:0}
.chart-sort-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.chart-sort-header :deep(.v-card-title){min-width:0;flex:1}.chart-sort-button{flex:0 0 auto;margin:16px 18px 0 0}
.maintenance-metric-filters{display:flex;flex-wrap:wrap;gap:7px;padding:5px 21px 8px}.maintenance-metric-filters :deep(.v-chip){font-size:11px;font-weight:600}.maintenance-selection{display:flex;align-items:center}
.maintenance-context{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:22px}.maintenance-context strong{display:flex;align-items:center;gap:7px;color:rgb(var(--v-theme-primary));font-size:15px}.maintenance-context span{display:block;margin-top:5px;color:rgba(var(--v-theme-on-surface),.58);font-size:12px}.maintenance-summary{border-top:3px solid #0c8b8d}.maintenance-summary strong{font-size:22px}.maintenance-summary p{margin:10px 0 4px;font-size:12px;line-height:1.5;color:#356b73}.maintenance-summary>span{font-size:11px;color:rgba(var(--v-theme-on-surface),.58);line-height:1.6}.maintenance-summary-loss{border-top-color:#cf873b}.maintenance-summary-loss strong{color:#b76b23}.maintenance-highlights{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}.maintenance-highlights button{display:flex;align-items:center;gap:12px;padding:14px 18px;border:1px solid rgba(var(--v-theme-primary),.12);border-radius:10px;background:rgb(var(--v-theme-surface));text-align:left;color:#657b8b;font-size:12px}.maintenance-highlights button>span{flex:1}.maintenance-highlights strong{display:block;margin-top:4px;color:rgb(var(--v-theme-on-surface));font-size:14px}.maintenance-highlights button:hover,.maintenance-highlights button[aria-pressed=true]{border-color:rgb(var(--v-theme-primary));background:rgba(var(--v-theme-primary),.04)}.maintenance-highlights button:focus-visible{outline:2px solid rgb(var(--v-theme-primary));outline-offset:2px}.maintenance-overview-row .chart-sort-header{min-height:100px}.maintenance-chart-toolbar{display:flex;align-items:center;gap:12px;min-height:64px;padding:0 21px 12px}.maintenance-chart-toolbar :deep(.v-input){max-width:340px}.maintenance-rate-note{flex-wrap:wrap;align-content:center;color:#657b8b;font-size:11px}.maintenance-rate-note span{display:flex;align-items:center;gap:6px}.maintenance-rate-note i{display:inline-block;width:10px;height:10px;background:#cf873b;border-radius:2px}.maintenance-chart{height:440px}.maintenance-details :deep(.v-expansion-panel){border-radius:12px!important;border:1px solid rgba(var(--v-border-color),.12)}.maintenance-details :deep(.v-expansion-panel-title){font-size:14px;font-weight:600}.maintenance-detail-caption{margin-top:5px;color:#657b8b;font-size:12px}.maintenance-table-toolbar{padding:6px 21px 16px;overflow-x:auto}.maintenance-table-toolbar :deep(.v-btn){text-transform:none;letter-spacing:0}@media(max-width:700px){.maintenance-context{align-items:flex-start;flex-direction:column}.maintenance-highlights{grid-template-columns:1fr;gap:10px}.maintenance-overview-row .chart-sort-header{min-height:0}.maintenance-chart-toolbar{min-height:70px}.maintenance-details :deep(.v-expansion-panel-text__wrapper){padding:12px}.maintenance-summary strong{font-size:23px}}
.snapshot-context{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px}.snapshot-context small{display:block;margin-top:5px;color:rgba(var(--v-theme-on-surface),.58);font-size:12px}.snapshot-period{display:flex;align-items:center;gap:6px;font-size:14px;color:rgb(var(--v-theme-primary))}.snapshot-summary{border-top:3px solid #0c8b8d}.snapshot-summary p{margin:10px 0 3px;font-size:12px;color:#236a6e;line-height:1.6}.snapshot-summary>span{color:rgba(var(--v-theme-on-surface),.58);font-size:11px}.snapshot-summary .snapshot-negative{color:#b75c27!important}.snapshot-summary strong{font-size:22px}.snapshot-chart-mode,.snapshot-chart-caption{display:flex;align-items:center;min-height:46px;padding:2px 21px 8px}.snapshot-chart-mode :deep(.v-btn){text-transform:none;letter-spacing:0;font-size:12px}.snapshot-chart-caption{font-size:12px;color:#526a7b}.snapshot-annual{margin-top:20px;padding:20px 24px;border-radius:12px;box-shadow:0 4px 18px rgba(29,61,83,.08)!important}.snapshot-annual-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.snapshot-annual-head>div>strong{font-size:16px}.snapshot-annual-head span{display:block;margin-top:5px;font-size:12px;color:rgba(var(--v-theme-on-surface),.58)}.snapshot-annual-rate{font-size:25px;color:#0c8b8d}.snapshot-annual-track{position:relative;height:14px;margin:22px 0;background:rgba(var(--v-theme-primary),.08);border-radius:4px}.snapshot-annual-fill{height:100%;background:#0c8b8d;border-radius:4px}.snapshot-annual-target{position:absolute;top:-5px;width:3px;height:24px;background:#607587;transform:translateX(-100%)}.snapshot-annual-values{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;font-size:12px}.snapshot-annual-values span{display:flex;align-items:center;gap:6px}.snapshot-annual-values i{display:inline-block;width:10px;height:10px;background:#0c8b8d;border-radius:2px}.snapshot-annual-values i.snapshot-legend-target{width:3px;height:13px;background:#607587}.snapshot-annual small{display:block;margin-top:14px;color:rgba(var(--v-theme-on-surface),.58);font-size:11px}.snapshot-annual-empty{margin:18px 0;color:#718397;font-size:13px}.snapshot-check{margin-top:16px;font-size:12px;line-height:1.7}.snapshot-table :deep(thead tr:nth-child(2) th:first-child){position:static;min-width:112px!important;box-shadow:none}.snapshot-table-month{border-radius:5px;padding:5px 7px;text-align:left}.snapshot-table-month:hover,.snapshot-table-month.is-selected{background:rgba(var(--v-theme-primary),.1);color:rgb(var(--v-theme-primary))}.snapshot-table-month:focus-visible{outline:2px solid rgb(var(--v-theme-primary));outline-offset:2px}@media(max-width:600px){.snapshot-context{align-items:flex-start;flex-direction:column}.snapshot-annual{padding:18px}.snapshot-annual-values{flex-direction:column}.snapshot-summary strong{font-size:23px}}
</style>
