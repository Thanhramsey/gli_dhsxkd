<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { useTheme } from 'vuetify'
import { kpiApi } from '../api/kpi.api'
import { getAuthErrorMessage } from '../api/auth.api'
import type { KpiV2Code, KpiV2Group, KpiV2Row, KpiV2TrendRow, KpiV2SubscriberRow, PtmUnitScope } from '../types/kpi'
import { adaptChartOptionForTheme } from '../utils/chart-theme'
import KpiUnitMapDialog from '../components/KpiUnitMapDialog.vue'
import '../plugins/echarts'

type AmountKey = 'monthlyRevenue' | 'monthlyPlan' | 'cumulativeRevenue' | 'cumulativePlan' | 'annualPlan' | 'monthlyChange' | 'remainingAnnual'
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
const chartTooltipStyle = computed(() => ({
  backgroundColor: theme.global.current.value.dark ? '#233443' : '#fff',
  borderColor: theme.global.current.value.dark ? '#456073' : '#d7e0e8',
  textStyle: { color: theme.global.current.value.dark ? '#e4eef5' : '#33475b', fontFamily: 'Be Vietnam Pro, sans-serif', fontSize: 13, lineHeight: 20 },
  extraCssText: 'font-family:Be Vietnam Pro,sans-serif;font-size:13px;border-radius:7px;box-shadow:0 5px 14px rgba(22,54,77,.16)',
}))
const chartAxisPointer = computed(() => ({ type: 'shadow', shadowStyle: { color: theme.global.current.value.dark ? 'rgba(255,255,255,.08)' : 'rgba(18,92,146,.08)' } }))
const months = ref<string[]>([])
const month = ref('')
const monthMenuOpen = ref(false)
const pickerMonth = ref(new Date().getMonth())
const pickerYear = ref(new Date().getFullYear())
const pickerViewMode = ref<'month' | 'months' | 'year'>('months')
const rows = ref<KpiV2Row[]>([])
const reportGroup = ref<KpiV2Group>('actual')
const ptmUnitScope = ref<PtmUnitScope>('area')
const reportGroupLabel = computed(() => reportGroup.value === 'maintenance' ? 'doanh thu duy trì' : reportGroup.value === 'ptm' ? 'doanh thu PTM' : 'doanh thu thực hiện')
const subscriberRows = ref<KpiV2SubscriberRow[]>([])
const selectedSubscriberIndicator = ref('PTM')
const subscriberLoading = ref(false)
const subscriberError = ref('')
const scope = ref<'province' | 'unit'>('province')
const unitCode = ref<string | null>(null)
const selectedKpi = ref<KpiV2Code>('')
const mapDialogOpen = ref(false)
const unitPeriod = ref<UnitPeriod>('monthly')
const trendRows = ref<KpiV2TrendRow[]>([])
const trendLoading = ref(false)
const trendError = ref('')
const trendRefresh = ref(0)
let trendVersion = 0
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
let loadVersion = 0
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const money = (value: number | null | undefined) => value == null ? '—' : nf.format(value / 1_000_000)
const signedMoney = (value: number | null | undefined) => value == null ? '—' : `${value > 0 ? '+' : ''}${money(value)}`
const changeColor = (value: number | null | undefined) => value == null || value === 0 ? undefined : value > 0 ? achievedColor : unmetColor
const changeIcon = (value: number | null | undefined) => value == null || value === 0 ? undefined : value > 0 ? 'mdi-arrow-top-right' : 'mdi-arrow-bottom-right'
const changeTooltip = (value: number | null | undefined) => value == null || value === 0
  ? signedMoney(value)
  : `<span style="color:${changeColor(value)}">${value > 0 ? '↗' : '↘'} ${signedMoney(value)}</span>`
const annualGap = (value: number | null | undefined) => value == null ? '—' : value < 0 ? `Vượt ${money(-value)}` : value > 0 ? `Còn ${money(value)}` : 'Đạt kế hoạch'
const annualGapWithUnit = (value: number | null | undefined) => `${annualGap(value)}${value == null || value === 0 ? '' : ' triệu đồng'}`
const annualGapColor = (value: number | null | undefined) => value == null ? undefined : value <= 0 ? rateColor(100) : rateColor(80)
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
const subscriberIndicatorOrder = (indicator: string) => indicator === 'PTM' ? 0 : indicator === 'HUY' ? 1 : 2
const provinceSubscriberRows = computed(() => subscriberRows.value.filter(row => row.unitCode === provinceCode)
  .sort((a, b) => a.service.localeCompare(b.service, 'vi') || subscriberIndicatorOrder(a.indicator) - subscriberIndicatorOrder(b.indicator) || a.indicator.localeCompare(b.indicator, 'vi')))
const unitSubscriberRows = computed(() => subscriberRows.value.filter(row => row.unitCode !== provinceCode))
const subscriberChartRows = computed(() => scope.value === 'unit' && unitCode.value
  ? unitSubscriberRows.value.filter(row => row.unitCode === unitCode.value) : provinceSubscriberRows.value)
const subscriberServices = computed(() => [...new Set(subscriberChartRows.value.map(row => row.service))].sort((a, b) => a.localeCompare(b, 'vi')))
const subscriberIndicators = computed(() => [...new Set(subscriberChartRows.value.map(row => row.indicator))].sort((a, b) => subscriberIndicatorOrder(a) - subscriberIndicatorOrder(b) || a.localeCompare(b, 'vi')))
const subscriberMatrix = computed(() => subscriberServices.value.map(service => ({
  service,
  entries: subscriberIndicators.value.map(indicator => ({ indicator, row: subscriberChartRows.value.find(row => row.service === service && row.indicator === indicator) })),
})))
const selectedSubscriberService = computed(() => {
  const kpi = kpis.value.find(item => item.code === selectedKpi.value)
  if (!kpi) return null
  const key = `${kpi.code} ${kpi.title}`.toUpperCase()
  const services = [...new Set(unitSubscriberRows.value.map(row => row.service))]
  return services.find(service => key.includes(service.toUpperCase()) || (service.toUpperCase() === 'CAMERA' && /(?:\.|_)CAM(?:_|\b)/.test(key))) ?? null
})
const selectedSubscriberUnitRows = computed(() => unitSubscriberRows.value.filter(row => row.service === selectedSubscriberService.value && row.indicator === selectedSubscriberIndicator.value)
  .sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity) || a.unitName.localeCompare(b.unitName, 'vi')))
const selectedSubscriberUnitDetailRow = computed(() => selectedSubscriberUnitRows.value.find(row => row.unitCode === unitCode.value))
const subscriberPreviousYear = computed(() => subscriberChartRows.value[0]?.previousYear ?? Number(month.value.slice(0, 4)) - 1)
const subscriberCurrentYear = computed(() => subscriberChartRows.value[0]?.currentYear ?? Number(month.value.slice(0, 4)))
const subscriberPeriod = (year: number) => `${month.value.slice(5).padStart(2, '0')}/${year}`
const subscriberPreviousPeriod = computed(() => subscriberPeriod(subscriberPreviousYear.value))
const subscriberCurrentPeriod = computed(() => subscriberPeriod(subscriberCurrentYear.value))
const subscriberIndicatorLabel = (indicator: string) => indicator === 'HUY' ? 'Hủy' : indicator === 'PTM' ? 'PTM' : indicator
const signedCount = (value: number | null) => value == null ? '—' : `${value > 0 ? '+' : ''}${whole.format(value)}`
const signedPercent = (row: KpiV2SubscriberRow) => row.previousCount != null && row.previousCount > 0 && row.change != null
  ? `${row.change > 0 ? '+' : ''}${nf.format(row.change / row.previousCount * 100)}%` : '—'
function subscriberChangeColor(row: KpiV2SubscriberRow | undefined): string | undefined {
  if (row?.change == null || row.change === 0) return undefined
  const favorable = row.indicator === 'HUY' ? row.change < 0 : row.change > 0
  return favorable ? rateColor(100) : rateColor(0)
}
const missingProvinceKpis = computed(() => kpis.value.filter(kpi => !provinceRows.value.some(row => row.kpi === kpi.code)))
const unitRows = computed(() => rows.value.filter(row => row.unitCode !== provinceCode))
const unitOptions = computed(() => [...new Map(unitRows.value.map(row => [row.unitCode, { title: row.unitName, value: row.unitCode }])).values()].sort((a, b) => a.title.localeCompare(b.title, 'vi')))
const unitRank = (row: KpiV2Row) => unitPeriod.value === 'cumulative' ? row.cumulativeRank : unitPeriod.value === 'annual' ? row.annualRank : row.rank
const unitRankByCode = (code: string) => {
  const row = unitRows.value.find(item => item.unitCode === code && item.kpi === selectedKpi.value)
  return row ? unitRank(row) : null
}
const visibleUnits = computed(() => unitOptions.value.filter(unit => !unitCode.value || unit.value === unitCode.value).sort((a, b) => {
  const left = unitRows.value.find(row => row.unitCode === a.value && row.kpi === selectedKpi.value)
  const right = unitRows.value.find(row => row.unitCode === b.value && row.kpi === selectedKpi.value)
  return ((left ? unitRank(left) : null) ?? Infinity) - ((right ? unitRank(right) : null) ?? Infinity) || a.title.localeCompare(b.title, 'vi')
}))
const visibleUnitRows = computed(() => unitRows.value.filter(row => !unitCode.value || row.unitCode === unitCode.value))
const selectedUnitName = computed(() => unitOptions.value.find(unit => unit.value === unitCode.value)?.title ?? unitCode.value ?? '')
const selectedRows = computed(() => visibleUnitRows.value.filter(row => row.kpi === selectedKpi.value).sort((a, b) =>
  (unitRank(a) ?? Infinity) - (unitRank(b) ?? Infinity) || a.unitName.localeCompare(b.unitName, 'vi')))
const rankedUnitCodes = computed(() => unitRows.value.filter(row => row.kpi === selectedKpi.value)
  .filter(row => unitRank(row) != null)
  .sort((a, b) => unitRank(a)! - unitRank(b)! || a.unitName.localeCompare(b.unitName, 'vi'))
  .map(row => row.unitCode))
const unitPeriodFields = computed<{ actual: AmountKey; plan: AmountKey; label: string; planLabel: string }>(() => {
  if (unitPeriod.value === 'cumulative') return { actual: 'cumulativeRevenue', plan: 'cumulativePlan', label: 'Thực hiện lũy kế', planLabel: 'Kế hoạch lũy kế' }
  if (unitPeriod.value === 'annual') return { actual: 'cumulativeRevenue', plan: 'annualPlan', label: 'Thực hiện lũy kế', planLabel: 'Kế hoạch năm' }
  return { actual: 'monthlyRevenue', plan: 'monthlyPlan', label: 'Thực hiện tháng', planLabel: 'Kế hoạch tháng' }
})
const unitActual = (row: KpiV2Row) => row[unitPeriodFields.value.actual]
const unitPlan = (row: KpiV2Row) => row[unitPeriodFields.value.plan]
const trendActual = (row: KpiV2TrendRow) => row[unitPeriodFields.value.actual]
const trendPlan = (row: KpiV2TrendRow) => row[unitPeriodFields.value.plan]
const hasTrendData = computed(() => trendRows.value.some(row => trendActual(row) != null))
const chartScale = computed(() => {
  const source = unitCode.value ? trendRows.value : selectedRows.value
  const largest = Math.max(0, ...source.flatMap(row => [row[unitPeriodFields.value.actual] ?? 0, row[unitPeriodFields.value.plan] ?? 0]))
  return largest >= 1_000_000_000 ? { divisor: 1_000_000_000, label: 'tỷ đồng' } : { divisor: 1_000_000, label: 'triệu đồng' }
})
const chartMoney = (value: number | null) => value == null ? '—' : `${nf.format(value / chartScale.value.divisor)} ${chartScale.value.label}`
function unitRankStyle(row: KpiV2Row): 'top' | 'bottom' | 'good' | 'warning' | 'neutral' {
  const position = rankedUnitCodes.value.indexOf(row.unitCode)
  if (position >= 0 && position < 3) return 'top'
  if (rankedUnitCodes.value.length > 3 && position >= rankedUnitCodes.value.length - 3) return 'bottom'
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
  const monthlyChange = sum(source, 'monthlyChange')
  const remainingAnnual = sum(source, 'remainingAnnual')
  return { monthlyRevenue, monthlyPlan, cumulativeRevenue, cumulativePlan, annualPlan, monthlyChange, remainingAnnual,
    monthlyRate: rate(monthlyRevenue, monthlyPlan),
    cumulativeRate: rate(cumulativeRevenue, cumulativePlan),
    annualRate: rate(cumulativeRevenue, annualPlan) }
})
const provinceShares = computed(() => kpis.value.flatMap(kpi => {
  const value = provinceRows.value.find(row => row.kpi === kpi.code)?.monthlyRevenue
  return value == null ? [] : [{ ...kpi, value }]
}).sort((a, b) => b.value - a.value))
const sharePercent = (value: number) => percent(provinceTotal.value.monthlyRevenue && provinceTotal.value.monthlyRevenue > 0
  ? value / provinceTotal.value.monthlyRevenue * 100 : null)
const unitDetailRows = computed(() => kpis.value.map(kpi => ({
  ...kpi,
  row: visibleUnitRows.value.find(row => row.kpi === kpi.code),
})))
const unitDetailTotal = computed(() => {
  const source = visibleUnitRows.value
  const monthlyRevenue = sum(source, 'monthlyRevenue')
  const monthlyPlan = sum(source, 'monthlyPlan')
  const cumulativeRevenue = sum(source, 'cumulativeRevenue')
  const cumulativePlan = sum(source, 'cumulativePlan')
  const annualPlan = sum(source, 'annualPlan')
  const monthlyChange = sum(source, 'monthlyChange')
  const remainingAnnual = sum(source, 'remainingAnnual')
  return { monthlyRevenue, monthlyPlan, cumulativeRevenue, cumulativePlan, annualPlan, monthlyChange, remainingAnnual,
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
  tooltip: { ...chartTooltipStyle.value, trigger: 'item', formatter: ({ name, value, percent: share }: { name: string; value: number; percent: number }) => `${name}<br/>${money(value)} triệu đồng · ${nf.format(share)}%` },
  legend: { show: false },
  series: [{ type: 'pie', radius: ['53%', '78%'], center: ['50%', '50%'],
    itemStyle: { borderRadius: 5, borderWidth: 3, borderColor: theme.global.current.value.dark ? '#1a2937' : '#fff' },
    label: { show: false },
    data: provinceShares.value.map(item => ({ name: item.label, value: item.value, itemStyle: { color: item.color } })),
  }],
}, theme.global.current.value.dark))

const subscriberChartOption = computed(() => adaptChartOptionForTheme({
  tooltip: { ...chartTooltipStyle.value, trigger: 'axis', axisPointer: chartAxisPointer.value },
  legend: { top: 2, selectedMode: false },
  grid: { left: 105, right: 65, top: 42, bottom: 25 },
  xAxis: { type: 'value', min: 0, axisLabel: { formatter: (value: number) => whole.format(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  yAxis: { type: 'category', inverse: true, data: subscriberServices.value, axisTick: { show: false } },
  series: subscriberIndicators.value.map((indicator, index) => ({
    name: subscriberIndicatorLabel(indicator), type: 'bar', barMaxWidth: 24,
    itemStyle: { color: ['#087fbd', '#ee9b32', '#8b61cf', '#16a6a0'][index % 4], borderRadius: [0, 4, 4, 0] },
    label: { show: true, position: 'right', formatter: ({ value }: { value: number | null }) => value == null ? '' : whole.format(value) },
    data: subscriberServices.value.map(service => subscriberChartRows.value.find(row => row.service === service && row.indicator === indicator)?.currentCount ?? null),
  })),
}, theme.global.current.value.dark))

const subscriberUnitCompareOption = computed(() => adaptChartOptionForTheme({
  tooltip: { ...chartTooltipStyle.value, trigger: 'axis', axisPointer: chartAxisPointer.value, formatter: (items: Array<{ dataIndex: number }>) => {
    const row = selectedSubscriberUnitRows.value[items[0]?.dataIndex ?? -1]
    return row ? `${row.unitName}<br/>Tháng ${subscriberPreviousPeriod.value}: ${row.previousCount == null ? '—' : whole.format(row.previousCount)}<br/>Tháng ${subscriberCurrentPeriod.value}: ${row.currentCount == null ? '—' : whole.format(row.currentCount)}<br/>Tăng giảm: ${signedCount(row.change)} (${signedPercent(row)})` : ''
  } },
  grid: { left: 94, right: 72, top: 0, bottom: 0 },
  xAxis: { type: 'value', axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  yAxis: { type: 'category', inverse: true, data: selectedSubscriberUnitRows.value.map(row => row.unitName.replace(/^Trung tâm Viễn thông\s*/i, '')), axisTick: { show: false }, axisLabel: { width: 88, overflow: 'truncate' } },
  series: [{ type: 'bar', barMaxWidth: 22, cursor: 'pointer',
    label: { show: true, formatter: ({ value }: { value: number | null }) => value == null ? '' : signedCount(value) },
    data: selectedSubscriberUnitRows.value.map(row => ({ value: row.change, label: { position: row.change != null && row.change < 0 ? 'left' : 'right' }, itemStyle: { color: subscriberChangeColor(row) ?? '#8193a3', borderRadius: row.change != null && row.change < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0] } })),
    markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#8193a3', width: 1.5 }, data: [{ xAxis: 0 }] },
  }],
}, theme.global.current.value.dark))

const subscriberUnitDetailOption = computed(() => {
  const row = selectedSubscriberUnitDetailRow.value
  return adaptChartOptionForTheme({
    tooltip: { ...chartTooltipStyle.value, trigger: 'axis', axisPointer: chartAxisPointer.value },
    grid: { left: 42, right: 24, top: 20, bottom: 34 },
    xAxis: { type: 'category', data: [subscriberPreviousPeriod.value, subscriberCurrentPeriod.value], axisTick: { show: false } },
    yAxis: { type: 'value', min: 0, axisLabel: { formatter: (value: number) => whole.format(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
    series: [{ type: 'bar', barMaxWidth: 70, cursor: 'pointer', data: [
      { value: row?.previousCount ?? null, itemStyle: { color: '#8ca3b7', borderRadius: [5, 5, 0, 0] } },
      { value: row?.currentCount ?? null, itemStyle: { color: subscriberChangeColor(row) ?? '#087fbd', borderRadius: [5, 5, 0, 0] } },
    ], label: { show: true, position: 'top', formatter: ({ value }: { value: number | null }) => value == null ? '' : whole.format(value) } }],
  }, theme.global.current.value.dark)
})

function selectSubscriberUnitFromChart(event: { dataIndex?: number }) {
  const row = selectedSubscriberUnitRows.value[event.dataIndex ?? -1]
  if (row) unitCode.value = unitCode.value === row.unitCode ? null : row.unitCode
}

const annualProgressOption = computed(() => {
  const source = kpis.value.map(kpi => ({ ...kpi, row: provinceRows.value.find(row => row.kpi === kpi.code) }))
  return adaptChartOptionForTheme({
    tooltip: { ...chartTooltipStyle.value, trigger: 'axis', axisPointer: chartAxisPointer.value, formatter: (items: Array<{ dataIndex: number }>) => {
      const item = source[items[0]?.dataIndex ?? -1]
      return item ? `${item.title}<br/>TH lũy kế: ${billions(item.row?.cumulativeRevenue)}<br/>KH năm: ${billions(item.row?.annualPlan)}<br/>Hoàn thành: ${percent(rate(item.row?.cumulativeRevenue ?? null, item.row?.annualPlan ?? null))}<br/>So với KH năm: ${annualGapWithUnit(item.row?.remainingAnnual)}` : ''
    } },
    grid: { left: 150, right: 105, top: 38, bottom: 43 },
    xAxis: { type: 'value', min: 0, max: (range: { max: number }) => Math.max(110, Math.ceil(range.max / 10) * 10), axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#e8eef3' } } },
    yAxis: { type: 'category', inverse: true, data: source.map(item => item.label), axisTick: { show: false }, axisLabel: { width: 136, overflow: 'truncate' } },
    series: [
      { type: 'bar', barWidth: 30, silent: true, z: 1, tooltip: { show: false },
        itemStyle: { color: theme.global.current.value.dark ? 'rgba(199,220,235,.16)' : '#e8eef3', borderRadius: [0, 5, 5, 0] },
        data: source.map(item => item.row?.annualPlan != null && item.row.annualPlan > 0 ? 100 : null),
      },
      { type: 'bar', barWidth: 30, barGap: '-100%', z: 2, data: source.map(item => {
        const value = rate(item.row?.cumulativeRevenue ?? null, item.row?.annualPlan ?? null)
        return { value, itemStyle: { color: rateColor(value), borderRadius: [0, 5, 5, 0] } }
      }), label: { show: true, position: 'right', formatter: ({ value }: { value: number | null }) => percent(value) },
      markLine: { silent: true, symbol: 'none',
        label: { show: true, position: 'end', formatter: '', color: theme.global.current.value.dark ? '#9fc8df' : '#527c98', fontSize: 11, fontWeight: 600, distance: 5 },
        lineStyle: { color: theme.global.current.value.dark ? '#7294aa' : '#8eaabc', type: 'solid', width: 1.5 },
        data: [{ xAxis: 100 }],
      },
      },
    ],
  }, theme.global.current.value.dark)
})

const unitChartOption = computed(() => {
  const source = selectedRows.value
  return adaptChartOptionForTheme({
    tooltip: { ...chartTooltipStyle.value, trigger: 'axis', axisPointer: chartAxisPointer.value, formatter: (items: Array<{ dataIndex: number }>) => {
      const row = source[items[0]?.dataIndex ?? -1]
      return row ? `${row.unitName}<br/>${unitPeriodFields.value.planLabel}: ${chartMoney(unitPlan(row))}<br/>${unitPeriodFields.value.label}: ${chartMoney(unitActual(row))}<br/>Hoàn thành: ${percent(rate(unitActual(row), unitPlan(row)))}${unitRank(row) != null ? `<br/>Xếp hạng: ${whole.format(unitRank(row)!)}` : ''}${unitPeriod.value === 'monthly' ? `<br/>So tháng trước: ${changeTooltip(row.monthlyChange)} triệu đồng` : ''}${unitPeriod.value === 'annual' ? `<br/>So với KH năm: ${annualGapWithUnit(row.remainingAnnual)}` : ''}` : ''
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
        return `{unit|${value.replace(/[{}|]/g, '')}}\n{${status}|${percent(completion)}}${row && unitRank(row) != null ? `\n{${rankStatus}|Hạng ${whole.format(unitRank(row)!)}}` : ''}`
      } },
    },
    yAxis: { type: 'value', name: chartScale.value.label, axisLabel: { formatter: (value: number) => nf.format(value / chartScale.value.divisor) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
    series: [
      { name: 'Thực hiện', type: 'bar', barMaxWidth: 42, data: source.map(row => {
        return { value: unitActual(row), itemStyle: { color: unitRankColor(row), borderRadius: [4, 4, 0, 0] } }
      }) },
      { name: 'Kế hoạch', type: 'line', symbol: 'circle', symbolSize: 8, smooth: false, lineStyle: { width: 2, color: planColor }, itemStyle: { color: planColor }, data: source.map(row => unitPlan(row)) },
    ],
  }, theme.global.current.value.dark)
})

const unitTrendOption = computed(() => {
  const source = trendRows.value
  return adaptChartOptionForTheme({
    tooltip: { ...chartTooltipStyle.value, trigger: 'axis', axisPointer: chartAxisPointer.value, formatter: (items: Array<{ dataIndex: number }>) => {
      const row = source[items[0]?.dataIndex ?? -1]
      return row ? `Tháng ${Number(row.month.slice(5))}/${row.month.slice(0, 4)}<br/>${unitPeriodFields.value.label}: ${chartMoney(trendActual(row))}<br/>${unitPeriodFields.value.planLabel}: ${chartMoney(trendPlan(row))}<br/>Hoàn thành: ${percent(rate(trendActual(row), trendPlan(row)))}${unitPeriod.value === 'monthly' ? `<br/>So tháng trước: ${changeTooltip(row.monthlyChange)} triệu đồng` : ''}${unitPeriod.value === 'annual' ? `<br/>So với KH năm: ${annualGapWithUnit(row.remainingAnnual)}` : ''}` : ''
    } },
    grid: { left: 66, right: 35, top: 30, bottom: 65 },
    xAxis: { type: 'category', data: source.map(row => `Tháng ${Number(row.month.slice(5))}`), axisTick: { alignWithLabel: true }, axisLabel: { interval: 0, fontWeight: 600 } },
    yAxis: { type: 'value', name: chartScale.value.label, axisLabel: { formatter: (value: number) => nf.format(value / chartScale.value.divisor) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
    series: [
      { name: unitPeriodFields.value.label, type: 'bar', barMaxWidth: 48, data: source.map(row => {
        const completion = rate(trendActual(row), trendPlan(row))
        return { value: trendActual(row), itemStyle: { color: completion == null ? noPlanColor : completion >= 100 ? achievedColor : unmetColor, borderRadius: [5, 5, 0, 0] } }
      }) },
      { name: unitPeriodFields.value.planLabel, type: 'line', symbol: 'circle', symbolSize: 8, lineStyle: { width: 2, color: planColor }, itemStyle: { color: planColor }, data: source.map(row => trendPlan(row)) },
    ],
  }, theme.global.current.value.dark)
})

function selectChartUnit(event: { dataIndex?: number }) {
  const item = selectedRows.value[event.dataIndex ?? -1]
  if (item) unitCode.value = unitCode.value === item.unitCode ? null : item.unitCode
}

function selectKpiFromTable(code: KpiV2Code) {
  selectedKpi.value = code
}

watch([scope, unitCode, selectedKpi, month, reportGroup, ptmUnitScope, trendRefresh], async () => {
  const version = ++trendVersion
  trendRows.value = []
  trendError.value = ''
  if (scope.value !== 'unit' || !unitCode.value || !selectedKpi.value || !month.value) {
    trendLoading.value = false
    return
  }
  trendLoading.value = true
  try {
    const result = await kpiApi.v2UnitTrend(month.value, selectedKpi.value, unitCode.value, reportGroup.value, ptmUnitScope.value)
    if (version === trendVersion) trendRows.value = result.rows
  } catch (cause) {
    if (version === trendVersion) trendError.value = getAuthErrorMessage(cause)
  } finally {
    if (version === trendVersion) trendLoading.value = false
  }
})

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
  subscriberRows.value = []
  loaded.value = false
  loading.value = false
  subscriberLoading.value = false
  error.value = ''
  subscriberError.value = ''
  unitCode.value = null
}

async function load() {
  if (!month.value) return
  const version = ++loadVersion
  const queryMonth = month.value
  const queryGroup = reportGroup.value
  const queryUnitScope = ptmUnitScope.value
  loading.value = true
  subscriberLoading.value = queryGroup === 'actual'
  error.value = ''
  subscriberError.value = ''
  try {
    const [revenueResult, subscriberResult] = await Promise.allSettled([
      kpiApi.v2Report(queryMonth, queryGroup, queryUnitScope),
      queryGroup === 'actual' ? kpiApi.v2SubscriberReport(queryMonth) : Promise.resolve({ rows: [] as KpiV2SubscriberRow[] }),
    ])
    if (version !== loadVersion) return
    if (revenueResult.status === 'fulfilled') {
      rows.value = revenueResult.value.rows
      if (unitCode.value && !rows.value.some(row => row.unitCode === unitCode.value)) unitCode.value = null
      else if (unitCode.value) trendRefresh.value += 1
    } else {
      error.value = getAuthErrorMessage(revenueResult.reason)
      rows.value = []
    }
    if (subscriberResult.status === 'fulfilled') subscriberRows.value = subscriberResult.value.rows
    else {
      subscriberError.value = getAuthErrorMessage(subscriberResult.reason)
      subscriberRows.value = []
    }
    loaded.value = true
  } finally {
    if (version === loadVersion) {
      loading.value = false
      subscriberLoading.value = false
    }
  }
}

function changePtmUnitScope(value: PtmUnitScope) {
  if (ptmUnitScope.value === value) return
  ptmUnitScope.value = value
  unitCode.value = null
  rows.value = []
  loaded.value = false
  void load()
}

async function changeReportGroup(next: KpiV2Group) {
  if (next === reportGroup.value) return
  const version = ++loadVersion
  reportGroup.value = next
  selectedKpi.value = ''
  unitCode.value = null
  rows.value = []
  subscriberRows.value = []
  months.value = []
  loaded.value = false
  loading.value = true
  subscriberLoading.value = false
  error.value = ''
  subscriberError.value = ''
  monthMenuOpen.value = false
  try {
    const availableMonths = await kpiApi.v2Months(next)
    if (version !== loadVersion) return
    months.value = availableMonths
    const currentMonth = month.value.replace('-', '')
    if (!availableMonths.includes(currentMonth)) {
      month.value = availableMonths[0] ? `${availableMonths[0].slice(0, 4)}-${availableMonths[0].slice(4)}` : ''
    }
    if (month.value) await load()
    else loaded.value = true
  } catch (cause) {
    if (version === loadVersion) error.value = getAuthErrorMessage(cause)
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

onMounted(async () => {
  const version = loadVersion
  loading.value = true
  try {
    const availableMonths = await kpiApi.v2Months(reportGroup.value)
    if (version !== loadVersion) return
    months.value = availableMonths
    month.value = months.value[0] ? `${months.value[0].slice(0, 4)}-${months.value[0].slice(4)}` : ''
    if (month.value) await load()
    else loaded.value = true
  } catch (cause) {
    if (version === loadVersion) error.value = getAuthErrorMessage(cause)
  } finally {
    if (version === loadVersion) loading.value = false
  }
})
</script>

<template>
  <v-container class="giao-ban-v2" fluid>
    <v-card class="report-shell" elevation="0">
      <header class="report-heading"><v-icon icon="mdi-chart-bar" size="26" /><h1>DỮ LIỆU GIAO BAN</h1></header>
      <v-tabs :model-value="reportGroup" class="report-group-tabs" color="primary" @update:model-value="changeReportGroup">
        <v-tab value="actual">Doanh thu thực hiện</v-tab>
        <v-tab value="maintenance">Doanh thu duy trì</v-tab>
        <v-tab value="ptm">Doanh thu PTM</v-tab>
      </v-tabs>
      <div class="filters">
        <v-menu v-model="monthMenuOpen" :close-on-content-click="false">
          <template #activator="{ props: activatorProps }"><v-text-field v-bind="activatorProps" :model-value="pickerLabel" label="Tháng báo cáo" prepend-inner-icon="mdi-calendar-month-outline" variant="outlined" density="compact" hide-details readonly :disabled="!months.length" /></template>
          <v-date-picker :month="pickerMonth" :year="pickerYear" v-model:view-mode="pickerViewMode" hide-header color="primary" @update:month="selectMonth" @update:year="pickerYear = $event" />
        </v-menu>
        <v-select v-model="scope" :items="[{ title: '1. Báo cáo Viễn thông tỉnh', value: 'province' }, { title: '2. Báo cáo địa bàn cấp 2', value: 'unit' }]" label="Địa bàn cấp" variant="outlined" density="compact" hide-details @update:model-value="unitCode = null" />
        <v-autocomplete v-if="scope === 'unit'" v-model="unitCode" :items="unitOptions" label="Địa bàn" placeholder="Toàn tỉnh" variant="outlined" density="compact" clearable hide-details />
        <v-text-field v-else model-value="Toàn tỉnh" label="Địa bàn" variant="outlined" density="compact" hide-details readonly />
        <v-select v-if="reportGroup === 'ptm'" :model-value="ptmUnitScope" :items="[{ title: 'Cả địa bàn (TTVT + VNPT)', value: 'area' }, { title: 'TTVT', value: 'ttvt' }, { title: 'VNPT', value: 'vnpt' }]" label="Nhóm đơn vị" variant="outlined" density="compact" hide-details @update:model-value="changePtmUnitScope" />
        <v-btn color="primary" prepend-icon="mdi-database-search-outline" :loading="loading" :disabled="!month" @click="load">Lấy số liệu</v-btn>
        <v-btn color="primary" variant="tonal" prepend-icon="mdi-map-marker-radius-outline" :disabled="!loaded || !unitRows.length || !!error" @click="mapDialogOpen = true">Bản đồ địa bàn</v-btn>
      </div>
      <v-alert v-if="error" class="mx-5 mb-4" type="error" variant="tonal">{{ error }}</v-alert>
      <v-alert v-if="loaded && !rows.length && !error" class="mx-5 mb-4" type="info" variant="tonal">Chưa có dữ liệu {{ reportGroupLabel }} cho {{ monthLabel || 'tháng đã chọn' }}.</v-alert>
      <template v-if="loaded && rows.length && !error">
        <v-alert v-if="missingProvinceKpis.length" class="mx-5 mb-4" type="warning" variant="tonal" density="compact">API chưa trả dữ liệu {{ missingProvinceKpis.map(kpi => kpi.label).join(', ') }} cho {{ monthLabel }}. Các biểu đồ và dòng tổng chỉ tính trên KPI đã nhận được.</v-alert>
        <template v-if="scope === 'province'">
          <div class="province-charts">
            <v-card class="chart-card share-card" elevation="0">
              <h2>Tỷ trọng {{ reportGroupLabel }} {{ monthLabel }}</h2>
              <div class="pie-visual"><VChart class="pie-chart" :option="shareOption" autoresize /><div class="pie-center"><span>Tổng {{ reportGroupLabel }}</span><strong>{{ billions(provinceTotal.monthlyRevenue) }}</strong></div></div>
              <div class="share-list" aria-label="Cơ cấu doanh thu theo dịch vụ">
                <div v-for="item in provinceShares" :key="item.code" class="share-entry">
                  <i class="share-swatch" :style="{ backgroundColor: item.color }" />
                  <span class="share-name">{{ item.label }}<small>{{ money(item.value) }} triệu đồng</small></span>
                  <strong class="share-percent">{{ sharePercent(item.value) }}</strong>
                </div>
              </div>
            </v-card>
            <v-card class="chart-card" elevation="0"><h2>Tiến độ {{ reportGroupLabel }} năm {{ month.slice(0, 4) }}</h2><p>Thực hiện lũy kế so với kế hoạch năm · {{ kpis.length }} chỉ tiêu</p><VChart v-if="provinceRows.some(row => row.annualPlan != null && row.annualPlan > 0)" class="progress-chart" :style="{ height: `${Math.max(305, kpis.length * 55 + 90)}px` }" :option="annualProgressOption" autoresize /><v-alert v-else class="mt-8" type="info" variant="tonal" density="compact">Chưa có kế hoạch năm cho nhóm chỉ tiêu này.</v-alert></v-card>
          </div>
          <section class="report-section">
            <div class="section-heading"><h2>1. BÁO CÁO {{ reportGroupLabel.toLocaleUpperCase('vi-VN') }} TOÀN TỈNH</h2><small>{{ monthLabel }} · đơn vị: triệu đồng</small></div>
            <v-table class="report-table province-table" density="compact">
              <colgroup><col style="width:50px" /><col style="width:110px" /><col style="width:280px" /><col v-for="n in 10" :key="n" style="width:132px" /></colgroup>
              <thead>
                <tr><th rowspan="2">STT</th><th rowspan="2">Mã KPI</th><th rowspan="2">Tên KPI</th><th colspan="4">Trong tháng</th><th colspan="3">Lũy kế đến tháng báo cáo</th><th colspan="3">Kế hoạch năm</th></tr>
                <tr><th>Kế hoạch</th><th>Thực hiện</th><th>± tháng trước</th><th>Hoàn thành</th><th>Kế hoạch</th><th>Thực hiện</th><th>Hoàn thành</th><th>Kế hoạch</th><th>Còn / vượt</th><th>Hoàn thành</th></tr>
              </thead><tbody>
              <tr v-for="(kpi, index) in kpis" :key="kpi.code"><td>{{ index + 1 }}</td><td>{{ kpi.code }}</td><td>{{ kpi.title }}</td><template v-if="provinceRows.find(row => row.kpi === kpi.code)"><template v-for="row in provinceRows.filter(item => item.kpi === kpi.code)" :key="row.kpi"><td>{{ money(row.monthlyPlan) }}</td><td>{{ money(row.monthlyRevenue) }}</td><td :style="{ color: changeColor(row.monthlyChange) }"><span class="change-value"><v-icon v-if="changeIcon(row.monthlyChange)" :icon="changeIcon(row.monthlyChange)" size="15" />{{ signedMoney(row.monthlyChange) }}</span></td><td :style="{ color: rateColor(rate(row.monthlyRevenue, row.monthlyPlan)) }">{{ percent(rate(row.monthlyRevenue, row.monthlyPlan)) }}</td><td>{{ money(row.cumulativePlan) }}</td><td>{{ money(row.cumulativeRevenue) }}</td><td :style="{ color: rateColor(rate(row.cumulativeRevenue, row.cumulativePlan)) }">{{ percent(rate(row.cumulativeRevenue, row.cumulativePlan)) }}</td><td>{{ money(row.annualPlan) }}</td><td :style="{ color: annualGapColor(row.remainingAnnual) }">{{ annualGap(row.remainingAnnual) }}</td><td :style="{ color: rateColor(rate(row.cumulativeRevenue, row.annualPlan)) }">{{ percent(rate(row.cumulativeRevenue, row.annualPlan)) }}</td></template></template><template v-else><td v-for="n in 10" :key="n">—</td></template></tr>
              <tr class="total-row"><td colspan="3">Tổng</td><td>{{ money(provinceTotal.monthlyPlan) }}</td><td>{{ money(provinceTotal.monthlyRevenue) }}</td><td :style="{ color: changeColor(provinceTotal.monthlyChange) }"><span class="change-value"><v-icon v-if="changeIcon(provinceTotal.monthlyChange)" :icon="changeIcon(provinceTotal.monthlyChange)" size="15" />{{ signedMoney(provinceTotal.monthlyChange) }}</span></td><td>{{ percent(provinceTotal.monthlyRate) }}</td><td>{{ money(provinceTotal.cumulativePlan) }}</td><td>{{ money(provinceTotal.cumulativeRevenue) }}</td><td>{{ percent(provinceTotal.cumulativeRate) }}</td><td>{{ money(provinceTotal.annualPlan) }}</td><td :style="{ color: annualGapColor(provinceTotal.remainingAnnual) }">{{ annualGap(provinceTotal.remainingAnnual) }}</td><td>{{ percent(provinceTotal.annualRate) }}</td></tr>
            </tbody></v-table>
          </section>
          <section v-if="reportGroup === 'actual'" class="report-section subscriber-section">
            <div class="section-heading"><h2>2. BÁO CÁO SẢN LƯỢNG THUÊ BAO TOÀN TỈNH</h2><small>{{ monthLabel }} · đơn vị: thuê bao</small></div>
            <v-progress-linear v-if="subscriberLoading" indeterminate color="primary" />
            <v-alert v-else-if="subscriberError" type="error" variant="tonal" density="compact">{{ subscriberError }}</v-alert>
            <v-alert v-else-if="!provinceSubscriberRows.length" type="info" variant="tonal" density="compact">Chưa có số liệu sản lượng thuê bao toàn tỉnh cho {{ monthLabel }}.</v-alert>
            <template v-else>
              <div class="subscriber-layout">
                <v-card class="subscriber-chart-card" elevation="0"><h3>PTM và Hủy theo dịch vụ</h3><p>Số thuê bao tháng {{ subscriberCurrentPeriod }}</p><VChart class="subscriber-chart" :style="{ height: `${Math.max(230, subscriberServices.length * 42 + 65)}px` }" :option="subscriberChartOption" autoresize /></v-card>
                <v-table class="report-table subscriber-table" density="compact">
                  <thead><tr><th rowspan="2">Dịch vụ</th><th v-for="indicator in subscriberIndicators" :key="indicator" colspan="3">{{ subscriberIndicatorLabel(indicator) }}</th></tr><tr><template v-for="indicator in subscriberIndicators" :key="indicator"><th>{{ subscriberPreviousPeriod }}</th><th>{{ subscriberCurrentPeriod }}</th><th>± / %</th></template></tr></thead>
                  <tbody><tr v-for="group in subscriberMatrix" :key="group.service"><td>{{ group.service }}</td><template v-for="entry in group.entries" :key="entry.indicator"><td>{{ entry.row?.previousCount == null ? '—' : whole.format(entry.row.previousCount) }}</td><td>{{ entry.row?.currentCount == null ? '—' : whole.format(entry.row.currentCount) }}</td><td :style="{ color: subscriberChangeColor(entry.row) }"><strong>{{ signedCount(entry.row?.change ?? null) }}</strong><small>{{ entry.row ? signedPercent(entry.row) : '—' }}</small></td></template></tr></tbody>
                </v-table>
              </div>
            </template>
          </section>
        </template>
        <template v-else>
          <div class="unit-controls">
            <v-select v-model="selectedKpi" :items="kpis.map(kpi => ({ title: `${kpi.code} - ${kpi.title}`, value: kpi.code }))" label="Chọn chỉ tiêu KPI" variant="outlined" density="comfortable" hide-details />
            <div class="unit-period"><span>Kỳ so sánh</span><v-btn-toggle v-model="unitPeriod" class="unit-period-toggle" mandatory color="primary" density="comfortable" variant="text"><v-btn value="monthly">Trong tháng</v-btn><v-btn value="cumulative">Lũy kế</v-btn><v-btn value="annual">Kế hoạch năm</v-btn></v-btn-toggle></div>
          </div>
          <v-card id="v2-unit-chart" class="unit-chart-card" elevation="0">
            <div class="unit-chart-heading"><h2>{{ unitCode ? `Diễn biến ${reportGroupLabel}` : 'Tỷ lệ hoàn thành' }}: {{ kpis.find(kpi => kpi.code === selectedKpi)?.title }}</h2></div>
            <p v-if="unitCode">{{ selectedUnitName }} · tháng 1–{{ Number(month.slice(5)) }}/{{ month.slice(0, 4) }} · {{ unitPeriodFields.label }} so với {{ unitPeriodFields.planLabel.toLowerCase() }}</p>
            <p v-else>{{ monthLabel }} · {{ unitPeriodFields.label }} so với {{ unitPeriodFields.planLabel.toLowerCase() }} · {{ selectedRows.length }}/{{ unitOptions.length }} địa bàn có số liệu</p>
            <template v-if="unitCode">
              <v-progress-linear v-if="trendLoading" class="mt-5" indeterminate color="primary" />
              <v-alert v-else-if="trendError" class="ma-4" type="error" variant="tonal">{{ trendError }}</v-alert>
              <template v-else-if="hasTrendData">
                <div class="unit-legend" aria-label="Chú thích biểu đồ"><span><i class="legend-bar" :style="{ backgroundColor: achievedColor }" />Đạt kế hoạch</span><span><i class="legend-bar" :style="{ backgroundColor: unmetColor }" />Chưa đạt kế hoạch</span><span><i class="legend-bar" :style="{ backgroundColor: noPlanColor }" />Chưa có kế hoạch</span><span><i class="legend-line" :style="{ borderColor: planColor, color: planColor }" />{{ unitPeriodFields.planLabel }}</span></div>
                <div class="unit-chart-scroll"><VChart class="unit-chart" :style="{ minWidth: `${Math.max(880, trendRows.length * 90)}px` }" :option="unitTrendOption" autoresize /></div>
              </template>
              <v-alert v-else class="ma-4" type="info" variant="tonal">Chưa có số liệu {{ kpis.find(kpi => kpi.code === selectedKpi)?.label }} của {{ selectedUnitName }} từ tháng 1 đến {{ monthLabel }}.</v-alert>
            </template>
            <template v-else-if="selectedRows.length">
              <div class="unit-legend" aria-label="Chú thích biểu đồ"><span><i class="legend-bar" :style="{ backgroundColor: topColor }" />Top 3</span><span><i class="legend-bar" :style="{ backgroundColor: achievedColor }" />Đạt kế hoạch</span><span><i class="legend-bar" :style="{ backgroundColor: middleColor }" />Chưa đạt kế hoạch</span><span><i class="legend-bar" :style="{ backgroundColor: unmetColor }" />3 hạng cuối</span><span><i class="legend-bar" :style="{ backgroundColor: noPlanColor }" />Chưa có kế hoạch</span><span><i class="legend-line" :style="{ borderColor: planColor, color: planColor }" />{{ unitPeriodFields.planLabel }}</span></div>
              <div class="unit-chart-scroll"><VChart class="unit-chart" :style="{ minWidth: `${Math.max(880, selectedRows.length * 105)}px` }" :option="unitChartOption" autoresize @click="selectChartUnit" /></div>
            </template>
            <v-alert v-else class="ma-4" type="info" variant="tonal">API chưa trả dữ liệu {{ kpis.find(kpi => kpi.code === selectedKpi)?.label }} cho địa bàn đã chọn.</v-alert>
          </v-card>
          <section class="report-section"><div class="section-heading"><h2>1. BÁO CÁO {{ reportGroupLabel.toLocaleUpperCase('vi-VN') }} ĐỊA BÀN CẤP 2</h2><small>{{ monthLabel }} · {{ unitCode ? selectedUnitName : `${unitPeriodFields.label} / ${unitPeriodFields.planLabel}` }} · triệu đồng</small></div>
            <v-table v-if="unitCode" class="report-table unit-detail-table" density="compact">
              <colgroup><col style="width:50px" /><col style="width:115px" /><col style="width:220px" /><col v-for="n in 11" :key="n" style="width:120px" /></colgroup>
              <thead>
                <tr><th rowspan="2">STT</th><th rowspan="2">Mã KPI</th><th rowspan="2">Tên KPI</th><th colspan="4">Trong tháng</th><th colspan="3">Lũy kế đến tháng báo cáo</th><th colspan="4">So với kế hoạch năm</th></tr>
                <tr><th>KH tháng</th><th>TH tháng</th><th>Hoàn thành</th><th>± tháng trước</th><th>KH lũy kế</th><th>TH lũy kế</th><th>Hoàn thành</th><th>KH năm</th><th>TH lũy kế</th><th>Hoàn thành</th><th>Còn / vượt KH năm</th></tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in unitDetailRows" :key="item.code" class="kpi-selectable-row" :class="{ 'selected-kpi-row': item.code === selectedKpi }" tabindex="0" :aria-selected="item.code === selectedKpi" :aria-label="`Xem biểu đồ ${item.title}`" @click="selectKpiFromTable(item.code)" @keydown.enter.prevent="selectKpiFromTable(item.code)" @keydown.space.prevent="selectKpiFromTable(item.code)">
                  <td>{{ index + 1 }}</td><td>{{ item.code }}</td><td>{{ item.title }}</td>
                  <td>{{ money(item.row?.monthlyPlan) }}</td><td>{{ money(item.row?.monthlyRevenue) }}</td>
                  <td :style="{ color: rateColor(rate(item.row?.monthlyRevenue ?? null, item.row?.monthlyPlan ?? null)) }">{{ percent(rate(item.row?.monthlyRevenue ?? null, item.row?.monthlyPlan ?? null)) }}</td>
                  <td :style="{ color: changeColor(item.row?.monthlyChange) }"><span class="change-value"><v-icon v-if="changeIcon(item.row?.monthlyChange)" :icon="changeIcon(item.row?.monthlyChange)" size="15" />{{ signedMoney(item.row?.monthlyChange) }}</span></td>
                  <td>{{ money(item.row?.cumulativePlan) }}</td><td>{{ money(item.row?.cumulativeRevenue) }}</td>
                  <td :style="{ color: rateColor(rate(item.row?.cumulativeRevenue ?? null, item.row?.cumulativePlan ?? null)) }">{{ percent(rate(item.row?.cumulativeRevenue ?? null, item.row?.cumulativePlan ?? null)) }}</td>
                  <td>{{ money(item.row?.annualPlan) }}</td><td>{{ money(item.row?.cumulativeRevenue) }}</td>
                  <td :style="{ color: rateColor(rate(item.row?.cumulativeRevenue ?? null, item.row?.annualPlan ?? null)) }">{{ percent(rate(item.row?.cumulativeRevenue ?? null, item.row?.annualPlan ?? null)) }}</td>
                  <td :style="{ color: annualGapColor(item.row?.remainingAnnual) }">{{ annualGap(item.row?.remainingAnnual) }}</td>
                </tr>
                <tr class="total-row"><td colspan="3">Tổng</td><td>{{ money(unitDetailTotal.monthlyPlan) }}</td><td>{{ money(unitDetailTotal.monthlyRevenue) }}</td><td>{{ percent(unitDetailTotal.monthlyRate) }}</td><td :style="{ color: changeColor(unitDetailTotal.monthlyChange) }"><span class="change-value"><v-icon v-if="changeIcon(unitDetailTotal.monthlyChange)" :icon="changeIcon(unitDetailTotal.monthlyChange)" size="15" />{{ signedMoney(unitDetailTotal.monthlyChange) }}</span></td><td>{{ money(unitDetailTotal.cumulativePlan) }}</td><td>{{ money(unitDetailTotal.cumulativeRevenue) }}</td><td>{{ percent(unitDetailTotal.cumulativeRate) }}</td><td>{{ money(unitDetailTotal.annualPlan) }}</td><td>{{ money(unitDetailTotal.cumulativeRevenue) }}</td><td>{{ percent(unitDetailTotal.annualRate) }}</td><td :style="{ color: annualGapColor(unitDetailTotal.remainingAnnual) }">{{ annualGap(unitDetailTotal.remainingAnnual) }}</td></tr>
              </tbody>
            </v-table>
            <v-table v-else class="report-table unit-table" density="compact" :style="{ '--unit-table-width': `${425 + visibleUnits.length * 164}px` }"><colgroup><col style="width:50px" /><col style="width:115px" /><col style="width:260px" /><col v-for="unit in visibleUnits" :key="unit.value" style="width:164px" /></colgroup><thead><tr><th>STT</th><th>Mã KPI</th><th>Tên KPI</th><th v-for="unit in visibleUnits" :key="unit.value">{{ unit.title.replace(/^Trung tâm Viễn thông\s*/i, '') }}<small v-if="unitRankByCode(unit.value) != null" class="unit-rank-label">Hạng {{ unitRankByCode(unit.value) }}</small></th></tr></thead><tbody>
              <tr v-for="(kpi, index) in kpis" :key="kpi.code" class="kpi-selectable-row" :class="{ 'selected-kpi-row': kpi.code === selectedKpi }" tabindex="0" :aria-selected="kpi.code === selectedKpi" :aria-label="`Xem biểu đồ ${kpi.title}`" @click="selectKpiFromTable(kpi.code)" @keydown.enter.prevent="selectKpiFromTable(kpi.code)" @keydown.space.prevent="selectKpiFromTable(kpi.code)"><td>{{ index + 1 }}</td><td>{{ kpi.code }}</td><td>{{ kpi.title }}</td><td v-for="unit in visibleUnits" :key="unit.value"><template v-if="visibleUnitRows.find(row => row.unitCode === unit.value && row.kpi === kpi.code)" v-for="row in visibleUnitRows.filter(item => item.unitCode === unit.value && item.kpi === kpi.code)" :key="row.unitCode"><div class="unit-amount">{{ money(unitActual(row)) }}</div><div class="unit-plan">KH {{ money(unitPlan(row)) }} <span :style="{ color: rateColor(rate(unitActual(row), unitPlan(row))) }">· {{ percent(rate(unitActual(row), unitPlan(row))) }}</span></div><div v-if="unitPeriod === 'monthly'" class="unit-extra" :style="{ color: changeColor(row.monthlyChange) }">So tháng trước <span class="change-value"><v-icon v-if="changeIcon(row.monthlyChange)" :icon="changeIcon(row.monthlyChange)" size="13" />{{ signedMoney(row.monthlyChange) }}</span></div><div v-if="unitPeriod === 'annual'" class="unit-extra" :style="{ color: annualGapColor(row.remainingAnnual) }">{{ annualGap(row.remainingAnnual) }}</div></template><template v-else>—</template></td></tr>
              <tr class="total-row"><td colspan="3">Tổng</td><td v-for="unit in visibleUnits" :key="unit.value"><div class="unit-amount">{{ money(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), unitPeriodFields.actual)) }}</div><div class="unit-plan">KH {{ money(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), unitPeriodFields.plan)) }} · {{ percent(rate(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), unitPeriodFields.actual), sum(visibleUnitRows.filter(row => row.unitCode === unit.value), unitPeriodFields.plan))) }}</div><div v-if="unitPeriod === 'monthly'" class="unit-extra" :style="{ color: changeColor(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), 'monthlyChange')) }">So tháng trước <span class="change-value"><v-icon v-if="changeIcon(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), 'monthlyChange'))" :icon="changeIcon(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), 'monthlyChange'))" size="13" />{{ signedMoney(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), 'monthlyChange')) }}</span></div><div v-if="unitPeriod === 'annual'" class="unit-extra" :style="{ color: annualGapColor(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), 'remainingAnnual')) }">{{ annualGap(sum(visibleUnitRows.filter(row => row.unitCode === unit.value), 'remainingAnnual')) }}</div></td></tr>
            </tbody></v-table>
          </section>
          <section v-if="reportGroup === 'actual'" class="report-section subscriber-section">
            <div class="section-heading"><h2>2. BÁO CÁO SẢN LƯỢNG THUÊ BAO ĐỊA BÀN CẤP 2</h2><div class="subscriber-heading-actions"><small>{{ monthLabel }} · {{ unitCode ? selectedUnitName : 'So sánh các trung tâm' }} · thuê bao</small><v-btn v-if="unitCode" color="primary" variant="tonal" size="small" prepend-icon="mdi-arrow-left" @click="unitCode = null">Xem tất cả trung tâm</v-btn></div></div>
            <v-progress-linear v-if="subscriberLoading" indeterminate color="primary" />
            <v-alert v-else-if="subscriberError" type="error" variant="tonal" density="compact">{{ subscriberError }}</v-alert>
            <v-alert v-else-if="!unitSubscriberRows.length" type="info" variant="tonal" density="compact">Chưa có số liệu sản lượng thuê bao địa bàn cấp 2 cho {{ monthLabel }}.</v-alert>
            <div v-else class="subscriber-compare">
              <div class="subscriber-compare-controls"><strong>{{ selectedSubscriberService ?? 'Chưa có dịch vụ tương ứng' }}</strong><v-btn-toggle v-model="selectedSubscriberIndicator" mandatory color="primary" variant="tonal" density="comfortable" divided><v-btn value="PTM">PTM</v-btn><v-btn value="HUY">Hủy</v-btn></v-btn-toggle></div>
              <v-alert v-if="!selectedSubscriberService" type="info" variant="tonal" density="compact">KPI {{ selectedKpi }} chưa có số liệu sản lượng thuê bao tương ứng.</v-alert>
              <v-alert v-else-if="!selectedSubscriberUnitRows.length" type="info" variant="tonal" density="compact">Chưa có dữ liệu {{ selectedSubscriberService }} · {{ subscriberIndicatorLabel(selectedSubscriberIndicator) }} cho {{ monthLabel }}.</v-alert>
              <v-alert v-else-if="unitCode && !selectedSubscriberUnitDetailRow" type="info" variant="tonal" density="compact">Chưa có dữ liệu {{ selectedSubscriberService }} · {{ subscriberIndicatorLabel(selectedSubscriberIndicator) }} của {{ selectedUnitName }}.</v-alert>
              <div v-else-if="unitCode" class="subscriber-unit-focus">
                <v-card class="subscriber-chart-card" elevation="0"><h3>{{ selectedSubscriberService }} · {{ subscriberIndicatorLabel(selectedSubscriberIndicator) }}</h3><p>{{ selectedUnitName }} · nhấn cột để xem tất cả trung tâm</p><VChart class="subscriber-chart" style="height:260px" :option="subscriberUnitDetailOption" autoresize @click="unitCode = null" /></v-card>
                <v-card class="subscriber-focus-numbers" elevation="0"><h3>{{ selectedUnitName }}</h3><div><span>{{ subscriberPreviousPeriod }}</span><strong>{{ selectedSubscriberUnitDetailRow?.previousCount == null ? '—' : whole.format(selectedSubscriberUnitDetailRow.previousCount) }}</strong></div><div><span>{{ subscriberCurrentPeriod }}</span><strong>{{ selectedSubscriberUnitDetailRow?.currentCount == null ? '—' : whole.format(selectedSubscriberUnitDetailRow.currentCount) }}</strong></div><div><span>Tăng giảm</span><strong :style="{ color: subscriberChangeColor(selectedSubscriberUnitDetailRow) }">{{ signedCount(selectedSubscriberUnitDetailRow?.change ?? null) }} <small>{{ selectedSubscriberUnitDetailRow ? signedPercent(selectedSubscriberUnitDetailRow) : '—' }}</small></strong></div></v-card>
              </div>
              <div v-else class="subscriber-compare-grid">
                <v-card class="subscriber-chart-card subscriber-compare-chart" elevation="0">
                  <div class="subscriber-compare-chart-title"><strong>Tăng giảm {{ selectedSubscriberService }} · {{ subscriberIndicatorLabel(selectedSubscriberIndicator) }}</strong><small>so với tháng {{ subscriberPreviousPeriod }}</small></div>
                  <VChart class="subscriber-chart" :style="{ height: `${selectedSubscriberUnitRows.length * 36}px` }" :option="subscriberUnitCompareOption" autoresize @click="selectSubscriberUnitFromChart" />
                </v-card>
                <v-table class="report-table subscriber-compare-table" density="compact">
                  <thead><tr><th>Trung tâm</th><th>{{ subscriberPreviousPeriod }}</th><th>{{ subscriberCurrentPeriod }}</th><th>Chênh lệch</th><th>Tỷ lệ</th></tr></thead>
                  <tbody><tr v-for="row in selectedSubscriberUnitRows" :key="row.unitCode" tabindex="0" :aria-label="`Xem ${row.unitName}`" @click="unitCode = row.unitCode" @keydown.enter.prevent="unitCode = row.unitCode" @keydown.space.prevent="unitCode = row.unitCode">
                    <td>{{ row.unitName.replace(/^Trung tâm Viễn thông\s*/i, '') }}</td>
                    <td>{{ row.previousCount == null ? '—' : whole.format(row.previousCount) }}</td>
                    <td><strong>{{ row.currentCount == null ? '—' : whole.format(row.currentCount) }}</strong></td>
                    <td :style="{ color: subscriberChangeColor(row) }">{{ signedCount(row.change) }}</td>
                    <td :style="{ color: subscriberChangeColor(row) }">{{ signedPercent(row) }}</td>
                  </tr></tbody>
                </v-table>
              </div>
            </div>
          </section>
        </template>
        <!-- Nguồn TONGHOP_KPI_ALL chưa có dữ liệu so sánh cùng kỳ. -->
      </template>
    </v-card>
    <KpiUnitMapDialog v-model="mapDialogOpen" :rows="unitRows" :group="reportGroup" :unit-scope="ptmUnitScope" :months="months" :month="month" :selected-kpi="selectedKpi" :period="unitPeriod" :initial-unit-code="unitCode" />
  </v-container>
</template>

<style scoped>
.unit-chart-heading{position:relative;min-height:36px;padding:4px 140px}.unit-chart-heading h2{text-align:center}.unit-chart-heading :deep(.v-btn){position:absolute;right:0;top:0}@media(max-width:800px){.unit-chart-heading{padding:4px 0}.unit-chart-heading :deep(.v-btn){position:static;display:flex;margin:10px auto 0}}
.report-group-tabs{padding:0 20px;border-bottom:1px solid rgba(var(--v-border-color),.18);background:color-mix(in srgb,rgb(var(--v-theme-primary)) 2%,rgb(var(--v-theme-surface)));--v-tabs-height:50px}
.report-group-tabs :deep(.v-tab){min-width:0;padding:0 20px;color:rgba(var(--v-theme-on-surface),.72)!important;font-size:14px;font-weight:650;letter-spacing:0;text-transform:none;transition:background-color .18s,color .18s}
.report-group-tabs :deep(.v-tab--selected){background:rgba(var(--v-theme-primary),.07);color:rgb(var(--v-theme-primary))!important;font-weight:750}
.report-group-tabs :deep(.v-tab:not(.v-tab--selected):hover){background:rgba(var(--v-theme-primary),.045);color:rgb(var(--v-theme-primary))!important}
.report-group-tabs :deep(.v-tab__slider){height:3px;border-radius:3px 3px 0 0}
@media(max-width:650px){.report-group-tabs{padding:0 12px}.report-group-tabs :deep(.v-tab){flex:1;padding:0 8px;font-size:12px}}
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
.unit-detail-table :deep(.v-table__wrapper){overflow-x:auto}
.unit-detail-table :deep(table){width:100%;min-width:1705px;table-layout:fixed}
.unit-detail-table :deep(thead tr:first-child th:nth-child(-n+3)){position:sticky;z-index:4;background:#086fb7!important}
.unit-detail-table :deep(thead tr:first-child th:nth-child(1)),.unit-detail-table :deep(tbody tr:not(.total-row) td:nth-child(1)){left:0}
.unit-detail-table :deep(thead tr:first-child th:nth-child(2)),.unit-detail-table :deep(tbody tr:not(.total-row) td:nth-child(2)){left:50px}
.unit-detail-table :deep(thead tr:first-child th:nth-child(3)),.unit-detail-table :deep(tbody tr:not(.total-row) td:nth-child(3)){left:165px;box-shadow:3px 0 6px rgba(25,50,70,.12)}
.unit-detail-table :deep(thead tr:nth-child(2) th){background:#147bbd!important}
.unit-detail-table :deep(thead tr:first-child th:nth-child(n+4)),.unit-detail-table :deep(thead tr:nth-child(2) th:nth-child(1)),.unit-detail-table :deep(thead tr:nth-child(2) th:nth-child(5)),.unit-detail-table :deep(thead tr:nth-child(2) th:nth-child(8)),.unit-detail-table :deep(tbody tr:not(.total-row) td:nth-child(4)),.unit-detail-table :deep(tbody tr:not(.total-row) td:nth-child(8)),.unit-detail-table :deep(tbody tr:not(.total-row) td:nth-child(11)){border-left:2px solid rgba(var(--v-theme-primary),.2)}
.unit-detail-table :deep(tbody tr.total-row td:nth-child(2)),.unit-detail-table :deep(tbody tr.total-row td:nth-child(6)),.unit-detail-table :deep(tbody tr.total-row td:nth-child(9)){border-left:2px solid rgba(var(--v-theme-primary),.2)}
.unit-detail-table :deep(tbody tr:not(.total-row) td:nth-child(-n+3)){position:sticky;z-index:2;background:rgb(var(--v-theme-surface))}
.unit-detail-table :deep(tbody tr:nth-child(even):not(.selected-kpi-row):not(.total-row)){background:transparent!important}
.unit-detail-table :deep(tbody tr.total-row td){background:color-mix(in srgb,rgb(var(--v-theme-on-surface)) 7%,rgb(var(--v-theme-surface)))!important}
.unit-detail-table :deep(tbody tr.total-row td:first-child){position:sticky;left:0;z-index:3;box-shadow:3px 0 6px rgba(25,50,70,.12)}
.unit-detail-table :deep(tbody tr.selected-kpi-row td){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 17%,rgb(var(--v-theme-surface)))!important;border-top:1px solid color-mix(in srgb,rgb(var(--v-theme-primary)) 36%,transparent);border-bottom:1px solid color-mix(in srgb,rgb(var(--v-theme-primary)) 36%,transparent)}
.unit-detail-table :deep(tbody tr.selected-kpi-row td:first-child){box-shadow:inset 4px 0 rgb(var(--v-theme-primary))}
.unit-detail-table :deep(tbody tr.selected-kpi-row td:nth-child(2)),.unit-detail-table :deep(tbody tr.selected-kpi-row td:nth-child(3)){color:rgb(var(--v-theme-primary));font-weight:800}
.unit-chart-card{scroll-margin-top:76px}
.province-table :deep(.v-table__wrapper){overflow-x:auto}
.province-table :deep(table){width:100%;min-width:1760px;table-layout:fixed}
.province-table :deep(thead tr:nth-child(2) th){background:#147bbd!important}
.province-table :deep(thead tr:first-child th:nth-child(-n+3)){position:sticky;z-index:4;background:#086fb7!important}
.province-table :deep(thead tr:first-child th:nth-child(1)),.province-table :deep(tbody tr:not(.total-row) td:nth-child(1)){left:0}
.province-table :deep(thead tr:first-child th:nth-child(2)),.province-table :deep(tbody tr:not(.total-row) td:nth-child(2)){left:50px}
.province-table :deep(thead tr:first-child th:nth-child(3)),.province-table :deep(tbody tr:not(.total-row) td:nth-child(3)){left:160px;box-shadow:3px 0 6px rgba(25,50,70,.12)}
.province-table :deep(tbody tr:not(.total-row) td:nth-child(-n+3)){position:sticky;z-index:2;background:rgb(var(--v-theme-surface))}
.province-table :deep(tbody tr:nth-child(even):not(.total-row) td:nth-child(-n+3)){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 3.5%,rgb(var(--v-theme-surface)))}
.province-table :deep(tbody tr.total-row td:first-child){position:sticky;left:0;z-index:3;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 11%,rgb(var(--v-theme-surface)))!important;box-shadow:3px 0 6px rgba(25,50,70,.12)}
.province-table :deep(thead tr:first-child th:nth-child(n+4)),.province-table :deep(thead tr:nth-child(2) th:nth-child(1)),.province-table :deep(thead tr:nth-child(2) th:nth-child(5)),.province-table :deep(thead tr:nth-child(2) th:nth-child(8)),.province-table :deep(tbody tr:not(.total-row) td:nth-child(4)),.province-table :deep(tbody tr:not(.total-row) td:nth-child(8)),.province-table :deep(tbody tr:not(.total-row) td:nth-child(11)),.province-table :deep(tbody tr.total-row td:nth-child(2)),.province-table :deep(tbody tr.total-row td:nth-child(6)),.province-table :deep(tbody tr.total-row td:nth-child(9)){border-left:2px solid rgba(var(--v-theme-primary),.2)}
.unit-extra{margin-top:3px;font-size:10px;font-weight:600;opacity:.9}
.change-value{display:inline-flex;align-items:center;justify-content:flex-end;gap:2px;white-space:nowrap;font-variant-numeric:tabular-nums}
.unit-rank-label{display:block;color:#e4f2ff;font-size:10px;font-weight:600;line-height:1.4}
.unit-table :deep(tbody tr.kpi-selectable-row),.unit-detail-table :deep(tbody tr.kpi-selectable-row){cursor:pointer}
.unit-table :deep(tbody tr.kpi-selectable-row:not(.selected-kpi-row):hover td),.unit-detail-table :deep(tbody tr.kpi-selectable-row:not(.selected-kpi-row):hover td){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 7%,rgb(var(--v-theme-surface)))!important}
.unit-table :deep(tbody tr.kpi-selectable-row:focus-visible),.unit-detail-table :deep(tbody tr.kpi-selectable-row:focus-visible){outline:2px solid rgb(var(--v-theme-primary));outline-offset:-2px}
.province-charts .chart-card{min-height:365px}
.pie-chart,.progress-chart{height:305px}
.province-charts{align-items:stretch}
.share-card{min-height:0!important;padding-bottom:14px}
.pie-visual{position:relative;height:285px;margin:4px 0 8px}
.share-card .pie-chart{height:285px}
.pie-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:4px;width:120px;max-width:40%;text-align:center;pointer-events:none}
.pie-center span{font-size:11px;color:rgb(var(--v-theme-on-surface));opacity:.62}
.pie-center strong{font-size:16px;line-height:1.25;color:rgb(var(--v-theme-on-surface))}
.share-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 12px}
.share-entry{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:7px;min-height:48px;padding:5px 3px;border-bottom:1px solid rgba(var(--v-border-color),.17)}
.share-swatch{width:11px;height:11px;border-radius:3px}
.share-name{min-width:0;font-size:12px;font-weight:700;line-height:1.3;color:rgb(var(--v-theme-on-surface))}
.share-name small{display:block;margin-top:2px;font-size:11px;font-weight:400;opacity:.68}
.share-percent{font-size:12px;color:rgb(var(--v-theme-on-surface));font-variant-numeric:tabular-nums}
@media(max-width:540px){.share-list{grid-template-columns:1fr}.pie-visual,.share-card .pie-chart{height:250px}}
.subscriber-layout{display:grid;grid-template-columns:minmax(340px,.9fr) minmax(680px,1.2fr);gap:14px;align-items:start}
.subscriber-chart-card{padding:12px 14px;border:1px solid rgba(var(--v-border-color),.22);border-radius:10px;background:rgb(var(--v-theme-surface))}
.subscriber-chart-card h3{text-align:center;font-size:16px;font-weight:750}
.subscriber-chart-card p{text-align:center;font-size:12px;opacity:.7;margin:4px 0 2px}
.subscriber-chart{width:100%}
.subscriber-table :deep(table){width:100%;min-width:680px;table-layout:fixed}
.subscriber-table :deep(thead tr:first-child th:first-child){width:130px}
.subscriber-table :deep(thead tr:nth-child(2) th){background:#147bbd!important}
.subscriber-table :deep(tbody td:first-child){text-align:left!important;font-weight:700}
.subscriber-table :deep(tbody td:nth-child(n+2)){text-align:right!important;font-variant-numeric:tabular-nums}
.subscriber-table :deep(tbody td small){display:block;margin-top:2px;font-size:10px;opacity:.75}
.subscriber-compare-controls{display:flex;align-items:center;gap:14px;margin-bottom:12px}.subscriber-compare-controls>strong{font-size:15px;color:rgb(var(--v-theme-primary))}.subscriber-compare-controls :deep(.v-btn){min-width:74px;text-transform:none;letter-spacing:0}
.subscriber-heading-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap}.subscriber-heading-actions :deep(.v-btn){font-weight:700}
.subscriber-unit-focus{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.8fr);gap:14px}.subscriber-focus-numbers{padding:16px 20px;border:1px solid rgba(var(--v-border-color),.22);border-radius:10px}.subscriber-focus-numbers h3{font-size:16px;margin-bottom:12px}.subscriber-focus-numbers>div{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-top:1px solid rgba(var(--v-border-color),.16)}.subscriber-focus-numbers>div strong{font-size:22px;font-variant-numeric:tabular-nums}.subscriber-focus-numbers>div small{font-size:12px;margin-left:5px}
.subscriber-compare-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(510px,.9fr);gap:14px;align-items:start}
.subscriber-compare-chart{padding:0;overflow:hidden}.subscriber-compare-chart-title{height:41px;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 10px;background:#086fb7;color:#fff;font-size:13px}.subscriber-compare-chart-title small{font-size:11px;font-weight:400;opacity:.85}.subscriber-compare-chart .subscriber-chart{display:block}
.subscriber-compare-table :deep(table){width:100%;min-width:0;table-layout:fixed}
.subscriber-compare-table :deep(th:first-child){width:28%}
.subscriber-compare-table :deep(thead tr),.subscriber-compare-table :deep(th){height:41px!important}
.subscriber-compare-table :deep(th){padding:0 6px!important}
.subscriber-compare-table :deep(tbody tr),.subscriber-compare-table :deep(td){height:36px!important}
.subscriber-compare-table :deep(td){padding:0 6px!important;font-variant-numeric:tabular-nums}
.subscriber-compare-table :deep(td:first-child){font-weight:700;text-align:left!important;white-space:normal}
.subscriber-compare-table :deep(th:not(:first-child)),.subscriber-compare-table :deep(td:not(:first-child)){text-align:right!important;padding-right:12px!important}
.subscriber-compare-table :deep(tbody tr){cursor:pointer}
.subscriber-compare-table :deep(tbody tr:hover){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 9%,rgb(var(--v-theme-surface)))}
.subscriber-compare-table :deep(tbody tr:focus-visible){outline:2px solid rgb(var(--v-theme-primary));outline-offset:-2px}
@media(max-width:1350px){.subscriber-layout,.subscriber-compare-grid,.subscriber-unit-focus{grid-template-columns:1fr}}
@media(max-width:650px){.subscriber-heading-actions{justify-content:flex-start;margin-top:8px}}
.unit-controls{display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:2px 20px 18px}.unit-controls :deep(.v-input){flex:1 1 340px;max-width:520px}.unit-period{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.unit-period>span{font-size:12px;font-weight:700;color:rgb(var(--v-theme-on-surface));opacity:.7;white-space:nowrap}.unit-period-toggle{display:flex;align-items:center;gap:4px;height:auto;padding:4px;border:1px solid rgba(var(--v-border-color),.22);border-radius:11px;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 5%,rgb(var(--v-theme-surface)));box-shadow:none}.unit-period-toggle :deep(.v-btn){height:36px!important;min-width:0;padding:0 15px;border-radius:8px!important;font-size:12px;font-weight:650;letter-spacing:0;text-transform:none}.unit-period-toggle :deep(.v-btn--active){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))!important;box-shadow:0 2px 7px rgba(0,87,150,.2)}.unit-period-toggle :deep(.v-btn--active .v-btn__overlay){opacity:0}.unit-amount{font-weight:700;font-variant-numeric:tabular-nums}.unit-plan{margin-top:3px;font-size:11px;font-weight:500;opacity:.82;font-variant-numeric:tabular-nums}.unit-plan span{font-weight:700;opacity:1}@media(max-width:650px){.unit-controls{padding-inline:12px;gap:12px}.unit-controls :deep(.v-input){flex-basis:100%}.unit-period{width:100%;justify-content:space-between}.unit-period-toggle :deep(.v-btn){padding-inline:9px;font-size:11px}}
.giao-ban-v2 .report-shell,
.giao-ban-v2 .chart-card,
.giao-ban-v2 .unit-chart-card,
.giao-ban-v2 .subscriber-chart-card,
.giao-ban-v2 .subscriber-focus-numbers,
.giao-ban-v2 .report-table{
  border:1px solid rgba(var(--v-border-color),.1);
  box-shadow:0 4px 18px rgba(22,54,77,.09)!important;
}
</style>
