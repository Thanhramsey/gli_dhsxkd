<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import VChart from 'vue-echarts'

const props = defineProps<{ option: Record<string, unknown>; axis: 'x' | 'y'; count: number; anchor?: 'center' | 'end' | 'start' }>()
const emit = defineEmits<{ click: [event: { dataIndex?: number; seriesIndex?: number; name?: string }] }>()
const chart = ref<InstanceType<typeof VChart> | null>(null)
const range = ref({ start: 0, end: 100 })
const zoomAnchor = computed(() => {
  if (props.anchor) return props.anchor
  const axis = props.option[props.axis === 'x' ? 'xAxis' : 'yAxis']
  const definition = (Array.isArray(axis) ? axis[0] : axis) as { type?: string } | undefined
  return props.axis === 'y' && definition?.type === 'value' ? 'end' : 'center'
})
const minWidth = computed(() => zoomAnchor.value === 'end' || zoomAnchor.value === 'start' ? 20 : Math.min(100, 200 / Math.max(props.count, 1)))
const canZoomIn = computed(() => range.value.end - range.value.start > minWidth.value + 0.1)
const canZoomOut = computed(() => range.value.start > 0.1 || range.value.end < 99.9)
const chartOption = computed<EChartsOption>(() => ({
  ...props.option,
  dataZoom: [{
    type: 'inside',
    ...(props.axis === 'x' ? { xAxisIndex: 0 } : { yAxisIndex: 0 }),
    start: range.value.start,
    end: range.value.end,
    filterMode: 'none',
    zoomOnMouseWheel: false,
    moveOnMouseWheel: false,
    moveOnMouseMove: true,
  }],
}) as EChartsOption)

function zoom(inward: boolean) {
  const width = range.value.end - range.value.start
  const nextWidth = inward
    ? Math.max(minWidth.value, width * 0.7)
    : Math.min(100, width / 0.7)
  const start = zoomAnchor.value === 'end'
    ? Math.max(0, range.value.end - nextWidth)
    : zoomAnchor.value === 'start'
      ? Math.min(range.value.start, 100 - nextWidth)
      : Math.min(Math.max((range.value.start + range.value.end - nextWidth) / 2, 0), 100 - nextWidth)
  range.value = { start, end: start + nextWidth }
}

function syncRange() {
  const zoom = (chart.value?.chart?.getOption() as { dataZoom?: Array<{ start?: number; end?: number }> } | undefined)?.dataZoom?.[0]
  if (zoom?.start != null && zoom.end != null) range.value = { start: zoom.start, end: zoom.end }
}

watch(() => [props.count, props.axis, zoomAnchor.value], () => { range.value = { start: 0, end: 100 } })
</script>

<template>
  <div class="zoom-chart">
    <div class="zoom-controls" role="group" aria-label="Phóng to thu nhỏ biểu đồ">
      <v-btn icon="mdi-plus" size="x-small" variant="text" color="primary" title="Phóng to" aria-label="Phóng to biểu đồ" :disabled="!canZoomIn" @click="zoom(true)" />
      <v-btn icon="mdi-minus" size="x-small" variant="text" color="primary" title="Thu nhỏ" aria-label="Thu nhỏ biểu đồ" :disabled="!canZoomOut" @click="zoom(false)" />
      <v-btn icon="mdi-refresh" size="x-small" variant="text" color="primary" title="Khôi phục" aria-label="Khôi phục biểu đồ" :disabled="!canZoomOut" @click="range = { start: 0, end: 100 }" />
    </div>
    <VChart ref="chart" class="chart-canvas" :option="chartOption" autoresize @datazoom="syncRange" @click="emit('click', $event)" />
  </div>
</template>

<style scoped>
.zoom-chart{position:relative;width:100%}.chart-canvas{width:100%;height:100%}.zoom-controls{position:absolute;z-index:1;top:0;right:8px;display:flex;gap:2px;padding:2px;border:1px solid #e5edf3;border-radius:9px;background:rgba(255,255,255,.94);box-shadow:0 2px 8px rgba(29,61,83,.08)}
</style>
