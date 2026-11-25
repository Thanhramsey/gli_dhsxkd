<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import VChart from 'vue-echarts'
import type { KpiV2PtmSubscriberRow } from '../../types/kpi'
import { adaptChartOptionForTheme } from '../../utils/chart-theme'
import { ptmChangeRate, summarizePtmSubscribers } from '../../utils/ptm-subscriber-summary'
import '../../plugins/echarts'

const props = defineProps<{
  rows: KpiV2PtmSubscriberRow[]
  month: string
  scope: 'province' | 'unit'
  unitCode: string | null
  selectedKpi: string
}>()
const emit = defineEmits<{ selectUnit: [code: string | null] }>()
const theme = useTheme()
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const fmt = (value: number | null) => value == null ? '—' : nf.format(value)
const signed = (value: number | null) => value == null ? '—' : `${value > 0 ? '+' : ''}${fmt(value)}`
const changeColor = (value: number | null) => value == null || value === 0 ? undefined : value > 0 ? 'success' : 'error'
const period = computed(() => `${props.month.slice(5)}/${props.month.slice(0, 4)}`)
const previousPeriod = computed(() => {
  const [year, month] = props.month.split('-').map(Number)
  return month === 1 ? `12/${year! - 1}` : `${String(month! - 1).padStart(2, '0')}/${year}`
})
const service = (row: KpiV2PtmSubscriberRow) => row.kpi.replace(/^SLPTM_/, '').replaceAll('_', ' ')
const chartTitle = computed(() => props.scope === 'province'
  ? 'Sản lượng PTM theo dịch vụ'
  : `Sản lượng PTM ${props.selectedKpi.replace(/^DTPTM_/, '').replaceAll('_', ' ')}`)
const visibleRows = computed(() => props.rows.filter(row => props.scope === 'province'
  ? row.unitCode === '237'
  : row.unitCode !== '237' && row.kpi === props.selectedKpi.replace(/^DTPTM_/, 'SLPTM_') && (!props.unitCode || row.unitCode === props.unitCode))
  .sort((a, b) => (b.monthlyCount ?? -Infinity) - (a.monthlyCount ?? -Infinity) || a.unitName.localeCompare(b.unitName, 'vi')))
const label = (row: KpiV2PtmSubscriberRow) => props.scope === 'province' ? service(row) : row.unitName.replace(/^Trung tâm Viễn thông\s*/i, '')
const highlights = computed(() => summarizePtmSubscribers(visibleRows.value))
const percentFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const signedPercent = (value: number | null) => value == null ? '—' : `${value > 0 ? '+' : ''}${percentFormat.format(value)}%`
const option = computed(() => adaptChartOptionForTheme({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(18,92,146,.06)' } }, formatter: (items: Array<{ dataIndex: number }>) => {
    const row = visibleRows.value[items[0]?.dataIndex ?? -1]
    return row ? `${label(row)}<br/>${previousPeriod.value}: ${fmt(row.previousCount)} thuê bao<br/>${period.value}: ${fmt(row.monthlyCount)} thuê bao<br/>Tăng/giảm: ${signed(row.change)} thuê bao` : ''
  } },
  legend: { top: 0, selectedMode: false },
  grid: { left: 125, right: 48, top: 38, bottom: 30 },
  xAxis: { type: 'value', min: 0, minInterval: 1, axisLabel: { formatter: (value: number) => fmt(value) }, splitLine: { lineStyle: { color: 'rgba(129,152,173,.15)', type: 'dashed' } } },
  yAxis: { type: 'category', inverse: true, data: visibleRows.value.map(label), axisLabel: { width: 120, overflow: 'truncate' }, axisTick: { show: false } },
  series: [
    { name: previousPeriod.value, type: 'bar', barMaxWidth: 15,
      itemStyle: { color: '#e9a23b', borderRadius: [0, 3, 3, 0] },
      label: { show: true, position: 'right', formatter: ({ value }: { value: number | null }) => fmt(value) },
      data: visibleRows.value.map((row, rowIndex) => ({ rowIndex, value: row.previousCount })),
    },
    { name: period.value, type: 'bar', barMaxWidth: 15,
      itemStyle: { color: '#0789c7', borderRadius: [0, 3, 3, 0] },
      label: { show: true, position: 'right', formatter: ({ value }: { value: number | null }) => fmt(value) },
      data: visibleRows.value.map((row, rowIndex) => ({ rowIndex, value: row.monthlyCount })),
    },
  ],
}, theme.global.current.value.dark))
function selectRow(row: KpiV2PtmSubscriberRow | undefined) {
  if (props.scope === 'unit' && row) emit('selectUnit', props.unitCode === row.unitCode ? null : row.unitCode)
}
function selectChart(event: unknown) {
  const index = (event as { data?: { rowIndex?: number } }).data?.rowIndex
  if (index != null) selectRow(visibleRows.value[index])
}
</script>

<template>
  <section class="ptm-subscribers">
    <div class="section-heading">
      <h2>2. SẢN LƯỢNG PHÁT TRIỂN MỚI {{ scope === 'province' ? 'TOÀN TỈNH' : 'ĐỊA BÀN CẤP 2' }}</h2>
      <v-btn v-if="scope === 'unit' && unitCode" variant="tonal" color="primary" size="small" prepend-icon="mdi-arrow-left" @click="emit('selectUnit', null)">Xem tất cả địa bàn</v-btn>
      <small>Tháng {{ period }} · đơn vị: thuê bao</small>
    </div>
    <v-alert v-if="!visibleRows.length" type="info" variant="tonal" density="compact">Chưa có sản lượng PTM {{ scope === 'unit' ? selectedKpi.replace(/^DTPTM_/, '') : '' }} cho bộ lọc đang chọn.</v-alert>
    <v-row v-if="visibleRows.length">
      <v-col cols="12" lg="6" class="chart-column">
        <v-card class="subscriber-panel comparison-panel" elevation="0">
          <h3>{{ chartTitle }} · so với tháng {{ previousPeriod }}</h3>
          <VChart class="comparison-chart" :option="option" :style="{ minHeight: `${Math.max(260, visibleRows.length * 48 + 70)}px` }" autoresize @click="selectChart" />
        </v-card>
      </v-col>
      <v-col cols="12" lg="6" class="details-column">
         <v-card class="subscriber-panel highlights" elevation="0">
          <div class="highlights-heading"><v-icon icon="mdi-chart-box-outline" color="primary" size="20" /><h3>Tháng {{ period }}</h3><small>{{ scope === 'province' ? 'Theo dịch vụ' : selectedKpi.replace(/^DTPTM_/, '').replaceAll('_', ' ') }}</small></div>
          <v-list class="highlights-list" bg-color="transparent" lines="two">
            <v-list-item>
              <template #prepend><v-icon icon="mdi-account-multiple-outline" color="primary" size="21" /></template>
              <v-list-item-title>Tổng PTM <strong class="text-primary">{{ fmt(highlights.total) }} <small>thuê bao</small></strong></v-list-item-title>
              <v-list-item-subtitle><span :class="changeColor(highlights.change) ? `text-${changeColor(highlights.change)}` : undefined"><v-icon v-if="highlights.change" :icon="highlights.change > 0 ? 'mdi-arrow-top-right' : 'mdi-arrow-bottom-right'" size="15" />{{ signed(highlights.change) }} <template v-if="highlights.rate != null">({{ signedPercent(highlights.rate) }})</template></span> so với {{ previousPeriod }}<template v-if="highlights.previous === 0 && (highlights.total ?? 0) > 0"> · từ nền 0</template></v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <template #prepend><v-icon icon="mdi-trending-up" color="success" size="21" /></template>
              <v-list-item-title>Tăng mạnh nhất <strong :class="{ 'text-success': highlights.top }">{{ highlights.top ? label(highlights.top) : '—' }}</strong></v-list-item-title>
              <v-list-item-subtitle class="text-success">{{ highlights.top ? `${signed(highlights.top.change)} thuê bao` : 'Không có số liệu tăng' }}<template v-if="highlights.top && ptmChangeRate(highlights.top) != null"> ({{ signedPercent(ptmChangeRate(highlights.top)) }})</template></v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <template #prepend><v-icon icon="mdi-trending-down" color="error" size="21" /></template>
              <v-list-item-title>Giảm mạnh nhất theo % <strong :class="{ 'text-error': highlights.bottom }">{{ highlights.bottom ? label(highlights.bottom) : '—' }}</strong></v-list-item-title>
              <v-list-item-subtitle class="text-error">{{ highlights.bottom ? `${signed(highlights.bottom.change)} thuê bao (${signedPercent(ptmChangeRate(highlights.bottom))})` : 'Không có số liệu giảm để tính tỷ lệ' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <template #prepend><v-icon icon="mdi-format-list-checks" color="primary" size="21" /></template>
              <v-list-item-title>{{ scope === 'province' ? 'Tình hình dịch vụ' : 'Tình hình đơn vị' }}</v-list-item-title>
              <v-list-item-subtitle><b class="text-success">{{ highlights.increased }} đơn vị tăng</b><span class="status-separator">·</span><b class="text-error">{{ highlights.decreased }} đơn vị giảm</b><span class="status-separator">·</span>{{ highlights.unchanged }} đơn vị giữ nguyên<template v-if="highlights.missing"> · {{ highlights.missing }} chưa đủ dữ liệu</template></v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
        <v-table class="subscriber-panel count-table" density="compact">
          <thead><tr><th>{{ scope === 'province' ? 'Dịch vụ' : 'Địa bàn' }}</th><th>{{ previousPeriod }}</th><th>{{ period }}</th><th>Tăng/giảm</th><th>TH lũy kế</th></tr></thead>
          <tbody><tr v-for="row in visibleRows" :key="`${row.kpi}|${row.unitCode}`" :class="{ clickable: scope === 'unit' }" :tabindex="scope === 'unit' ? 0 : undefined" @click="selectRow(row)" @keydown.enter.prevent="selectRow(row)" @keydown.space.prevent="selectRow(row)">
            <td>{{ label(row) }}</td><td>{{ fmt(row.previousCount) }}</td><td><strong>{{ fmt(row.monthlyCount) }}</strong></td>
            <td :class="changeColor(row.change) ? `text-${changeColor(row.change)}` : undefined"><v-icon v-if="row.change" :icon="row.change > 0 ? 'mdi-arrow-top-right' : 'mdi-arrow-bottom-right'" size="14" />{{ signed(row.change) }}</td><td>{{ fmt(row.cumulativeCount) }}</td>
          </tr></tbody>
        </v-table>
       
      </v-col>
    </v-row>
  </section>
</template>

<style scoped>
.details-column>.highlights{flex:1;display:flex;flex-direction:column}.highlights-list{flex:1;display:flex;flex-direction:column}.highlights-list :deep(.v-list-item){flex:1}
.chart-column{display:flex}.comparison-panel{display:flex;flex-direction:column;flex:1;min-width:0}.comparison-chart{height:0;flex:1;width:100%}.details-column{display:flex;flex-direction:column;gap:16px}.details-column>.count-table{flex:0 0 auto}.details-column>.highlights{margin-top:0}.highlights .highlights-heading{margin:0 -16px;padding:14px 16px;background:rgba(var(--v-theme-primary),.1);border-bottom:1px solid rgba(var(--v-theme-primary),.15)}.highlights .highlights-heading h3{color:rgb(var(--v-theme-primary));font-weight:800}.highlights-heading>:deep(.v-icon){padding:8px;box-sizing:content-box;border-radius:8px;background:rgba(var(--v-theme-primary),.12)}.highlights .highlights-heading>small{padding:4px 8px;border-radius:5px;background:rgba(var(--v-theme-primary),.12);color:rgb(var(--v-theme-primary));font-weight:700;opacity:1}
.highlights{margin-top:16px;padding:0 16px 4px}.highlights-heading{display:flex;align-items:center;gap:8px;padding:14px 0 10px;border-bottom:1px solid rgba(var(--v-border-color),.12)}.highlights-heading h3{padding:0;text-align:left;font-size:15px}.highlights-heading>small{margin-left:auto;font-size:11px;opacity:.65}.highlights-list{padding:2px 0}.highlights-list :deep(.v-list-item){padding:10px 0;min-height:62px}.highlights-list :deep(.v-list-item:not(:last-child)){border-bottom:1px solid rgba(var(--v-border-color),.1)}.highlights-list :deep(.v-list-item__prepend){width:34px}.highlights-list :deep(.v-list-item__spacer){width:12px}.highlights-list :deep(.v-list-item-title){display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12px;white-space:normal}.highlights-list :deep(.v-list-item-title strong){font-size:15px;font-weight:750;text-align:right;font-variant-numeric:tabular-nums}.highlights-list :deep(.v-list-item-title strong small){font-size:11px;font-weight:500}.highlights-list :deep(.v-list-item-subtitle){margin-top:4px;font-size:11px;line-height:1.6;opacity:1;white-space:normal;-webkit-line-clamp:unset}.status-separator{padding:0 8px;opacity:.45}
.ptm-subscribers{padding:0 20px 22px}.section-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0 12px}.section-heading h2{font-size:19px;font-weight:800;color:#d52d31}.section-heading small{margin-left:auto;font-size:12px;opacity:.7}.subscriber-panel{border:1px solid rgba(var(--v-border-color),.12);border-radius:10px;box-shadow:0 2px 5px rgba(18,48,70,.05),0 8px 22px rgba(18,48,70,.10)!important}.subscriber-panel h3{padding:14px;text-align:center;font-size:15px}.count-table :deep(th){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary));font-weight:750;white-space:nowrap}.count-table :deep(td:not(:first-child)),.count-table :deep(th:not(:first-child)){text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.count-table :deep(tbody tr:nth-child(even)){background:rgba(var(--v-theme-primary),.035)}.count-table :deep(.clickable){cursor:pointer}.count-table :deep(.clickable:hover){background:rgba(var(--v-theme-primary),.09)}.count-table :deep(.clickable:focus-visible){outline:2px solid rgb(var(--v-theme-primary));outline-offset:-2px}
</style>
