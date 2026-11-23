<script setup lang="ts">
import { computed, watch } from 'vue'
import { registerMap } from 'echarts/core'
import VChart from 'vue-echarts'
import { useTheme } from 'vuetify'
import type { TerritoryMapArea } from '../../types/territory-map'
import '../../plugins/echarts'

const props = defineProps<{
  mapName: string
  geoJson: unknown
  areas: TerritoryMapArea[]
  selectedAreaId?: string | null
  aspectScale?: number
  layoutSize?: string
}>()
const emit = defineEmits<{
  select: [areaId: string]
  hover: [areaId: string | null]
}>()
const theme = useTheme()

watch([() => props.mapName, () => props.geoJson], ([name, geometry]) => {
  registerMap(name, geometry as Parameters<typeof registerMap>[1])
}, { immediate: true })

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
const option = computed(() => {
  const dark = theme.global.current.value.dark
  const areasById = new Map(props.areas.map(area => [area.id, area]))
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      showDelay: 90,
      hideDelay: 180,
      confine: true,
      backgroundColor: dark ? '#223746' : '#fff',
      borderColor: dark ? '#385b72' : '#83b1cf',
      textStyle: { color: dark ? '#eaf4fa' : '#243c51', fontFamily: 'Be Vietnam Pro, sans-serif', fontSize: 12 },
      formatter: (params: { data?: { areaId?: string } }) => {
        const area = areasById.get(params.data?.areaId ?? '')
        if (!area) return ''
        return `<strong>${escapeHtml(area.tooltipTitle)}</strong>${area.tooltipLines.map(line => `<br/>${escapeHtml(line.label)}: ${escapeHtml(line.value)}`).join('')}`
      },
    },
    geo: {
      map: props.mapName,
      roam: true,
      aspectScale: props.aspectScale ?? 1.1,
      layoutCenter: ['50%', '50%'],
      layoutSize: props.layoutSize ?? '96%',
      itemStyle: { areaColor: dark ? '#173044' : '#e7f2f9', borderColor: dark ? '#c9d9e5' : '#fff', borderWidth: 1.8 },
      regions: props.areas.map(area => ({
        name: area.featureName,
        itemStyle: {
          areaColor: area.color,
          borderColor: dark ? '#c9d9e5' : '#fff',
          borderWidth: area.id === props.selectedAreaId ? 3 : 1.8,
          opacity: dark ? 0.88 : 0.94,
        },
      })),
      emphasis: { disabled: true },
      select: { disabled: true },
    },
    series: [
      {
        type: 'map', geoIndex: 0, name: 'Địa bàn',
        data: props.areas.map(area => ({ name: area.featureName, areaId: area.id })),
        emphasis: { disabled: true },
        select: { disabled: true },
      },
      {
        type: 'scatter', coordinateSystem: 'geo', silent: true, symbolSize: 1,
        data: props.areas.filter(area => area.labelPoint).map(area => ({
          name: area.label,
          value: area.labelPoint,
          itemStyle: { color: 'transparent' },
          label: {
            backgroundColor: dark ? 'rgba(20,38,53,.88)' : 'rgba(255,255,255,.9)',
            borderColor: area.id === props.selectedAreaId ? (dark ? '#fff' : '#1b4862') : 'transparent',
            borderWidth: 1, borderRadius: 4, padding: [3, 5],
          },
        })),
        label: { show: true, position: 'inside', formatter: '{b}', fontSize: 11, fontWeight: 700, color: dark ? '#eaf4fa' : '#1b4862' },
      },
    ],
  }
})

function emitArea(event: unknown, kind: 'select' | 'hover') {
  const id = (event as { data?: { areaId?: unknown } })?.data?.areaId
  if (typeof id !== 'string') return
  if (kind === 'select') emit('select', id)
  else emit('hover', id)
}
</script>

<template>
  <VChart :option="option" autoresize @click="emitArea($event, 'select')" @mouseover="emitArea($event, 'hover')" @mouseout="emit('hover', null)" />
</template>
