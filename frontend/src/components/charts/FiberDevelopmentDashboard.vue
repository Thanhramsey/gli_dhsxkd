<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { useTheme } from 'vuetify'
import ZoomableKpiChart from './ZoomableKpiChart.vue'
import type { KpiFiberDevelopmentRow } from '../../types/kpi'
import { adaptChartOptionForTheme } from '../../utils/chart-theme'
import '../../plugins/echarts'

const props = defineProps<{ rows: KpiFiberDevelopmentRow[]; month: string }>()
const theme = useTheme()
type Service = 'ALL' | 'FIBER' | 'MYTV'
type Indicator = { code: string; title: string; money: boolean; prefix: 'revenue' | 'subscribers' }
const service = ref<Service>('ALL')
const serviceLabel = computed(() => service.value === 'ALL' ? 'Tất cả' : service.value === 'FIBER' ? 'Fiber' : 'MyTV')
const selectedServices = computed(() => service.value === 'ALL' ? ['FIBER', 'MYTV'] as const : [service.value])
const indicators = computed<Indicator[]>(() => [
  { code: `DTPTM_${service.value}`, title: 'Doanh thu phát triển mới', money: true, prefix: 'revenue' },
  { code: `SLPTM_${service.value}`, title: 'Thuê bao phát triển mới', money: false, prefix: 'subscribers' },
])
const period = ref<'month' | 'cumulative'>('month')
const group = ref<'TTVT' | 'VNPT'>('TTVT')
const chartMode = ref<'rate' | 'value'>('rate')
const selectedUnitKey = ref<string | null>(null)
const descending = ref<Record<string, boolean>>({})
const search = ref('')
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const number = (value: number | null | undefined) => value == null ? '—' : nf.format(value)
function money(value: number | null | undefined) {
  if (value == null) return '—'
  if (Math.abs(value) >= 1e9) return `${nf.format(value / 1e9)} tỷ đồng`
  if (Math.abs(value) >= 1e6) return `${nf.format(value / 1e6)} triệu đồng`
  return `${nf.format(value)} đồng`
}
const display = (value: number | null | undefined, indicator: Indicator) => indicator.money ? money(value) : `${number(value)}${value == null ? '' : ' thuê bao'}`
const percent = (value: number | null | undefined) => value == null ? '—' : `${nf.format(value)}%`
function rateColor(value: number | null | undefined) {
  if (theme.global.current.value.dark) {
    if (value == null) return '#b5c7d5'
    if (value < 70) return '#f16e6b'
    if (value <= 90) return '#e7b052'
    if (value <= 100) return '#63c6f1'
    return '#58ca97'
  }
  if (value == null) return '#718397'
  if (value < 70) return '#c62828'
  if (value <= 90) return '#a66b00'
  if (value <= 100) return '#0067b1'
  return '#218349'
}
const periodLabel = computed(() => `${period.value === 'month' ? 'Tháng' : 'Lũy kế đến tháng'} ${Number(props.month.slice(5))}/${props.month.slice(0, 4)}`)
const unknownGroups = computed(() => props.rows.filter(row => !['TOANTINH', 'TTVT', 'VNPT'].includes(row.unitGroup)).length)
const hasDuplicates = computed(() => {
  const keys = props.rows.map(row => JSON.stringify([row.unitGroup, row.unitCode || row.unitName, row.kpi]))
  return new Set(keys).size !== keys.length
})
function uniqueRow(rows: KpiFiberDevelopmentRow[], kpi: string) {
  const matching = rows.filter(row => row.kpi === kpi)
  return matching.length === 1 ? matching[0] : undefined
}
function values(row?: KpiFiberDevelopmentRow) {
  const plan = (period.value === 'month' ? row?.plan : row?.cumulativePlan) ?? null
  const actual = (period.value === 'month' ? row?.actual : row?.cumulativeActual) ?? null
  const rate = plan != null && plan > 0 && actual != null ? actual / plan * 100 : null
  return { plan, actual, rate }
}
function sumValues(rows: KpiFiberDevelopmentRow[], prefix: 'DTPTM' | 'SLPTM') {
  const matches = selectedServices.value.map(item => uniqueRow(rows, `${prefix}_${item}`))
  if (matches.some(row => !row)) return values()
  const selected = matches as KpiFiberDevelopmentRow[]
  const sum = (key: 'plan' | 'actual' | 'cumulativePlan' | 'cumulativeActual') => {
    const available = selected.map(row => row[key]).filter((value): value is number => value != null)
    return available.length ? available.reduce((total, value) => total + value, 0) : null
  }
  const plan = sum(period.value === 'month' ? 'plan' : 'cumulativePlan')
  const actual = sum(period.value === 'month' ? 'actual' : 'cumulativeActual')
  return { plan, actual, rate: plan != null && plan > 0 && actual != null ? actual / plan * 100 : null }
}
const province = computed(() => indicators.value.map(indicator => ({
  ...indicator, ...sumValues(props.rows.filter(row => row.unitGroup === 'TOANTINH'), indicator.prefix === 'revenue' ? 'DTPTM' : 'SLPTM'),
})))
function summaryOption(item: typeof province.value[number]) {
  return {
    tooltip: { trigger: 'axis', renderMode: 'richText', confine: true, formatter: (items: Array<{ dataIndex: number }>) => {
      const planned = items[0]?.dataIndex === 0
      return `${planned ? 'Kế hoạch' : 'Thực hiện'}: ${display(planned ? item.plan : item.actual, item)}`
    } },
    grid: { left: 76, right: 125, top: 8, bottom: 12 },
    xAxis: { type: 'value', min: 0, show: false },
    yAxis: { type: 'category', inverse: true, data: ['Kế hoạch', 'Thực hiện'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#657b8b', fontSize: 11 } },
    series: [{ type: 'bar', barMaxWidth: 14,
      data: [{ value: item.plan, itemStyle: { color: '#83b4d8' } }, { value: item.actual, itemStyle: { color: '#0067b1' } }],
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', color: '#244252', fontSize: 11, formatter: ({ value }: { value: number | null }) => item.money ? money(value) : number(value) },
    }],
  }
}
const unitGroups = computed(() => {
  const units = new Map<string, { key: string; name: string; group: string; rows: KpiFiberDevelopmentRow[] }>()
  for (const row of props.rows) {
    if (!['TTVT', 'VNPT'].includes(row.unitGroup)) continue
    if (!selectedServices.value.some(item => row.kpi.endsWith(`_${item}`))) continue
    const key = JSON.stringify([row.unitGroup, row.unitCode || row.unitName])
    const item = units.get(key) ?? { key, name: row.unitName || 'Chưa có tên đơn vị', group: row.unitGroup, rows: [] }
    item.rows.push(row)
    units.set(key, item)
  }
  return [...units.values()].map(item => {
    const revenue = sumValues(item.rows, 'DTPTM')
    const subscribers = sumValues(item.rows, 'SLPTM')
    return { key: item.key, name: item.name, group: item.group, revenue, subscribers,
      revenuePlan: revenue.plan, revenueActual: revenue.actual, revenueRate: revenue.rate,
      subscribersPlan: subscribers.plan, subscribersActual: subscribers.actual, subscribersRate: subscribers.rate,
    }
  })
})
const selectedUnit = computed(() => unitGroups.value.find(unit => unit.key === selectedUnitKey.value))
const summaryItems = computed(() => selectedUnit.value
  ? indicators.value.map(indicator => ({ ...indicator, ...selectedUnit.value![indicator.prefix] }))
  : province.value)
watch(() => props.rows, () => { selectedUnitKey.value = null })
watch(group, () => { selectedUnitKey.value = null })
watch(service, () => { selectedUnitKey.value = null })
const groupCount = (name: string) => unitGroups.value.filter(unit => unit.group === name).length
const filteredUnits = computed(() => unitGroups.value.filter(unit => unit.group === group.value && unit.name.toLocaleLowerCase('vi').includes(search.value.trim().toLocaleLowerCase('vi'))))
function scrollChart(event: WheelEvent) {
  if (event.ctrlKey || event.shiftKey || !event.deltaY) return
  const container = event.currentTarget as HTMLElement
  const step = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1
  const top = Math.max(0, Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + event.deltaY * step))
  event.stopPropagation()
  if (top !== container.scrollTop) {
    event.preventDefault()
    container.scrollTop = top
  }
}
function chartRows(indicator: Indicator) {
  const field = chartMode.value === 'rate' ? 'rate' : 'actual'
  return [...filteredUnits.value].sort((a, b) => {
    const left = a[indicator.prefix][field], right = b[indicator.prefix][field]
    if (left == null) return right == null ? a.name.localeCompare(b.name, 'vi') : 1
    if (right == null) return -1
    return (descending.value[indicator.code] ? -1 : 1) * (left - right) || a.name.localeCompare(b.name, 'vi')
  })
}
function selectChartUnit(event: { dataIndex?: number }, indicator: Indicator) {
  if (!Number.isInteger(event.dataIndex)) return
  const unit = chartRows(indicator)[event.dataIndex!]
  if (!unit) return
  selectedUnitKey.value = selectedUnitKey.value === unit.key ? null : unit.key
}
function unitOption(indicator: Indicator) {
  const rows = chartRows(indicator)
  const rate = chartMode.value === 'rate'
  return {
    tooltip: { trigger: 'axis', renderMode: 'richText', confine: true, axisPointer: { type: 'shadow' }, formatter: (items: Array<{ dataIndex: number }>) => {
      const unit = rows[items[0]?.dataIndex ?? -1]
      if (!unit) return ''
      const item = unit[indicator.prefix]
      return `${unit.name}\n${periodLabel.value}\nKế hoạch: ${display(item.plan, indicator)}\nThực hiện: ${display(item.actual, indicator)}\nHoàn thành: ${percent(item.rate)}`
    } },
    legend: rate ? { show: false } : { top: 8, selectedMode: false, textStyle: { color: '#526a7b', fontSize: 11 } },
    grid: { left: 110, right: rate ? 64 : 85, top: rate ? 16 : 48, bottom: 32 },
    xAxis: { type: 'value', min: (range: { min: number; max: number }) => range.min < 0 ? Math.floor(range.min - Math.max(range.max - range.min, 1) * 0.2) : 0, ...(rate ? { max: (range: { max: number }) => Math.max(110, Math.ceil(range.max / 10) * 10) } : {}),
      axisLabel: { color: '#657b8b', fontSize: 10, formatter: (value: number) => rate ? `${nf.format(value)}%` : indicator.money ? money(value) : nf.format(value) },
      splitLine: { lineStyle: { color: '#e8eef3' } },
    },
    yAxis: { type: 'category', inverse: true, data: rows.map(unit => unit.name.replace(/^Trung tâm Viễn thông\s*/i, '')), axisTick: { show: false }, axisLabel: { width: 96, overflow: 'truncate', color: '#526a7b', fontSize: 11 } },
    series: rate ? [{ name: 'Hoàn thành kế hoạch', type: 'bar', barMaxWidth: 22,
      data: rows.map(unit => ({ value: unit[indicator.prefix].rate, itemStyle: {
        color: rateColor(unit[indicator.prefix].rate),
        opacity: selectedUnitKey.value && selectedUnitKey.value !== unit.key ? .38 : 1,
        borderWidth: selectedUnitKey.value === unit.key ? 2 : 0,
        borderColor: '#173b5c',
      }, label: { position: (unit[indicator.prefix].rate ?? 0) < 0 ? 'left' : 'right' } })),
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', fontSize: 11, color: '#244252', formatter: ({ value }: { value: number | null }) => percent(value) },
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#718397', type: 'dashed' }, data: [{ xAxis: 100 }] },
    }] : [
      { name: 'Kế hoạch', type: 'bar', barMaxWidth: 13, itemStyle: { color: '#83b4d8', borderRadius: 3 }, data: rows.map(unit => ({ value: unit[indicator.prefix].plan, itemStyle: { opacity: selectedUnitKey.value && selectedUnitKey.value !== unit.key ? .38 : 1, borderWidth: selectedUnitKey.value === unit.key ? 2 : 0, borderColor: '#173b5c' } })) },
      { name: 'Thực hiện', type: 'bar', barMaxWidth: 13, itemStyle: { color: '#0067b1', borderRadius: 3 }, data: rows.map(unit => ({ value: unit[indicator.prefix].actual, itemStyle: { opacity: selectedUnitKey.value && selectedUnitKey.value !== unit.key ? .38 : 1, borderWidth: selectedUnitKey.value === unit.key ? 2 : 0, borderColor: '#173b5c' } })) },
    ],
  }
}
const headers = [
  { title: 'Đơn vị', key: 'name', fixed: 'start' as const, width: 210 },
  { title: 'Doanh thu PTM (đồng)', align: 'center' as const, children: [
    { title: 'Kế hoạch', key: 'revenuePlan', align: 'end' as const },
    { title: 'Thực hiện', key: 'revenueActual', align: 'end' as const },
    { title: 'Hoàn thành (%)', key: 'revenueRate', align: 'end' as const },
  ] },
  { title: 'Thuê bao PTM', align: 'center' as const, children: [
    { title: 'Kế hoạch', key: 'subscribersPlan', align: 'end' as const },
    { title: 'Thực hiện', key: 'subscribersActual', align: 'end' as const },
    { title: 'Hoàn thành (%)', key: 'subscribersRate', align: 'end' as const },
  ] },
]
</script>

<template>
  <section class="fiber-development">
    <v-alert v-if="!rows.length" type="info" variant="tonal">Không có dữ liệu phát triển mới trong {{ periodLabel.toLowerCase() }}.</v-alert>
    <template v-else>
      <div class="section-heading">
        <div><h2>{{ selectedUnit?.name ?? 'Tổng quan toàn tỉnh' }}</h2><small>{{ periodLabel }}</small></div>
        <div class="section-heading__actions">
          <v-btn v-if="selectedUnit" size="small" variant="tonal" color="primary" prepend-icon="mdi-close-circle-outline" @click="selectedUnitKey = null">Xem toàn tỉnh</v-btn>
          <v-btn-toggle v-model="service" mandatory density="compact" variant="tonal" color="primary" aria-label="Dịch vụ phát triển mới"><v-btn value="ALL" size="small">Tất cả</v-btn><v-btn value="FIBER" size="small">Fiber</v-btn><v-btn value="MYTV" size="small">MyTV</v-btn></v-btn-toggle>
          <v-btn-toggle v-model="period" mandatory density="compact" variant="tonal" color="primary"><v-btn value="month" size="small">Trong tháng</v-btn><v-btn value="cumulative" size="small">Lũy kế</v-btn></v-btn-toggle>
        </div>
      </div>
      <v-alert v-if="unknownGroups" type="warning" variant="tonal" density="compact" class="mb-4">Có {{ unknownGroups }} dòng chưa thuộc nhóm TOANTINH, TTVT hoặc VNPT. Các dòng này chưa được phân nhóm để hiển thị.</v-alert>
      <v-alert v-if="hasDuplicates" type="warning" variant="tonal" density="compact" class="mb-4">Nguồn trả về trùng chỉ tiêu trong cùng đơn vị. Chỉ tiêu bị trùng hiển thị “—” để tránh cộng sai số liệu.</v-alert>
      <v-row>
        <v-col v-for="item in summaryItems" :key="item.code" cols="12" md="6"><v-card class="fiber-card province-card" elevation="0">
          <div class="indicator-title">{{ item.title }}</div>
          <div class="province-values"><div><small>Thực hiện</small><strong>{{ display(item.actual, item) }}</strong></div><div><small>Hoàn thành</small><strong :style="{ color: rateColor(item.rate) }">{{ percent(item.rate) }}</strong></div></div>
          <div class="province-plan">Kế hoạch: <b>{{ display(item.plan, item) }}</b><span v-if="item.plan === 0"> · Chưa có kế hoạch để tính tỷ lệ</span></div>
          <VChart v-if="item.plan != null || item.actual != null" class="province-chart" :option="adaptChartOptionForTheme(summaryOption(item), theme.global.current.value.dark)" autoresize />
          <div v-else class="province-empty">Chưa có số liệu {{ selectedUnit ? 'của đơn vị này' : 'toàn tỉnh' }} cho chỉ tiêu này.</div>
        </v-card></v-col>
      </v-row>
      <v-card class="fiber-card unit-panel" elevation="0">
        <v-tabs v-model="group" color="primary" aria-label="Nhóm đơn vị"><v-tab value="TTVT">TTVT <span class="group-count">{{ groupCount('TTVT') }}</span></v-tab><v-tab value="VNPT">VNPT <span class="group-count">{{ groupCount('VNPT') }}</span></v-tab></v-tabs>
        <div class="unit-toolbar"><v-text-field v-model="search" label="Tìm tên đơn vị" prepend-inner-icon="mdi-magnify" variant="outlined" density="compact" hide-details /><v-btn-toggle v-model="chartMode" mandatory color="primary" variant="tonal" density="compact"><v-btn value="rate" size="small">Hoàn thành (%)</v-btn><v-btn value="value" size="small">Kế hoạch / thực hiện</v-btn></v-btn-toggle></div>
        <v-alert v-if="!filteredUnits.length" type="info" variant="tonal" class="mx-4 mb-4">Không có đơn vị {{ group }} phù hợp.</v-alert>
        <template v-else>
          <div class="unit-charts"><div v-for="indicator in indicators" :key="indicator.code" class="unit-chart-card">
            <div class="chart-heading"><strong>{{ indicator.title }} · {{ serviceLabel }} · {{ group }}</strong><v-btn :icon="descending[indicator.code] ? 'mdi-sort-descending' : 'mdi-sort-ascending'" variant="tonal" color="primary" size="small" :title="`${chartMode === 'rate' ? 'Tỷ lệ hoàn thành' : 'Thực hiện'}: ${descending[indicator.code] ? 'giảm dần' : 'tăng dần'}. Bấm để đảo chiều`" @click="descending[indicator.code] = !descending[indicator.code]" /></div>
            <div v-if="chartMode === 'rate'" class="rate-legend" aria-label="Chú giải màu tỷ lệ hoàn thành">
              <span><i class="rate-legend__red" />Dưới 70%</span>
              <span><i class="rate-legend__amber" />70–90%</span>
              <span><i class="rate-legend__blue" />Trên 90–100%</span>
              <span><i class="rate-legend__green" />Trên 100%</span>
            </div>
            <div class="unit-chart-scroll" tabindex="0" :aria-label="indicator.title" @wheel.capture="scrollChart"><ZoomableKpiChart :option="unitOption(indicator)" axis="y" :count="filteredUnits.length" :style="{ height: `${Math.max(360, filteredUnits.length * (chartMode === 'rate' ? 26 : 34) + 85)}px` }" @click="selectChartUnit($event, indicator)" /></div>
          </div></div>
          <div class="table-heading"><strong>Chi tiết {{ serviceLabel }} · {{ group === 'TTVT' ? 'Trung tâm Viễn thông' : 'đơn vị VNPT' }}</strong><small>{{ periodLabel }} · {{ filteredUnits.length }} đơn vị</small></div>
          <v-data-table :headers="headers" :items="filteredUnits" item-value="key" :sort-by="[{ key: 'revenueRate', order: 'asc' }]" :items-per-page="20" :items-per-page-options="[10, 20, 50]" density="comfortable" hover class="fiber-table">
            <template #item.name="{ item }">{{ item.name }}</template>
            <template v-for="key in ['revenuePlan', 'revenueActual', 'subscribersPlan', 'subscribersActual']" :key="key" #[`item.${key}`]="{ value }">{{ number(value) }}</template>
            <template #item.revenueRate="{ value }"><b :style="{ color: rateColor(value) }">{{ percent(value) }}</b></template>
            <template #item.subscribersRate="{ value }"><b :style="{ color: rateColor(value) }">{{ percent(value) }}</b></template>
          </v-data-table>
        </template>
      </v-card>
    </template>
  </section>
</template>

<style scoped>
:global(.v-theme--dashboardDark .fiber-development .section-heading small),
:global(.v-theme--dashboardDark .fiber-development .province-values small),
:global(.v-theme--dashboardDark .fiber-development .province-plan),
:global(.v-theme--dashboardDark .fiber-development .province-empty),
:global(.v-theme--dashboardDark .fiber-development .chart-heading small),
:global(.v-theme--dashboardDark .fiber-development .rate-legend),
:global(.v-theme--dashboardDark .fiber-development .table-heading small){color:#b8cad8}
:global(.v-theme--dashboardDark .fiber-development .province-plan span){color:#e7b052}
:global(.v-theme--dashboardDark .fiber-development .province-values strong){color:#63c6f1}
:global(.v-theme--dashboardDark .fiber-development .unit-chart-card){border-color:#344858}
:global(.v-theme--dashboardDark .fiber-development .group-count){background:#29465c;color:#8ed9f7}
.rate-legend{display:flex;justify-content:center;flex-wrap:wrap;gap:5px 12px;padding:0 8px 6px;color:#526a7b;font-size:11px}.rate-legend span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.rate-legend i{display:inline-block;width:11px;height:11px;border-radius:3px}.rate-legend__red{background:#c62828}.rate-legend__amber{background:#a66b00}.rate-legend__blue{background:#0067b1}.rate-legend__green{background:#218349}
.fiber-development{margin-top:22px}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.section-heading__actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.section-heading h2{font-size:18px}.section-heading small{display:block;color:#657b8b;margin-top:5px}.fiber-development :deep(.v-btn){text-transform:none;letter-spacing:0}.fiber-card{border-radius:12px;background:rgb(var(--v-theme-surface));box-shadow:0 4px 18px rgba(29,61,83,.08)!important}.province-card{padding:20px 22px;height:100%;border-top:3px solid #0067b1}.indicator-title{font-size:15px;font-weight:600}.province-values{display:flex;justify-content:space-between;gap:20px;margin-top:16px}.province-values small{color:#657b8b;font-size:12px}.province-values strong{display:block;margin-top:5px;font-size:24px;color:#0067b1}.province-plan{font-size:12px;color:#526a7b;margin-top:14px;line-height:1.6}.province-plan span{color:#a66b00}.province-chart{height:105px;margin-top:12px}.province-empty{padding:22px 0;color:#657b8b;font-size:13px}.unit-panel{margin-top:22px;overflow:hidden}.group-count{margin-left:7px;background:#e9f4fd;color:#0067b1;padding:1px 7px;border-radius:10px}.unit-toolbar{display:flex;align-items:center;gap:16px;justify-content:space-between;padding:18px 20px}.unit-toolbar :deep(.v-text-field){max-width:330px}.unit-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:0 16px 16px}.unit-chart-card{min-width:0;border:1px solid #e7eef4;border-radius:10px;padding:14px 8px 8px}.chart-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:0 8px;min-height:48px}.chart-heading strong{font-size:14px;line-height:1.5}.unit-chart-scroll{height:360px;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;cursor:pointer}.table-heading{padding:16px 22px}.table-heading strong{font-size:15px}.table-heading small{display:block;font-size:12px;color:#657b8b;margin-top:5px}.fiber-table :deep(table){border-collapse:separate;border-spacing:0}.fiber-table :deep(th){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 7%,rgb(var(--v-theme-surface)))!important;color:rgb(var(--v-theme-primary));font-size:12px;white-space:nowrap;min-width:110px}.fiber-table :deep(th:first-child){position:sticky;left:0;z-index:3;box-shadow:2px 0 4px #1d3d5314}.fiber-table :deep(thead tr:nth-child(2) th:first-child){position:static;box-shadow:none}.fiber-table :deep(td){white-space:nowrap;font-size:12px}.fiber-table :deep(td:first-child){position:sticky;left:0;z-index:2;background:rgb(var(--v-theme-surface));min-width:210px;font-weight:600;box-shadow:2px 0 4px #1d3d5314}.fiber-table :deep(tbody tr:nth-child(even)){background:rgba(var(--v-theme-primary),.025)}.fiber-table :deep(tbody tr:nth-child(even) td:first-child){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 2.5%,rgb(var(--v-theme-surface)))}@media(max-width:800px){.unit-charts{grid-template-columns:minmax(0,1fr)}.unit-toolbar,.section-heading{align-items:stretch;flex-direction:column}.unit-toolbar :deep(.v-text-field){max-width:none}.province-card{padding:18px}.province-values strong{font-size:21px}.unit-toolbar :deep(.v-btn){font-size:11px}}@media(max-width:420px){.province-values{gap:10px}.province-values strong{font-size:18px}}
</style>
