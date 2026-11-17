<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { useTheme } from 'vuetify'
import type { KpiFiberPscRow } from '../../types/kpi'
import { adaptChartOptionForTheme } from '../../utils/chart-theme'
import '../../plugins/echarts'

const props = defineProps<{ rows: KpiFiberPscRow[]; month: string }>()
const theme = useTheme()
const period = ref<'month' | 'cumulative'>('month')
const chartMode = ref<'rate' | 'value'>('rate')
const subscriberMetric = ref<'psc' | 'net'>('psc')
const selectedCode = ref<string | null>(null)
const search = ref('')
const revenueDescending = ref(true)
const subscriberDescending = ref(true)
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const format = (value: number | null | undefined) => value == null ? '—' : nf.format(value)
const percent = (value: number | null | undefined) => value == null ? '—' : `${nf.format(value)}%`
const revenue = (value: number | null | undefined) => value == null ? '—' : `${nf.format(value / 1_000_000)} triệu đồng`
const rate = (actual: number | null, plan: number | null) => plan != null && plan > 0 && actual != null ? actual / plan * 100 : null
const periodLabel = computed(() => `${period.value === 'month' ? 'Tháng' : 'Lũy kế đến tháng'} ${Number(props.month.slice(5))}/${props.month.slice(0, 4)}`)

const provinceRows = computed(() => props.rows.filter(row => row.unitGroup === 'TOANTINH'))
const province = computed(() => provinceRows.value.length === 1 ? provinceRows.value[0] : null)
const units = computed(() => props.rows.filter(row => row.unitGroup === 'TTVT'))
const unknownGroups = computed(() => props.rows.filter(row => !['TOANTINH', 'TTVT'].includes(row.unitGroup)).length)
const duplicateUnits = computed(() => new Set(units.value.map(row => row.unitCode)).size !== units.value.length)
const selected = computed(() => units.value.find(row => row.unitCode === selectedCode.value) ?? null)
const current = computed(() => selected.value ?? province.value)
const monthlyRate = computed(() => rate(current.value?.monthlyRevenue ?? null, current.value?.monthlyRevenuePlan ?? null))
const cumulativeRate = computed(() => rate(current.value?.cumulativeRevenue ?? null, current.value?.cumulativeRevenuePlan ?? null))
const annualRate = computed(() => rate(current.value?.cumulativeRevenue ?? null, current.value?.annualRevenuePlan ?? null))
const chartRevenue = (row: KpiFiberPscRow) => period.value === 'month' ? row.monthlyRevenue : row.cumulativeRevenue
const chartPlan = (row: KpiFiberPscRow) => period.value === 'month' ? row.monthlyRevenuePlan : row.cumulativeRevenuePlan

function rateColor(value: number | null) {
  if (value == null) return theme.global.current.value.dark ? '#b5c7d5' : '#718397'
  if (value < 70) return theme.global.current.value.dark ? '#f16e6b' : '#c62828'
  if (value < 90) return theme.global.current.value.dark ? '#e7b052' : '#a66b00'
  if (value < 100) return theme.global.current.value.dark ? '#63c6f1' : '#0067b1'
  return theme.global.current.value.dark ? '#58ca97' : '#218349'
}

const filteredUnits = computed(() => units.value.filter(row => row.unitName.toLocaleLowerCase('vi').includes(search.value.trim().toLocaleLowerCase('vi'))))
const chartRows = computed(() => [...filteredUnits.value].sort((a, b) => {
  const left = chartMode.value === 'rate' ? rate(chartRevenue(a), chartPlan(a)) : chartRevenue(a)
  const right = chartMode.value === 'rate' ? rate(chartRevenue(b), chartPlan(b)) : chartRevenue(b)
  if (left == null) return right == null ? a.unitName.localeCompare(b.unitName, 'vi') : 1
  if (right == null) return -1
  return (revenueDescending.value ? right - left : left - right) || a.unitName.localeCompare(b.unitName, 'vi')
}))
const shortName = (name: string) => name.replace(/^Trung tâm Viễn thông\s*/i, '')

const revenueOption = computed(() => {
  const rows = chartRows.value
  const showRate = chartMode.value === 'rate'
  return adaptChartOptionForTheme({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, renderMode: 'richText', confine: true,
      formatter: (items: Array<{ dataIndex: number }>) => {
        const row = rows[items[0]?.dataIndex ?? -1]
        return row ? `${row.unitName}\n${periodLabel.value}\nKế hoạch: ${revenue(chartPlan(row))}\nThực hiện: ${revenue(chartRevenue(row))}\nHoàn thành: ${percent(rate(chartRevenue(row), chartPlan(row)))}` : ''
      },
    },
    legend: showRate ? { show: false } : { top: 0, selectedMode: false },
    grid: { left: 122, right: 105, top: showRate ? 14 : 38, bottom: 36 },
    xAxis: { type: 'value', min: 0, axisLabel: { formatter: (value: number) => showRate ? `${nf.format(value)}%` : nf.format(value / 1_000_000) }, splitLine: { lineStyle: { color: '#e6edf4' } } },
    yAxis: { type: 'category', inverse: true, data: rows.map(row => shortName(row.unitName)), axisTick: { show: false }, axisLabel: { width: 110, overflow: 'truncate' } },
    series: showRate ? [{ type: 'bar', name: 'Hoàn thành', barMaxWidth: 23,
      data: rows.map(row => ({ value: rate(chartRevenue(row), chartPlan(row)), itemStyle: { color: rateColor(rate(chartRevenue(row), chartPlan(row))), opacity: selectedCode.value && selectedCode.value !== row.unitCode ? .42 : 1, borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: ({ value }: { value: number | null }) => percent(value) },
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#7e92a5', type: 'dashed' }, data: [{ xAxis: 100 }] },
    }] : [
      { type: 'bar', name: 'Kế hoạch', barMaxWidth: 13, itemStyle: { color: '#8eabc2', borderRadius: 3 }, data: rows.map(row => ({ value: chartPlan(row), itemStyle: { opacity: selectedCode.value && selectedCode.value !== row.unitCode ? .42 : 1 } })) },
      { type: 'bar', name: 'Thực hiện', barMaxWidth: 13, itemStyle: { color: '#008ac4', borderRadius: 3 }, data: rows.map(row => ({ value: chartRevenue(row), itemStyle: { opacity: selectedCode.value && selectedCode.value !== row.unitCode ? .42 : 1 } })) },
    ],
  }, theme.global.current.value.dark)
})

const subscriberValue = (row: KpiFiberPscRow) => subscriberMetric.value === 'psc' ? row.monthlyPscSubscribers : row.monthlyNetPscSubscribers
const subscriberRows = computed(() => [...filteredUnits.value].sort((a, b) => {
  const left = subscriberValue(a), right = subscriberValue(b)
  if (left == null) return right == null ? a.unitName.localeCompare(b.unitName, 'vi') : 1
  if (right == null) return -1
  return (subscriberDescending.value ? right - left : left - right) || a.unitName.localeCompare(b.unitName, 'vi')
}))
const subscriberOption = computed(() => {
  const rows = subscriberRows.value
  const showNet = subscriberMetric.value === 'net'
  return adaptChartOptionForTheme({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, renderMode: 'richText', confine: true,
      formatter: (items: Array<{ dataIndex: number }>) => {
        const row = rows[items[0]?.dataIndex ?? -1]
        return row ? `${row.unitName}\nThuê bao PSC: ${format(row.monthlyPscSubscribers)}\nThuê bao PSC thực tăng: ${format(row.monthlyNetPscSubscribers)}` : ''
      },
    },
    grid: { left: 122, right: 75, top: 14, bottom: 36 },
    xAxis: { type: 'value', axisLabel: { formatter: (value: number) => nf.format(value) }, splitLine: { lineStyle: { color: '#e6edf4' } } },
    yAxis: { type: 'category', inverse: true, data: rows.map(row => shortName(row.unitName)), axisTick: { show: false }, axisLabel: { width: 110, overflow: 'truncate' } },
    series: [{ name: showNet ? 'PSC thực tăng' : 'Thuê bao PSC', type: 'bar', barMaxWidth: 23,
      data: rows.map(row => ({ value: subscriberValue(row), itemStyle: {
        color: showNet ? '#20a28e' : '#008ac4',
        opacity: selectedCode.value && selectedCode.value !== row.unitCode ? .42 : 1,
        borderRadius: (subscriberValue(row) ?? 0) < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0],
      }, label: { position: (subscriberValue(row) ?? 0) < 0 ? 'left' : 'right' } })),
      label: { show: true, formatter: ({ value }: { value: number | null }) => format(value) },
    }],
  }, theme.global.current.value.dark)
})

function selectUnit(event: { dataIndex?: number }, rows: KpiFiberPscRow[]) {
  const row = rows[event.dataIndex ?? -1]
  if (row) selectedCode.value = selectedCode.value === row.unitCode ? null : row.unitCode
}
watch(() => props.rows, () => { selectedCode.value = null })

const tableRows = computed(() => filteredUnits.value.map(row => ({
  ...row,
  monthlyRate: rate(row.monthlyRevenue, row.monthlyRevenuePlan),
  cumulativeRate: rate(row.cumulativeRevenue, row.cumulativeRevenuePlan),
  annualRate: rate(row.cumulativeRevenue, row.annualRevenuePlan),
})))
const headers = [
  { title: 'Đơn vị', key: 'unitName', fixed: 'start' as const, width: 220 },
  { title: 'TB PSC tháng', key: 'monthlyPscSubscribers', align: 'end' as const },
  { title: 'TB PSC thực tăng', key: 'monthlyNetPscSubscribers', align: 'end' as const },
  { title: 'DT tháng', key: 'monthlyRevenue', align: 'end' as const },
  { title: 'KH tháng', key: 'monthlyRevenuePlan', align: 'end' as const },
  { title: 'HT tháng', key: 'monthlyRate', align: 'end' as const },
  { title: 'DT lũy kế', key: 'cumulativeRevenue', align: 'end' as const },
  { title: 'KH lũy kế', key: 'cumulativeRevenuePlan', align: 'end' as const },
  { title: 'HT lũy kế', key: 'cumulativeRate', align: 'end' as const },
  { title: 'KH năm', key: 'annualRevenuePlan', align: 'end' as const },
  { title: 'LK / KH năm', key: 'annualRate', align: 'end' as const },
]
</script>

<template>
  <section class="fiber-psc">
    <v-alert v-if="!rows.length" type="info" variant="tonal">Không có dữ liệu phát sinh cước Fiber trong {{ periodLabel.toLowerCase() }}.</v-alert>
    <template v-else>
      <div class="section-heading">
        <div><h2>{{ selected?.unitName ?? 'Tổng quan toàn tỉnh' }}</h2><small>Doanh thu và thuê bao tháng {{ Number(month.slice(5)) }}/{{ month.slice(0, 4) }} · Chọn một cột biểu đồ để xem đơn vị</small></div>
        <div class="heading-actions"><v-btn v-if="selected" size="small" color="primary" variant="tonal" prepend-icon="mdi-close-circle-outline" @click="selectedCode = null">Xem toàn tỉnh</v-btn></div>
      </div>
      <v-alert v-if="provinceRows.length !== 1" class="mb-4" type="warning" variant="tonal" density="compact">Dữ liệu toàn tỉnh {{ provinceRows.length ? 'bị trùng' : 'chưa có' }}; không cộng các đơn vị để thay thế.</v-alert>
      <v-alert v-if="unknownGroups || duplicateUnits" class="mb-4" type="warning" variant="tonal" density="compact">{{ unknownGroups ? `${unknownGroups} dòng có nhóm đơn vị chưa hỗ trợ. ` : '' }}{{ duplicateUnits ? 'Có mã đơn vị TTVT bị trùng; vui lòng kiểm tra nguồn dữ liệu.' : '' }}</v-alert>
      <v-row class="summary-grid">
        <v-col cols="12" sm="6" xl="3"><v-card class="summary-card" elevation="0"><small>DOANH THU THÁNG</small><strong>{{ revenue(current?.monthlyRevenue) }}</strong><span>KH tháng: {{ revenue(current?.monthlyRevenuePlan) }}</span><b class="summary-rate" :style="{ color: rateColor(monthlyRate) }">Hoàn thành {{ percent(monthlyRate) }}</b></v-card></v-col>
        <v-col cols="12" sm="6" xl="3"><v-card class="summary-card" elevation="0"><small>DOANH THU LŨY KẾ</small><strong>{{ revenue(current?.cumulativeRevenue) }}</strong><span>KH lũy kế: {{ revenue(current?.cumulativeRevenuePlan) }}</span><b class="summary-rate" :style="{ color: rateColor(cumulativeRate) }">Hoàn thành {{ percent(cumulativeRate) }}</b></v-card></v-col>
        <v-col cols="12" sm="6" xl="3"><v-card class="summary-card" elevation="0"><small>TIẾN ĐỘ KẾ HOẠCH NĂM</small><strong :style="{ color: rateColor(annualRate) }">{{ percent(annualRate) }}</strong><span>DT lũy kế: {{ revenue(current?.cumulativeRevenue) }}</span><span>KH năm: {{ revenue(current?.annualRevenuePlan) }}</span></v-card></v-col>
        <v-col cols="12" sm="6" xl="3"><v-card class="summary-card" elevation="0"><small>THUÊ BAO PSC THÁNG</small><strong>{{ format(current?.monthlyPscSubscribers) }}</strong><span>PSC thực tăng: {{ format(current?.monthlyNetPscSubscribers) }} thuê bao</span></v-card></v-col>
      </v-row>
      <v-card class="panel" elevation="0">
        <div class="panel-toolbar"><div><h3>So sánh Trung tâm Viễn thông</h3><small>{{ filteredUnits.length }} đơn vị · doanh thu tính bằng đồng</small></div><div class="panel-actions"><v-text-field v-model="search" label="Tìm đơn vị" prepend-inner-icon="mdi-magnify" clearable density="compact" variant="outlined" hide-details /></div></div>
        <v-alert v-if="!filteredUnits.length" type="info" variant="tonal" class="ma-4">Không có đơn vị phù hợp.</v-alert>
        <v-row v-else class="chart-grid">
          <v-col cols="12" lg="6"><div class="chart-panel"><div class="subscriber-heading"><h4>Doanh thu {{ period === 'month' ? 'tháng' : 'lũy kế' }} · {{ chartMode === 'rate' ? 'tỷ lệ hoàn thành' : 'kế hoạch và thực hiện' }}</h4><div class="chart-actions"><v-btn-toggle v-model="period" mandatory density="compact" variant="tonal" color="primary" aria-label="Kỳ doanh thu trên biểu đồ"><v-btn value="month" size="small">Trong tháng</v-btn><v-btn value="cumulative" size="small">Lũy kế</v-btn></v-btn-toggle><v-btn :icon="revenueDescending ? 'mdi-sort-descending' : 'mdi-sort-ascending'" size="small" variant="tonal" color="primary" :title="`Doanh thu: đang xếp ${revenueDescending ? 'giảm' : 'tăng'} dần. Bấm để đảo chiều`" :aria-label="`Sắp xếp doanh thu ${revenueDescending ? 'tăng' : 'giảm'} dần`" @click="revenueDescending = !revenueDescending" /></div></div><div class="chart-mode"><v-btn-toggle v-model="chartMode" mandatory density="compact" variant="tonal" color="primary" aria-label="Cách so sánh doanh thu"><v-btn value="rate" size="small">Hoàn thành (%)</v-btn><v-btn value="value" size="small">Kế hoạch / thực hiện</v-btn></v-btn-toggle></div><div class="chart-scroll"><VChart class="chart" :style="{ height: `${Math.max(410, chartRows.length * (chartMode === 'rate' ? 34 : 42) + 78)}px` }" :option="revenueOption" autoresize @click="selectUnit($event, chartRows)" /></div></div></v-col>
          <v-col cols="12" lg="6"><div class="chart-panel"><div class="subscriber-heading"><h4>Thuê bao phát sinh cước · trong tháng</h4><div class="chart-actions"><v-btn-toggle v-model="subscriberMetric" mandatory density="compact" variant="tonal" color="primary" aria-label="Chỉ tiêu thuê bao trên biểu đồ"><v-btn value="psc" size="small">Thuê bao PSC</v-btn><v-btn value="net" size="small">PSC thực tăng</v-btn></v-btn-toggle><v-btn :icon="subscriberDescending ? 'mdi-sort-descending' : 'mdi-sort-ascending'" size="small" variant="tonal" color="primary" :title="`Thuê bao: đang xếp ${subscriberDescending ? 'giảm' : 'tăng'} dần. Bấm để đảo chiều`" :aria-label="`Sắp xếp thuê bao ${subscriberDescending ? 'tăng' : 'giảm'} dần`" @click="subscriberDescending = !subscriberDescending" /></div></div><div class="chart-scroll"><VChart class="chart" :option="subscriberOption" :style="{ height: `${Math.max(410, subscriberRows.length * 34 + 60)}px` }" autoresize @click="selectUnit($event, subscriberRows)" /></div></div></v-col>
        </v-row>
      </v-card>
      <v-card class="panel table-panel" elevation="0"><div class="table-heading"><h3>Chi tiết phát sinh cước Fiber theo đơn vị</h3><small>Đơn vị doanh thu: đồng · chọn tiêu đề cột để sắp xếp</small></div><v-data-table :headers="headers" :items="tableRows" item-value="unitCode" :sort-by="[{ key: 'monthlyRevenue', order: 'desc' }]" :items-per-page="20" :items-per-page-options="[20, 50, 100, 200, 500]" density="comfortable" hover class="psc-table">
        <template #item.unitName="{ item }"><v-btn variant="text" color="primary" size="small" class="unit-link" @click="selectedCode = selectedCode === item.unitCode ? null : item.unitCode">{{ item.unitName }}</v-btn></template>
        <template v-for="key in ['monthlyPscSubscribers', 'monthlyNetPscSubscribers', 'monthlyRevenue', 'monthlyRevenuePlan', 'cumulativeRevenue', 'cumulativeRevenuePlan', 'annualRevenuePlan']" :key="key" #[`item.${key}`]="{ value }">{{ format(value) }}</template>
        <template v-for="key in ['monthlyRate', 'cumulativeRate', 'annualRate']" :key="key" #[`item.${key}`]="{ value }"><strong :style="{ color: rateColor(value) }">{{ percent(value) }}</strong></template>
      </v-data-table></v-card>
    </template>
  </section>
</template>

<style scoped>
.fiber-psc{margin-top:22px}.section-heading,.panel-toolbar,.table-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.section-heading{margin-bottom:16px}.section-heading h2{font-size:19px}.section-heading small,.panel-toolbar small,.table-heading small{display:block;margin-top:4px;color:rgb(var(--v-theme-on-surface));opacity:.7}.heading-actions,.panel-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.panel-actions .v-text-field{min-width:190px;max-width:240px}.fiber-psc :deep(.v-btn){text-transform:none;letter-spacing:0}.summary-card,.panel{border-radius:12px;background:rgb(var(--v-theme-surface));box-shadow:0 4px 18px rgba(29,61,83,.08)!important}.summary-card{height:100%;min-height:148px;padding:20px 22px;border-top:3px solid #008ac4;display:flex;flex-direction:column;gap:8px}.summary-card small{font-size:12px;font-weight:700;letter-spacing:.04em;opacity:.75}.summary-card strong{font-size:23px;line-height:1.2}.summary-card span{font-size:13px;opacity:.75}.panel{margin-top:20px}.panel-toolbar,.table-heading{padding:18px 20px}.panel h3{font-size:16px}.chart-grid{margin:0;padding:0 8px 14px}.chart-panel{height:100%;border:1px solid rgba(var(--v-border-color),.22);border-radius:10px;padding:14px 12px}.chart-panel h4{font-size:14px;margin:0 0 8px 6px}.chart-scroll{max-height:650px;overflow:auto;scrollbar-width:thin;scrollbar-color:#aac7d8 transparent}.chart{width:100%;min-width:430px}.psc-table{border-top:1px solid rgba(var(--v-border-color),.2)}.psc-table :deep(th){white-space:nowrap}.psc-table :deep(td){white-space:nowrap}.unit-link{padding-inline:0;justify-content:flex-start;max-width:220px;overflow:hidden;text-overflow:ellipsis}.table-panel{overflow:hidden}@media(max-width:700px){.section-heading,.panel-toolbar{align-items:flex-start;flex-direction:column}.panel-actions{width:100%}.panel-actions .v-text-field{max-width:none;width:100%}.summary-card{min-height:130px}}
.subscriber-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 6px 8px}.subscriber-heading h4{margin:0}.subscriber-heading :deep(.v-btn){font-size:12px}
.chart-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.chart-mode{margin:0 6px 8px}
.summary-rate{font-size:14px;font-weight:700;margin-top:auto}
</style>
