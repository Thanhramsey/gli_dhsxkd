<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import '../../plugins/echarts'

interface UnitProgress {
  name: string
  plan: number
  actual: number
  rate: number | null
}

const props = defineProps<{ items: UnitProgress[]; loading?: boolean }>()
const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const rateFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const visibleCount = 15
const needsZoom = computed(() => props.items.length > visibleCount)
const endPercent = computed(() => needsZoom.value ? Math.max(5, Math.round(visibleCount / props.items.length * 100)) : 100)
const hasPlans = computed(() => props.items.some((item) => item.plan > 0))
const hasUnplanned = computed(() => props.items.some((item) => item.rate == null))
const rankStops = [
  { position: 0, color: '#159b79' },
  { position: 0.34, color: '#087cba' },
  { position: 0.68, color: '#e5a33a' },
  { position: 1, color: '#e36a5c' },
]

function rankColor(index: number, total: number): string {
  if (total <= 1) return rankStops[0]!.color
  const position = index / (total - 1)
  const upperIndex = rankStops.findIndex((stop) => stop.position >= position)
  if (upperIndex <= 0) return rankStops[0]!.color
  const lower = rankStops[upperIndex - 1]!
  const upper = rankStops[upperIndex]!
  const ratio = (position - lower.position) / (upper.position - lower.position)
  const from = Number.parseInt(lower.color.slice(1), 16)
  const to = Number.parseInt(upper.color.slice(1), 16)
  const channel = (shift: number) => Math.round(((from >> shift) & 255) + ((((to >> shift) & 255) - ((from >> shift) & 255)) * ratio))
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}
function performanceColor(rate: number | null, index: number): string {
  if (rate == null) {
    const unplanned = props.items.filter((item) => item.rate == null)
    const rank = props.items.slice(0, index + 1).filter((item) => item.rate == null).length - 1
    return rankColor(rank, unplanned.length)
  }
  if (rate >= 100) return '#159b79'
  if (rate >= 70) return '#e5a33a'
  return '#e36a5c'
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character)
}

const option = computed(() => ({
  animationDuration: 450,
  grid: { left: 225, right: 82, top: 20, bottom: needsZoom.value ? 32 : 25 },
  xAxis: {
    type: 'value',
    min: 0,
    max: (value: { max: number }) => value.max > 0 ? value.max * 1.17 : 1,
    axisLabel: { color: '#71899b', formatter: (value: number) => numberFormatter.format(value) },
    splitLine: { lineStyle: { color: '#e8eef4', type: 'dashed' } },
  },
  yAxis: {
    type: 'category',
    inverse: true,
    data: props.items.map((item) => item.name),
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { color: '#435a6d', fontSize: 11, fontFamily: 'Be Vietnam Pro', width: 205, overflow: 'truncate' },
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (params: Array<{ dataIndex: number }>) => {
      const item = props.items[params[0]?.dataIndex ?? -1]
      if (!item) return ''
      const percent = item.rate == null ? 'Chưa có kế hoạch' : `${rateFormatter.format(item.rate)}% kế hoạch`
      return `<strong>${escapeHtml(item.name)}</strong><br/>Kế hoạch: ${numberFormatter.format(item.plan)} triệu đồng<br/>Thực hiện: ${numberFormatter.format(item.actual)} triệu đồng<br/><strong>${percent}</strong>`
    },
  },
  dataZoom: needsZoom.value ? [
    { type: 'inside', yAxisIndex: 0, start: 0, end: endPercent.value },
    {
      type: 'slider', yAxisIndex: 0, start: 0, end: endPercent.value,
      width: 9, right: 4, showDetail: false, brushSelect: false,
      borderColor: 'transparent', backgroundColor: '#edf3f7',
      fillerColor: 'rgba(21, 155, 121, .18)', handleSize: 13,
      handleStyle: { color: '#fff', borderColor: '#159b79', borderWidth: 2 },
      moveHandleSize: 0,
    },
  ] : [],
  series: [
    {
      name: 'Kế hoạch', type: 'bar', barWidth: 20, barGap: '-100%', silent: true,
      itemStyle: { color: '#9eb6c9', borderRadius: [0, 5, 5, 0] },
      data: props.items.map((item) => Math.max(0, item.plan)),
    },
    {
      name: 'Thực hiện', type: 'bar', barWidth: 12,
      data: props.items.map((item, index) => ({
        value: Math.max(0, item.actual),
        itemStyle: { color: performanceColor(item.rate, index), borderRadius: [0, 4, 4, 0] },
      })),
      label: {
        show: true, position: 'right', distance: 7, color: '#3d5365', fontSize: 11,
        formatter: (params: { dataIndex: number }) => {
          const rate = props.items[params.dataIndex]?.rate
          return rate == null ? 'Chưa có KH' : `${rateFormatter.format(rate)}%`
        },
      },
    },
  ],
}))
</script>

<template>
  <div class="progress-chart">
    <div class="chart-legend" aria-label="Chú giải biểu đồ">
      <span v-if="hasPlans"><i class="plan-swatch" />Kế hoạch</span>
      <span><i class="actual-swatch" :class="{ 'rank-swatch': !hasPlans }" />Thực hiện</span>
      <span v-if="hasPlans" class="legend-note">Có KH: xanh ≥100% · vàng 70–99% · đỏ &lt;70%; số cuối thanh là % hoàn thành</span>
      <span v-if="hasUnplanned" class="legend-note"><i v-if="hasPlans" class="rank-swatch" />Chưa có KH: màu theo thứ hạng doanh thu, không phải % hoàn thành</span>
    </div>
    <v-chart class="chart-canvas" :option="option" :update-options="{ replaceMerge: ['series'] }" :loading="loading" autoresize />
  </div>
</template>

<style scoped>
.progress-chart{width:100%}.chart-legend{display:flex;align-items:center;flex-wrap:wrap;gap:14px;margin:8px 10px 0;color:#526a7b;font-size:11px}.chart-legend span{display:inline-flex;align-items:center;gap:5px}.chart-legend i{display:inline-block;width:16px;height:9px;border-radius:3px}.plan-swatch{background:#9eb6c9}.actual-swatch{background:linear-gradient(90deg,#e36a5c 0 33%,#e5a33a 33% 66%,#159b79 66%)}.rank-swatch{background:linear-gradient(90deg,#159b79,#087cba,#e5a33a,#e36a5c)}.legend-note{color:#78909f}.chart-canvas{width:100%;height:410px}
</style>
