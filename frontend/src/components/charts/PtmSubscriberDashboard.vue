<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import VChart from 'vue-echarts'
import type { KpiV2PtmSubscriberRow } from '../../types/kpi'
import { adaptChartOptionForTheme } from '../../utils/chart-theme'
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
const visibleRows = computed(() => props.rows.filter(row => props.scope === 'province'
  ? row.unitCode === '237'
  : row.unitCode !== '237' && row.kpi === props.selectedKpi.replace(/^DTPTM_/, 'SLPTM_') && (!props.unitCode || row.unitCode === props.unitCode))
  .sort((a, b) => (b.monthlyCount ?? -Infinity) - (a.monthlyCount ?? -Infinity) || a.unitName.localeCompare(b.unitName, 'vi')))
const label = (row: KpiV2PtmSubscriberRow) => props.scope === 'province' ? service(row) : row.unitName.replace(/^Trung tâm Viễn thông\s*/i, '')
const movementColor = (change: number | null) => change == null || change === 0 ? '#0789c7'
  : change > 0 ? (theme.global.current.value.dark ? '#6fd7a5' : '#19804d') : (theme.global.current.value.dark ? '#ff8582' : '#c62828')
const option = computed(() => adaptChartOptionForTheme({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(18,92,146,.06)' } }, formatter: (items: Array<{ dataIndex: number }>) => {
    const row = visibleRows.value[items[0]?.dataIndex ?? -1]
    return row ? `${label(row)}<br/>${previousPeriod.value}: ${fmt(row.previousCount)} thuê bao<br/>${period.value}: ${fmt(row.monthlyCount)} thuê bao<br/>Tăng/giảm: ${signed(row.change)} thuê bao` : ''
  } },
  grid: { left: 110, right: 48, top: 10, bottom: 30 },
  xAxis: { type: 'value', minInterval: 1, axisLabel: { formatter: (value: number) => signed(value) }, splitLine: { lineStyle: { color: 'rgba(129,152,173,.15)', type: 'dashed' } } },
  yAxis: { type: 'category', inverse: true, data: visibleRows.value.map(label), axisLabel: { width: 120, overflow: 'truncate' }, axisTick: { show: false } },
  series: [
    { name: 'Tăng/giảm', type: 'bar', barMaxWidth: 20,
      label: { show: true, fontWeight: 700, formatter: ({ value }: { value: number | null }) => signed(value) },
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#8198ad', type: 'solid', width: 1 }, data: [{ xAxis: 0 }] },
      data: visibleRows.value.map((row, rowIndex) => ({ rowIndex, value: row.change,
        itemStyle: { color: movementColor(row.change), borderRadius: row.change != null && row.change < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0] },
        label: { position: row.change != null && row.change < 0 ? 'left' : 'right', color: movementColor(row.change) },
      })),
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
    <v-row v-else>
      <v-col cols="12" lg="6">
        <v-card class="subscriber-panel" elevation="0">
          <h3>Biến động sản lượng PTM · so với tháng {{ previousPeriod }}</h3>
          <p class="movement-note"><span class="increase">Tăng so với tháng trước</span> · <span class="decrease">Giảm so với tháng trước</span></p>
          <VChart :option="option" :style="{ height: `${Math.max(240, visibleRows.length * 36 + 40)}px` }" autoresize @click="selectChart" />
        </v-card>
      </v-col>
      <v-col cols="12" lg="6">
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
.movement-note{text-align:center;font-size:11px;opacity:.8;margin:0 0 12px}.increase{color:rgb(var(--v-theme-success))}.decrease{color:rgb(var(--v-theme-error))}
.ptm-subscribers{padding:0 20px 22px}.section-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0 12px}.section-heading h2{font-size:19px;font-weight:800;color:#d52d31}.section-heading small{margin-left:auto;font-size:12px;opacity:.7}.subscriber-panel{border:1px solid rgba(var(--v-border-color),.12);border-radius:10px;box-shadow:0 2px 5px rgba(18,48,70,.05),0 8px 22px rgba(18,48,70,.10)!important}.subscriber-panel h3{padding:14px;text-align:center;font-size:15px}.count-table :deep(th){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary));font-weight:750;white-space:nowrap}.count-table :deep(td:not(:first-child)),.count-table :deep(th:not(:first-child)){text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.count-table :deep(tbody tr:nth-child(even)){background:rgba(var(--v-theme-primary),.035)}.count-table :deep(.clickable){cursor:pointer}.count-table :deep(.clickable:hover){background:rgba(var(--v-theme-primary),.09)}.count-table :deep(.clickable:focus-visible){outline:2px solid rgb(var(--v-theme-primary));outline-offset:-2px}
</style>
