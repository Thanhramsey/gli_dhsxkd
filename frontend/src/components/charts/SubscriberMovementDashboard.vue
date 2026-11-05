<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import ZoomableKpiChart from './ZoomableKpiChart.vue'
import type { KpiSubscriberMovementRow } from '../../types/kpi'
import '../../plugins/echarts'

const props = defineProps<{ rows: KpiSubscriberMovementRow[]; month: string }>()
const services = [
  { title: 'Tất cả dịch vụ', value: 'ALL' },
  { title: 'FiberVNN', value: 'FTTX' }, { title: 'MyTV', value: 'MYTV' },
  { title: 'Mesh', value: 'MESH' }, { title: 'Cố định', value: 'CD' },
  { title: 'GPhone', value: 'GP' }, { title: 'IMS', value: 'IMS' },
]
const service = ref('ALL')
const center = ref('')
const team = ref('')
const level = computed(() => team.value ? 'area' : center.value ? 'team' : 'center')
const levelName = computed(() => level.value === 'center' ? 'trung tâm' : level.value === 'team' ? 'tổ / trạm' : 'địa bàn')
const selectedKey = ref<string | null>(null)
const overview = ref<HTMLElement | null>(null)
const comparisonDescending = ref(true)
const netDescending = ref(false)
const serviceNetDescending = ref(true)
const serviceShareMetric = ref<'PT' | 'HUY'>('PT')
const comparisonView = ref<'development' | 'status'>('development')
const comparisonLegendSelected = ref<Record<string, boolean>>({})
const tableDetails = ref(false)
const search = ref('')
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const count = (value: number | null | undefined) => value == null ? '—' : nf.format(value)
const netColor = (value: number | null | undefined) => value == null ? '#718397' : value < 0 ? '#c62828' : value > 0 ? '#0067b1' : '#526a7b'
const serviceName = computed(() => services.find(item => item.value === service.value)?.title ?? '')
const monthLabel = computed(() => `tháng ${Number(props.month.slice(5))}/${props.month.slice(0, 4)}`)
// Excel exports may include presentation subtotals; never add them to their detail rows.
const detailRows = computed(() => props.rows
  .filter(row => !/\s-\sTotal$/i.test(row.teamName) && !/^VTT$/i.test(row.centerName))
  .map(row => {
    const values = { ...row.values }
    for (const metric of ['PT', 'HUY', 'NG', 'KP', 'TT']) {
      const amounts = services.filter(item => item.value !== 'ALL').map(item => row.values[`${item.value}_${metric}`])
      values[`ALL_${metric}`] = amounts.some(value => value == null)
        ? null
        : amounts.reduce<number>((total, value) => total + value!, 0)
    }
    return { ...row, values }
  }))
const centerKey = (row: KpiSubscriberMovementRow) => row.centerCode || row.centerName
const teamKey = (row: KpiSubscriberMovementRow) => JSON.stringify([centerKey(row), row.teamCode || row.teamName])
const centerOptions = computed(() => [{ title: 'Tất cả trung tâm', value: '' }, ...Array.from(new Map(detailRows.value.map(row => [centerKey(row), { title: row.centerName || 'Chưa xác định', value: centerKey(row) }])).values())])
const centerRows = computed(() => detailRows.value.filter(row => !center.value || centerKey(row) === center.value))
const teamOptions = computed(() => [{ title: 'Tất cả tổ / trạm của trung tâm', value: '' }, ...Array.from(new Map(centerRows.value.map(row => [teamKey(row), { title: row.teamName || 'Chưa xác định', value: teamKey(row) }])).values())])
const centerName = computed(() => centerOptions.value.find(item => item.value === center.value)?.title ?? '')
const teamName = computed(() => teamOptions.value.find(item => item.value === team.value)?.title ?? '')
const filterScope = computed(() => team.value ? `${centerName.value} / ${teamName.value}` : center.value ? centerName.value : 'Tất cả trung tâm')
const filteredRows = computed(() => centerRows.value.filter(row => !team.value || teamKey(row) === team.value))
const metrics = computed(() => {
  const prefix = service.value
  const common = [
    { title: 'Phát triển mới', key: `${prefix}_PT` }, { title: 'Hủy', key: `${prefix}_HUY` },
    { title: 'Thực tăng', key: `${prefix}_TT` }, { title: 'Tạm ngừng', key: `${prefix}_NG` },
    { title: 'Khôi phục tạm ngừng', key: `${prefix}_KP` },
  ]
  if (!tableDetails.value) return common
  const extras: Record<string, Array<[string, string]>> = {
    FTTX: [['Phát triển GPON', 'FTTX_PT_GPON'], ['Phát triển qua switch', 'FTTX_PT_SW'], ['Chuyển đổi', 'FTTX_PT_CD'], ['Khôi phục thanh lý', 'FTTX_KPTL'], ['Thanh lý cục bộ', 'FTTX_H_TD'], ['Hủy thực tế', 'FTTX_HUY_TT']],
    MYTV: [['Phát triển qua App', 'MYTV_PT_APP'], ['Khôi phục thanh lý', 'MYTV_KPTL'], ['Thanh lý cục bộ', 'MYTV_H_TD'], ['Hủy thực tế', 'MYTV_HUY_TT']],
    IMS: [['Chuyển đổi', 'IMS_CD']],
  }
  return [...common, ...(extras[prefix] ?? []).map(([title, key]) => ({ title, key }))]
})
function sum(rows: KpiSubscriberMovementRow[], key: string): number | null {
  if (!rows.length || rows.some(row => row.values[key] == null)) return null
  return rows.reduce((total, row) => total + row.values[key]!, 0)
}
function totals(rows: KpiSubscriberMovementRow[]) {
  return Object.fromEntries(Object.keys(rows[0]?.values ?? {}).map(key => [key, sum(rows, key)])) as Record<string, number | null>
}
const groups = computed(() => {
  const map = new Map<string, { key: string; name: string; context: string; rows: KpiSubscriberMovementRow[] }>()
  for (const row of filteredRows.value) {
    const key = level.value === 'center' ? centerKey(row) : level.value === 'team' ? teamKey(row) : JSON.stringify([teamKey(row), row.areaCode || row.areaName])
    const name = (level.value === 'center' ? row.centerName : level.value === 'team' ? row.teamName : row.areaName) || 'Chưa xác định'
    const context = level.value === 'center' ? '' : level.value === 'team' ? row.centerName : `${row.centerName} · ${row.teamName}`
    const group = map.get(key) ?? { key, name, context, rows: [] }
    group.rows.push(row)
    map.set(key, group)
  }
  return [...map.values()].map(group => ({ ...group, values: totals(group.rows) }))
})
const selectedGroup = computed(() => groups.value.find(group => group.key === selectedKey.value))
const scopeTotals = computed(() => selectedGroup.value?.values ?? totals(filteredRows.value))
const serviceShareRows = computed(() => {
  const colors = ['#0067b1', '#0c8b8d', '#d99b30', '#7c66a5', '#46627c', '#4885c4']
  return services.filter(item => item.value !== 'ALL').map((item, index) => ({
    name: item.title,
    value: scopeTotals.value[`${item.value}_${serviceShareMetric.value}`] ?? null,
    itemStyle: { color: colors[index] },
  }))
})
const serviceShareTotal = computed(() => serviceShareRows.value.some(row => row.value == null || !Number.isFinite(row.value) || row.value < 0)
  ? null
  : serviceShareRows.value.reduce((total, row) => total + row.value!, 0))
const serviceShareOption = computed(() => ({
  tooltip: { trigger: 'item', renderMode: 'richText', confine: true, formatter: (item: { dataIndex: number }) => {
    const row = serviceShareRows.value[item.dataIndex]
    if (!row || row.value == null || !serviceShareTotal.value) return ''
    return `${row.name}\n${serviceShareMetric.value === 'PT' ? 'Phát triển mới' : 'Hủy'}: ${count(row.value)} thuê bao\nTỷ trọng: ${nf.format(row.value / serviceShareTotal.value * 100)}%`
  } },
  legend: { bottom: 0, left: 'center', selectedMode: false, itemWidth: 12, itemHeight: 9, textStyle: { color: '#526a7b', fontSize: 11 } },
  series: [{
    name: 'Cơ cấu theo dịch vụ', type: 'pie' as const, radius: ['43%', '64%'], center: ['50%', '43%'],
    percentPrecision: 2, stillShowZeroSum: false,
    label: { color: '#526a7b', fontSize: 11, formatter: '{b}\n{d}%' },
    labelLine: { length: 10, length2: 8 },
    itemStyle: { borderColor: '#fff', borderWidth: 2 },
    emphasis: { scale: false },
    data: serviceShareRows.value.map(row => ({ ...row, value: row.value ?? 0, label: { show: row.value != null && row.value > 0 } })),
  }],
}))
const serviceNetRows = computed(() => services
  .filter(item => item.value !== 'ALL')
  .map(item => ({
    name: item.title,
    actual: scopeTotals.value[`${item.value}_TT`] ?? null,
    developed: scopeTotals.value[`${item.value}_PT`],
    canceled: scopeTotals.value[`${item.value}_HUY`],
  }))
  .sort((a, b) => {
    if (a.actual == null) return b.actual == null ? a.name.localeCompare(b.name, 'vi') : 1
    if (b.actual == null) return -1
    return (serviceNetDescending.value ? -1 : 1) * (a.actual - b.actual) || a.name.localeCompare(b.name, 'vi')
  }))
const serviceNetOption = computed(() => ({
  tooltip: {
    trigger: 'axis', renderMode: 'richText', confine: true, axisPointer: { type: 'shadow' },
    formatter: (items: Array<{ dataIndex: number }>) => {
      const row = serviceNetRows.value[items[0]?.dataIndex ?? -1]
      return row ? [row.name, selectedGroup.value?.name ?? filterScope.value,
        `Phát triển mới: ${count(row.developed)} thuê bao`,
        `Hủy: ${count(row.canceled)} thuê bao`,
        `Thực tăng: ${count(row.actual)} thuê bao`].join('\n') : ''
    },
  },
  grid: { left: 80, right: 48, top: 52, bottom: 35 },
  xAxis: {
    type: 'value', minInterval: 1,
    min: (range: { min: number; max: number }) => range.min < 0
      ? Math.floor(range.min - Math.max(Math.max(0, range.max) - range.min, 1) * 0.2) : 0,
    max: (range: { min: number; max: number }) => range.max > 0
      ? Math.ceil(range.max + Math.max(range.max - Math.min(0, range.min), 1) * 0.2)
      : range.min < 0 ? 0 : 1,
    axisLabel: { color: '#526a7b', formatter: (value: number) => nf.format(value) },
    splitLine: { lineStyle: { color: '#e8eef3' } },
  },
  yAxis: {
    type: 'category', inverse: true, data: serviceNetRows.value.map(row => row.name),
    axisTick: { show: false }, axisLabel: { color: '#526a7b' },
  },
  series: [{
    name: 'Thực tăng', type: 'bar', barMaxWidth: 26,
    data: serviceNetRows.value.map(row => ({
      value: row.actual,
      itemStyle: { color: netColor(row.actual), borderRadius: 3 },
      label: { position: row.actual != null && row.actual < 0 ? 'left' : 'right', color: netColor(row.actual) },
    })),
    label: { show: true, formatter: ({ value }: { value: number | null }) => count(value) },
    markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#718397', width: 1 }, data: [{ xAxis: 0 }] },
  }],
}))
const newCount = computed(() => scopeTotals.value[`${service.value}_PT`])
const canceledCount = computed(() => scopeTotals.value[`${service.value}_HUY`])
const cancelRatio = (values: Record<string, number | null>) => {
  const developed = values[`${service.value}_PT`]
  const canceled = values[`${service.value}_HUY`]
  return developed != null && developed > 0 && canceled != null ? canceled / developed * 100 : null
}
const comparisonMetrics = computed(() => comparisonView.value === 'development'
  ? [{ name: 'Phát triển mới', key: `${service.value}_PT`, color: '#0067b1' }, { name: 'Hủy', key: `${service.value}_HUY`, color: '#c62828' }]
  : [{ name: 'Tạm ngừng', key: `${service.value}_NG`, color: '#c62828' }, { name: 'Khôi phục tạm ngừng', key: `${service.value}_KP`, color: '#0067b1' }])
const comparisonSortMetric = computed(() => comparisonMetrics.value.find(metric => comparisonLegendSelected.value[metric.name] !== false) ?? comparisonMetrics.value[0]!)
function syncComparisonLegend(event: { selected: Record<string, boolean> }) {
  comparisonLegendSelected.value = { ...event.selected }
}
watch(comparisonView, () => { comparisonLegendSelected.value = {} })
function sortedGroups(key: string, descending: boolean) {
  return [...groups.value].sort((a, b) => {
    const left = a.values[key], right = b.values[key]
    if (left == null) return right == null ? a.name.localeCompare(b.name, 'vi') : 1
    if (right == null) return -1
    return (descending ? -1 : 1) * (left - right) || a.name.localeCompare(b.name, 'vi')
  })
}
const comparisonRows = computed(() => sortedGroups(comparisonSortMetric.value.key, comparisonDescending.value))
const netRows = computed(() => sortedGroups(`${service.value}_TT`, netDescending.value))
const netTotal = computed(() => sum(filteredRows.value, `${service.value}_TT`))
function shortName(name: string) {
  return name.replace(/^Trung tâm Viễn thông\s*/i, '').replace(/^Tổ Kỹ thuật Địa bàn\s*/i, '')
}
function option(rows: typeof groups.value, net: boolean) {
  const series = net ? [{ name: 'Thực tăng', key: `${service.value}_TT`, color: '#0067b1' }] : comparisonMetrics.value
  return {
    tooltip: { trigger: 'axis', renderMode: 'richText', confine: true, axisPointer: { type: 'shadow' }, formatter: (items: Array<{ dataIndex: number }>) => {
      const row = rows[items[0]?.dataIndex ?? -1]
      if (!row) return ''
      return [row.name, row.context, ...series.filter(item => net || comparisonLegendSelected.value[item.name] !== false).map(item => `${item.name}: ${count(row.values[item.key])} thuê bao`)].filter(Boolean).join('\n')
    } },
    legend: { top: 8, textStyle: { color: '#526a7b' }, ...(!net ? { selected: Object.fromEntries(comparisonMetrics.value.map(metric => [metric.name, comparisonLegendSelected.value[metric.name] !== false])) } : {}) },
    grid: { left: 112, right: 48, top: 52, bottom: 35 },
    xAxis: {
      type: 'value',
      min: net ? (range: { min: number; max: number }) => range.min < 0
        ? Math.floor(range.min - Math.max(Math.max(0, range.max) - range.min, 1) * 0.2)
        : 0 : 0,
      ...(net ? { max: (range: { min: number; max: number }) => range.max > 0
        ? Math.ceil(range.max + Math.max(range.max - Math.min(0, range.min), 1) * 0.2)
        : range.min < 0 ? 0 : 1 } : {}),
      minInterval: 1,
      axisLabel: { color: '#526a7b', formatter: (value: number) => nf.format(value) },
      splitLine: { lineStyle: { color: '#e8eef3' } },
    },
    yAxis: { type: 'category', inverse: true, data: rows.map(row => shortName(row.name)), axisTick: { show: false }, axisLabel: { width: 98, fontSize: 10, overflow: 'truncate', color: (_value: string | number, index: number) => netColor(rows[index]?.values[`${service.value}_TT`]) } },
    series: series.map(item => ({ name: item.name, type: 'bar', barMaxWidth: net ? 24 : 15, itemStyle: { color: item.color, borderRadius: 3 }, data: rows.map(row => ({ value: row.values[item.key], label: { position: net && (row.values[item.key] ?? 0) < 0 ? 'left' : 'right', ...(net ? { color: netColor(row.values[item.key]) } : {}) }, itemStyle: { color: net ? netColor(row.values[item.key]) : item.color, opacity: selectedKey.value && selectedKey.value !== row.key ? 0.35 : 1 } })), label: { show: true, position: 'right', color: '#244252', fontSize: 11, formatter: ({ value }: { value: number | null }) => count(value) } })),
  }
}
const comparisonOption = computed(() => option(comparisonRows.value, false))
const netOption = computed(() => option(netRows.value, true))
function selectGroup(event: { dataIndex?: number }, rows: typeof groups.value) {
  const group = event.dataIndex == null ? undefined : rows[event.dataIndex]
  if (group) selectedKey.value = selectedKey.value === group.key ? null : group.key
}
function clearSelectedGroup() {
  selectedKey.value = null
  overview.value?.focus({ preventScroll: true })
}
function scrollChart(event: WheelEvent) {
  if (event.ctrlKey || event.shiftKey || !event.deltaY) return
  const container = event.currentTarget as HTMLElement
  const step = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1
  const nextTop = Math.max(0, Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + event.deltaY * step))
  // Handle the wheel before the chart canvas consumes it; keep page scrolling at the edges.
  event.stopPropagation()
  if (nextTop !== container.scrollTop) {
    event.preventDefault()
    container.scrollTop = nextTop
  }
}
async function selectTableGroup(key: string) {
  selectedKey.value = selectedKey.value === key ? null : key
  await nextTick()
  overview.value?.focus({ preventScroll: true })
  overview.value?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
    inline: 'nearest',
  })
}
const headers = computed(() => [
  { title: level.value === 'center' ? 'Trung tâm viễn thông' : level.value === 'team' ? 'Tổ / trạm' : 'Địa bàn', key: 'name', fixed: 'start' as const, width: 210 },
  ...metrics.value.map(metric => ({ title: metric.title, key: metric.key, align: 'end' as const })),
  { title: 'Hủy / phát triển mới', key: 'cancelRatio', align: 'end' as const },
])
const tableRows = computed(() => groups.value.map(group => ({ ...group.values, key: group.key, name: group.name, context: group.context, net: group.values[`${service.value}_TT`], cancelRatio: cancelRatio(group.values) })))
watch(center, () => { team.value = '' })
watch([center, team, level, () => props.rows], () => { selectedKey.value = null })
function drillSelected() {
  const row = selectedGroup.value?.rows[0]
  if (!row) return
  if (level.value === 'center') center.value = centerKey(row)
  else if (level.value === 'team') team.value = teamKey(row)
}
</script>

<template>
  <section class="movement-dashboard" @keydown.esc="clearSelectedGroup">
    <v-alert v-if="!detailRows.length" class="mt-5" type="info" variant="tonal">Không có dữ liệu biến động thuê bao trong {{ monthLabel }}.</v-alert>
    <template v-else>
      <v-card class="movement-card movement-filters" elevation="0">
        <div class="filter-label">Dịch vụ</div>
        <v-chip-group v-model="service" mandatory class="service-chips" selected-class="service-chip-selected" aria-label="Dịch vụ"><v-chip v-for="item in services" :key="item.value" :value="item.value" class="service-chip" variant="flat" filter>{{ item.title }}</v-chip></v-chip-group>
        <div class="movement-filter-row">
          <v-select v-model="center" :items="centerOptions" label="Trung tâm viễn thông" variant="outlined" density="compact" hide-details />
          <v-select v-model="team" :items="teamOptions" :disabled="!center" label="Tổ / trạm thuộc trung tâm" variant="outlined" density="compact" hide-details />
        </div>

      </v-card>
      <div ref="overview" class="movement-context" tabindex="-1"><div><strong>{{ serviceName }} · {{ selectedGroup?.name ?? filterScope }}</strong><small v-if="selectedGroup">Thuộc phạm vi: {{ filterScope }}</small></div><div class="context-actions"><v-btn v-if="selectedGroup && level !== 'area'" size="small" color="primary" variant="text" @click="drillSelected">{{ level === 'center' ? 'Xem các tổ / trạm' : 'Xem các địa bàn' }}</v-btn></div></div>
      <v-row>
        <v-col cols="12" sm="6" lg="3"><v-card class="movement-card metric-card"><small>PHÁT TRIỂN MỚI</small><strong>{{ count(newCount) }}</strong></v-card></v-col>
        <v-col cols="12" sm="6" lg="3"><v-card class="movement-card metric-card"><small>THUÊ BAO HỦY</small><strong>{{ count(canceledCount) }}</strong><p>Hủy / phát triển mới: {{ cancelRatio(scopeTotals) == null ? '—' : `${nf.format(cancelRatio(scopeTotals)!)}%` }}</p></v-card></v-col>
        <v-col cols="12" sm="6" lg="3"><v-card class="movement-card metric-card"><small>THỰC TĂNG</small><strong :style="{ color: netColor(scopeTotals[`${service}_TT`]) }">{{ count(scopeTotals[`${service}_TT`]) }}</strong><p>Phát triển mới − hủy</p></v-card></v-col>
        <v-col cols="12" sm="6" lg="3"><v-card class="movement-card metric-card"><small>TẠM NGỪNG</small><strong>{{ count(scopeTotals[`${service}_NG`]) }}</strong><p>Khôi phục tạm ngừng: {{ count(scopeTotals[`${service}_KP`]) }}</p></v-card></v-col>
      </v-row>
      <div class="movement-charts">
        <v-card class="movement-card chart-card">
          <div class="chart-heading"><div><strong>{{ comparisonView === 'development' ? 'Phát triển mới và hủy' : 'Tạm ngừng và khôi phục' }} · {{ serviceName }}</strong></div><v-btn :icon="comparisonDescending ? 'mdi-sort-descending' : 'mdi-sort-ascending'" size="small" variant="tonal" color="primary" :title="`${comparisonSortMetric.name}: ${comparisonDescending ? 'giảm dần' : 'tăng dần'}. Bấm để đảo chiều`" @click="comparisonDescending = !comparisonDescending" /></div>
          <v-btn-toggle v-model="comparisonView" mandatory color="primary" variant="tonal" density="compact" class="chart-mode"><v-btn value="development" size="small">Phát triển / hủy</v-btn><v-btn value="status" size="small">Tạm ngừng / khôi phục</v-btn></v-btn-toggle>

          <div class="chart-scroll" tabindex="0" aria-label="Danh sách đầy đủ đơn vị phát triển và hủy" @wheel.capture="scrollChart">
            <ZoomableKpiChart class="movement-chart" :style="{ height: `${Math.max(380, comparisonRows.length * 32 + 90)}px` }" :option="comparisonOption" axis="y" :count="comparisonRows.length" @click="selectGroup($event, comparisonRows)" @legendselectchanged="syncComparisonLegend" />
          </div>
        </v-card>
        <v-card class="movement-card chart-card">
          <div class="chart-heading"><div><strong>Thực tăng theo {{ levelName }} · {{ serviceName }}</strong><small>Tổng: {{ count(netTotal) }} thuê bao · {{ netRows.length }} {{ levelName }}</small></div><v-btn :icon="netDescending ? 'mdi-sort-descending' : 'mdi-sort-ascending'" size="small" variant="tonal" color="primary" :title="netDescending ? 'Đang xếp giảm dần. Bấm để đảo chiều' : 'Đang xếp tăng dần. Bấm để đảo chiều'" @click="netDescending = !netDescending" /></div>
          <div class="chart-mode" aria-hidden="true" />

          <div class="chart-scroll" tabindex="0" aria-label="Danh sách đầy đủ đơn vị thực tăng" @wheel.capture="scrollChart">
            <ZoomableKpiChart class="movement-chart" :style="{ height: `${Math.max(380, netRows.length * 26 + 90)}px` }" :option="netOption" axis="y" :count="netRows.length" @click="selectGroup($event, netRows)" />
          </div>
        </v-card>
      <v-card class="movement-card chart-card service-net-card">
        <div class="chart-heading"><div><strong>Thực tăng theo dịch vụ</strong><small>{{ selectedGroup?.name ?? filterScope }} · {{ monthLabel }}</small></div><v-btn :icon="serviceNetDescending ? 'mdi-sort-descending' : 'mdi-sort-ascending'" size="small" variant="tonal" color="primary" :title="serviceNetDescending ? 'Thực tăng: giảm dần. Bấm để đảo chiều' : 'Thực tăng: tăng dần. Bấm để đảo chiều'" @click="serviceNetDescending = !serviceNetDescending" /></div>
        <div class="chart-mode" aria-hidden="true" />
        <ZoomableKpiChart class="service-net-chart" :option="serviceNetOption" axis="x" :count="serviceNetRows.length" />
      </v-card>
      </div>
      <div class="movement-details">
      <v-card class="movement-card service-share-card">
        <div class="chart-heading"><div><strong>Cơ cấu theo dịch vụ</strong><small>{{ selectedGroup?.name ?? filterScope }} · {{ monthLabel }}</small></div></div>
        <v-btn-toggle v-model="serviceShareMetric" mandatory color="primary" variant="tonal" density="compact" class="chart-mode"><v-btn value="PT" size="small">Phát triển mới</v-btn><v-btn value="HUY" size="small">Hủy</v-btn></v-btn-toggle>
        <div class="share-total">Tổng: <strong>{{ count(serviceShareTotal) }}</strong> thuê bao</div>
        <VChart v-if="serviceShareTotal != null && serviceShareTotal > 0" class="service-share-chart" :option="serviceShareOption" autoresize />
        <div v-else class="service-share-empty">{{ serviceShareTotal == null ? 'Chưa đủ dữ liệu để tính tỷ trọng theo dịch vụ.' : 'Không có thuê bao trong phạm vi đang xem.' }}</div>
      </v-card>
      <v-card class="movement-card detail-card">
        <div class="chart-heading"><div><strong>Chi tiết {{ serviceName }} theo {{ levelName }}</strong><small>{{ filterScope }} · {{ monthLabel }}</small></div></div>
        <div class="table-toolbar"><v-text-field v-model="search" label="Tìm đơn vị" prepend-inner-icon="mdi-magnify" variant="outlined" density="compact" hide-details /><v-switch v-if="service !== 'ALL'" v-model="tableDetails" label="Thêm chỉ tiêu chi tiết" color="primary" density="compact" hide-details /></div>
        <v-data-table :headers="headers" :items="tableRows" item-value="key" :search="search" :items-per-page="20" :items-per-page-options="[10, 20, 50, 100]" :sort-by="[{ key: `${service}_TT`, order: 'asc' }]" density="comfortable" hover class="movement-table">
          <template #item.name="{ item }"><button class="unit-button" :style="{ color: netColor(item.net) }" :class="{ selected: selectedKey === item.key }" :aria-pressed="selectedKey === item.key" @click="selectTableGroup(item.key)">{{ item.name }}<small v-if="item.context">{{ item.context }}</small></button></template>
          <template v-for="metric in metrics" :key="metric.key" #[`item.${metric.key}`]="{ value }"><span :style="metric.key.endsWith('_TT') ? { color: netColor(value), fontWeight: 600 } : {}">{{ count(value) }}</span></template>
          <template #item.cancelRatio="{ value }">{{ value == null ? '—' : `${nf.format(value)}%` }}</template>
        </v-data-table>
      </v-card>
      </div>
    </template>
  </section>
</template>

<style scoped>
.service-chips .service-chip{background:#eef7ff;color:#175b8f;border:1px solid #cfe5f7;font-weight:500;transition:background-color .15s,border-color .15s}.service-chips .service-chip:hover{background:#dceeff;border-color:#8fc3eb}.service-chips .service-chip.service-chip-selected{background:#0067b1;color:#fff;border-color:#0067b1;box-shadow:0 2px 5px rgba(0,103,177,.16)}.service-chips .service-chip:focus-visible{outline:2px solid #0067b1;outline-offset:2px}
.movement-details{display:grid;grid-template-columns:minmax(300px,1fr) minmax(0,2fr);gap:16px;margin-top:20px;align-items:start}.movement-details>.detail-card{margin-top:0;min-width:0}.service-share-card{padding:18px 14px 12px;min-width:0;overflow:hidden}.service-share-card .chart-mode{display:flex}.service-share-card .chart-mode :deep(.v-btn){flex:1}.share-total{text-align:center;margin:8px 0 0;font-size:12px;color:#526a7b}.service-share-chart{height:320px;width:100%}.service-share-empty{min-height:280px;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;color:#657b8b;font-size:13px}@media(max-width:1279px){.movement-details{grid-template-columns:minmax(0,1fr)}.service-share-chart{max-width:480px;margin:0 auto}}
.chart-scroll{height:380px;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#8fb5d1 #edf2f7}.chart-scroll:focus-visible{outline:2px solid rgb(var(--v-theme-primary));outline-offset:-2px}
.movement-charts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:12px}.movement-charts>.chart-card{min-width:0;padding:14px 10px 8px}.movement-charts .chart-heading{min-height:76px;gap:8px;padding-bottom:8px}.movement-charts .chart-heading strong{font-size:14px}.movement-charts .chart-heading small{font-size:11px}.movement-charts .chart-mode{display:flex;min-height:32px;height:32px;margin-bottom:8px}.movement-charts .chart-mode :deep(.v-btn){flex:1;padding:0 8px;font-size:11px}.movement-charts .movement-chart,.movement-charts .service-net-chart{height:380px}@media(max-width:1279px){.movement-charts{grid-template-columns:repeat(2,minmax(0,1fr))}.movement-charts>.service-net-card{grid-column:1/-1}}@media(max-width:899px){.movement-charts{grid-template-columns:minmax(0,1fr)}.movement-charts>.service-net-card{grid-column:auto}}
.movement-context{scroll-margin-top:88px}
.filter-label{font-size:12px;font-weight:600;color:#526a7b}.context-actions{display:flex;flex-wrap:wrap;gap:8px}.chart-heading{min-height:76px}

.movement-dashboard{margin-top:20px}.movement-card{border-radius:12px;background:rgb(var(--v-theme-surface));box-shadow:0 4px 18px rgba(29,61,83,.08)!important}.movement-filters{padding:14px 20px;margin-bottom:18px}.movement-filter-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:10px 0 4px}.movement-context{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:20px 0;color:rgb(var(--v-theme-primary))}.movement-context small{display:block;color:#657b8b;font-size:12px;margin-top:6px}.metric-card{padding:18px 20px;height:100%;border-top:2px solid #e5edf3}.metric-card small{color:#657b8b;font-size:11px;font-weight:700}.metric-card strong{display:block;color:rgb(var(--v-theme-primary));font-size:25px;margin-top:9px}.metric-card p{font-size:12px;color:#657b8b;margin:9px 0 0}.chart-card{height:100%;padding:18px 14px 14px;overflow:hidden}.chart-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:0 7px 12px}.chart-heading strong{font-size:16px}.chart-heading small{display:block;color:#657b8b;font-size:12px;margin-top:6px;line-height:1.6}.chart-mode{margin:0 7px 12px;min-height:36px}.chart-mode :deep(.v-btn){text-transform:none;letter-spacing:0}.movement-chart{height:440px}.detail-card{margin-top:20px;overflow:hidden;padding-top:20px}.detail-card>.chart-heading{padding-left:21px}.table-toolbar{display:flex;align-items:center;gap:20px;padding:2px 21px 18px}.table-toolbar :deep(.v-text-field){max-width:350px}.table-toolbar :deep(.v-switch){flex:0 0 auto}.movement-table :deep(table){border-collapse:separate;border-spacing:0}.movement-table :deep(th){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 7%,rgb(var(--v-theme-surface)))!important;color:rgb(var(--v-theme-primary));font-size:12px;white-space:nowrap}.movement-table :deep(td){font-size:12px;white-space:nowrap}.movement-table :deep(th:first-child){position:sticky;left:0;z-index:3;min-width:210px;box-shadow:2px 0 4px #1d3d5314}.movement-table :deep(td:first-child){position:sticky;left:0;z-index:2;background:rgb(var(--v-theme-surface));min-width:210px;max-width:300px;box-shadow:2px 0 4px #1d3d5314}.movement-table :deep(tbody tr:nth-child(even)){background:rgba(var(--v-theme-primary),.025)}.movement-table :deep(tbody tr:nth-child(even) td:first-child){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 2.5%,rgb(var(--v-theme-surface)))}.unit-button{text-align:left;padding:7px;border-radius:5px;white-space:normal;font-weight:600}.unit-button small{display:block;font-weight:400;color:#657b8b;font-size:11px;margin-top:4px}.unit-button:hover,.unit-button.selected{background:rgba(var(--v-theme-primary),.08);color:rgb(var(--v-theme-primary))}.unit-button:focus-visible{outline:2px solid rgb(var(--v-theme-primary));outline-offset:2px}@media(max-width:700px){.movement-filter-row{grid-template-columns:1fr}.table-toolbar{align-items:stretch;flex-direction:column;gap:8px}.table-toolbar :deep(.v-text-field){max-width:none}.movement-context{align-items:flex-start;flex-direction:column}.chart-heading{min-height:80px}.chart-mode :deep(.v-btn){font-size:11px}.movement-table :deep(td:first-child),.movement-table :deep(th:first-child){min-width:160px;max-width:210px}}
</style>
