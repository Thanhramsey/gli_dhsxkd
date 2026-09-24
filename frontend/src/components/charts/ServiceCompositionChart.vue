<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import '../../plugins/echarts'

const props = defineProps<{
  items: Array<{ name: string; value: number; color: string }>
  loading?: boolean
}>()

const numberFormatter = new Intl.NumberFormat('vi-VN')
const total = computed(() => props.items.reduce((sum, item) => sum + item.value, 0))
const option = computed(() => ({
  color: props.items.map((item) => item.color),
  animationDuration: 450,
  tooltip: {
    trigger: 'item',
    formatter: (params: { name: string; value: number; percent: number; marker: string }) =>
      `${params.marker}${params.name}<br><strong>${numberFormatter.format(params.value)}</strong> (${params.percent}%)`,
  },
  legend: {
    orient: 'vertical',
    right: '7%',
    top: 'center',
    itemWidth: 12,
    itemHeight: 12,
    itemGap: 14,
    textStyle: {
      color: '#526a7b',
      fontFamily: 'Be Vietnam Pro',
      fontSize: 12,
    },
    formatter: (name: string) => {
      const item = props.items.find((entry) => entry.name === name)
      return `${name}  ${numberFormatter.format(item?.value ?? 0)}`
    },
  },
  graphic: [
    {
      type: 'text',
      left: '36%',
      top: '43%',
      style: {
        text: 'TỔNG',
        textAlign: 'center',
        fill: '#78909f',
        font: '600 12px Be Vietnam Pro',
      },
    },
    {
      type: 'text',
      left: '36%',
      top: '50%',
      style: {
        text: numberFormatter.format(total.value),
        textAlign: 'center',
        fill: '#20384d',
        font: '700 22px Be Vietnam Pro',
      },
    },
  ],
  series: [{
    name: 'Cơ cấu dịch vụ',
    type: 'pie',
    center: ['36%', '50%'],
    radius: ['47%', '72%'],
    minAngle: 2,
    avoidLabelOverlap: true,
    itemStyle: {
      borderColor: '#fff',
      borderWidth: 3,
      borderRadius: 5,
    },
    label: {
      show: true,
      color: '#425b6d',
      fontFamily: 'Be Vietnam Pro',
      fontSize: 11,
      formatter: '{b}\n{d}%',
    },
    labelLine: {
      length: 14,
      length2: 10,
      lineStyle: { color: '#a9bac6' },
    },
    emphasis: {
      scaleSize: 8,
      label: { fontWeight: 700 },
    },
    data: props.items.map((item) => ({
      name: item.name,
      value: item.value,
      itemStyle: { color: item.color },
    })),
  }],
}))
</script>

<template>
  <v-chart class="composition-chart" :option="option" :loading="loading" autoresize />
</template>

<style scoped>
.composition-chart { width: 100%; height: 420px; }
</style>
