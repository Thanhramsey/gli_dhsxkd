<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import '../../plugins/echarts'

const props = defineProps<{
  categories: string[]
  values: number[]
  seriesName: string
  orientation: 'vertical' | 'horizontal'
  loading?: boolean
}>()

const numberFormatter = new Intl.NumberFormat('vi-VN')
const rankColorStops = [
  { position: 0, color: '#169b72' },
  { position: 0.34, color: '#078bc8' },
  { position: 0.68, color: '#f2b134' },
  { position: 1, color: '#df4d4d' },
]
const preferredItems = computed(() => props.orientation === 'vertical' ? 18 : 16)
const needsZoom = computed(() => props.categories.length > preferredItems.value)
const visiblePercent = computed(() => {
  return needsZoom.value
    ? Math.max(5, Math.round((preferredItems.value / props.categories.length) * 100))
    : 100
})

function rankColor(index: number, total: number): string {
  if (total <= 1) return rankColorStops[0]!.color
  const position = index / (total - 1)
  const upperIndex = rankColorStops.findIndex((stop) => stop.position >= position)
  if (upperIndex <= 0) return rankColorStops[0]!.color
  const lower = rankColorStops[upperIndex - 1]!
  const upper = rankColorStops[upperIndex]!
  const ratio = (position - lower.position) / (upper.position - lower.position)
  return interpolateHex(lower.color, upper.color, ratio)
}

function interpolateHex(from: string, to: string, ratio: number): string {
  const fromValue = Number.parseInt(from.slice(1), 16)
  const toValue = Number.parseInt(to.slice(1), 16)
  const channel = (shift: number) => {
    const start = (fromValue >> shift) & 0xff
    const end = (toValue >> shift) & 0xff
    return Math.round(start + (end - start) * ratio)
  }
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}

const option = computed(() => {
  const categoryAxis = {
    type: 'category' as const,
    data: props.categories,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#d8e2ea' } },
    axisLabel: {
      color: '#526a7b',
      fontFamily: 'Be Vietnam Pro',
      fontSize: 11,
      interval: 0,
      rotate: props.orientation === 'vertical' && props.categories.length > 8 ? 30 : 0,
      width: props.orientation === 'horizontal' ? 215 : 115,
      overflow: 'truncate' as const,
    },
  }
  const valueAxis = {
    type: 'value' as const,
    minInterval: 1,
    axisLabel: {
      color: '#758896',
      formatter: (value: number) => numberFormatter.format(value),
    },
    splitLine: { lineStyle: { color: '#eaf0f4', type: 'dashed' as const } },
  }
  const vertical = props.orientation === 'vertical'

  return {
    animationDuration: 450,
    grid: vertical
      ? { left: 64, right: 24, top: 28, bottom: props.categories.length > 8 ? 112 : 70, containLabel: false }
      : { left: 235, right: 74, top: 24, bottom: 48, containLabel: false },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value: number) => numberFormatter.format(value),
    },
    xAxis: vertical ? categoryAxis : valueAxis,
    yAxis: vertical ? valueAxis : { ...categoryAxis, inverse: true },
    dataZoom: !needsZoom.value
      ? []
      : vertical
        ? [
            { type: 'inside', xAxisIndex: 0, start: 0, end: visiblePercent.value },
            {
              type: 'slider',
              xAxisIndex: 0,
              start: 0,
              end: visiblePercent.value,
              height: 10,
              bottom: 12,
              showDetail: false,
              brushSelect: false,
              borderColor: 'transparent',
              backgroundColor: '#edf3f7',
              fillerColor: 'rgba(0, 104, 181, .18)',
              handleSize: 14,
              handleStyle: { color: '#fff', borderColor: '#078bc8', borderWidth: 2 },
              moveHandleSize: 0,
              dataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
              selectedDataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
            },
          ]
        : [
            { type: 'inside', yAxisIndex: 0, start: 0, end: visiblePercent.value },
            {
              type: 'slider',
              yAxisIndex: 0,
              start: 0,
              end: visiblePercent.value,
              width: 10,
              right: 12,
              showDetail: false,
              brushSelect: false,
              borderColor: 'transparent',
              backgroundColor: '#edf3f7',
              fillerColor: 'rgba(22, 160, 133, .18)',
              handleSize: 14,
              handleStyle: { color: '#fff', borderColor: '#16a085', borderWidth: 2 },
              moveHandleSize: 0,
              dataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
              selectedDataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
            },
          ],
    series: [{
      name: props.seriesName,
      type: 'bar',
      data: props.values.map((value, index) => ({
        value,
        itemStyle: { color: rankColor(index, props.values.length) },
      })),
      barMaxWidth: 34,
      itemStyle: {
        borderRadius: vertical ? [5, 5, 0, 0] : [0, 5, 5, 0],
      },
      emphasis: { itemStyle: { opacity: .82 } },
      label: {
        show: props.categories.length <= 15,
        position: vertical ? 'top' : 'right',
        color: '#425b6d',
        fontSize: 10,
        formatter: ({ value }: { value: number }) => numberFormatter.format(value),
      },
    }],
  }
})
</script>

<template>
  <v-chart class="comparison-chart" :option="option" :loading="loading" autoresize />
</template>

<style scoped>
.comparison-chart { width: 100%; height: 410px; }
</style>
