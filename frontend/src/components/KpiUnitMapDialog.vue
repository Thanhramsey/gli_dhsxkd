<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { kpiApi } from '../api/kpi.api'
import { getAuthErrorMessage } from '../api/auth.api'
import type { KpiV2Group, KpiV2Row, PtmUnitScope } from '../types/kpi'
import type { TerritoryMapArea } from '../types/territory-map'
import TerritoryMapChart from './charts/TerritoryMapChart.vue'
import wardGeoJson from '../assets/gia-lai-wards.json'
import centerAssignments from '../assets/gia-lai-center-assignments.json'
import serviceCentersGeoJson from '../assets/gia-lai-service-centers.json'

type UnitPeriod = 'monthly' | 'cumulative' | 'annual'
type ServiceWard = {
  code: string
  fullName: string
}

const wards = wardGeoJson.features.map(feature => feature.properties as ServiceWard)
const wardCenter = centerAssignments as Record<string, string>
const centerRegions = serviceCentersGeoJson.features.map(feature => feature.properties as { name: string; centerKey: string; displayName: string; wardCount: number; labelPoint: [number, number] })
const rankColors = { top: '#1674c6', achieved: '#20984f', warning: '#d18a22', bottom: '#d5424b', noPlan: '#8193a3' }

const props = defineProps<{
  rows: KpiV2Row[]
  group: KpiV2Group
  unitScope: PtmUnitScope
  months: string[]
  month: string
  selectedKpi: string
  period: UnitPeriod
  initialUnitCode: string | null
}>()
const dialogOpen = defineModel<boolean>({ default: false })
const selectedCode = ref<string | null>(null)
const hoveredCode = ref<string | null>(null)
const lastHoveredCode = ref<string | null>(null)
let hoverClearTimer: ReturnType<typeof setTimeout> | null = null
let hoverEnterTimer: ReturnType<typeof setTimeout> | null = null
const localMonth = ref('')
const localUnitScope = ref<PtmUnitScope>('area')
const unitScopeLabel = computed(() => props.group !== 'ptm' ? 'TTVT' : localUnitScope.value === 'area' ? 'địa bàn' : localUnitScope.value.toUpperCase())
const localKpi = ref('')
const localPeriod = ref<UnitPeriod>('monthly')
const localRows = ref<KpiV2Row[]>([])
const loading = ref(false)
const error = ref('')
let requestVersion = 0
const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const money = (value: number | null) => value == null ? '—' : numberFormat.format(value / 1_000_000)
const percent = (value: number | null) => value == null ? '—' : `${numberFormat.format(value)}%`
const normalize = (name: string) => name.replace(/^Trung tâm Viễn thông\s*/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
const monthOptions = computed(() => props.months.map(value => ({ title: `Tháng ${Number(value.slice(4))}/${value.slice(0, 4)}`, value: `${value.slice(0, 4)}-${value.slice(4)}` })))
const monthLabel = computed(() => localMonth.value ? `tháng ${Number(localMonth.value.slice(5))}/${localMonth.value.slice(0, 4)}` : '')
const kpiOptions = computed(() => [...new Map(localRows.value.map(row => [row.kpi, row.chartName.replace(/^Tổng\s+/i, '').trim() || row.kpi])).entries()]
  .sort((a, b) => a[0].localeCompare(b[0], 'vi', { numeric: true }))
  .map(([value, name]) => ({ title: `${value} · ${name}`, value, name })))
const selectedKpiTitle = computed(() => kpiOptions.value.find(item => item.value === localKpi.value)?.name ?? localKpi.value)
const periodFields = computed(() => {
  if (localPeriod.value === 'cumulative') return { actual: 'cumulativeRevenue' as const, plan: 'cumulativePlan' as const, label: 'Lũy kế' }
  if (localPeriod.value === 'annual') return { actual: 'cumulativeRevenue' as const, plan: 'annualPlan' as const, label: 'Kế hoạch năm' }
  return { actual: 'monthlyRevenue' as const, plan: 'monthlyPlan' as const, label: 'Trong tháng' }
})
const units = computed(() => localRows.value.filter(row => row.kpi === localKpi.value && row.unitCode !== '237' && row.isTerritory !== false).map(row => {
  const areaId = normalize(row.unitName)
  const region = centerRegions.find(item => item.centerKey === areaId)
  const actual = row[periodFields.value.actual]
  const plan = row[periodFields.value.plan]
  const completion = actual != null && plan != null && plan > 0 ? actual / plan * 100 : null
  const monthlyPrevious = row.monthlyRevenue != null && row.monthlyChange != null ? row.monthlyRevenue - row.monthlyChange : null
  const annualRemaining = row.annualPlan != null && row.annualPlan > 0
    ? row.remainingAnnual ?? (row.cumulativeRevenue != null ? row.annualPlan - row.cumulativeRevenue : null)
    : null
  const rawRank = localPeriod.value === 'cumulative' ? row.cumulativeRank : localPeriod.value === 'annual' ? row.annualRank : row.rank
  const rank = rawRank != null && rawRank > 0 ? rawRank : null
  return { code: row.unitCode, areaId, name: region?.displayName ?? row.unitName.replace(/^Trung tâm Viễn thông\s*/i, ''), actual, plan, completion, rank, monthlyChange: row.monthlyChange, monthlyPrevious, annualRemaining }
}).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (b.completion ?? -Infinity) - (a.completion ?? -Infinity) || a.name.localeCompare(b.name, 'vi')))
const rankedUnitCodes = computed(() => units.value.filter(unit => unit.rank != null)
  .sort((a, b) => a.rank! - b.rank! || a.name.localeCompare(b.name, 'vi'))
  .map(unit => unit.code))
const selectedUnit = computed(() => units.value.find(unit => unit.code === selectedCode.value) ?? null)
const focusedUnit = computed(() => units.value.find(unit => unit.code === hoveredCode.value)
  ?? selectedUnit.value
  ?? units.value.find(unit => unit.code === lastHoveredCode.value)
  ?? null)
const centerUnit = (key: string) => units.value.find(unit => unit.areaId === key)
const focusedWards = computed(() => focusedUnit.value
  ? wards.filter(ward => wardCenter[ward.code] === focusedUnit.value!.areaId)
  : [])
const maxActual = computed(() => Math.max(0, ...units.value.map(unit => unit.actual ?? 0)))
const relativeActual = (actual: number | null) => maxActual.value > 0 ? Math.max(0, actual ?? 0) / maxActual.value * 100 : 0

watch(dialogOpen, open => {
  requestVersion += 1
  clearHoverTimer()
  if (!open) return
  localRows.value = props.rows
  localMonth.value = props.month
  localUnitScope.value = props.unitScope
  localKpi.value = props.selectedKpi
  localPeriod.value = props.period
  error.value = ''
  loading.value = false
  selectedCode.value = props.initialUnitCode
  hoveredCode.value = null
  lastHoveredCode.value = null
})
watch([localMonth, localUnitScope], async ([value, unitScope]) => {
  if (!dialogOpen.value || !value) return
  const version = ++requestVersion
  if (value === props.month && (props.group !== 'ptm' || unitScope === props.unitScope)) {
    localRows.value = props.rows
    loading.value = false
    error.value = ''
    return
  }
  loading.value = true
  error.value = ''
  localRows.value = []
  selectedCode.value = null
  hoveredCode.value = null
  lastHoveredCode.value = null
  clearHoverTimer()
  try {
    const report = await kpiApi.v2Report(value, props.group, unitScope)
    if (version !== requestVersion) return
    localRows.value = report.rows
    if (!report.rows.some(row => row.kpi === localKpi.value)) localKpi.value = kpiOptions.value[0]?.value ?? ''
  } catch (cause) {
    if (version === requestVersion) error.value = getAuthErrorMessage(cause)
  } finally {
    if (version === requestVersion) loading.value = false
  }
})

function unitColor(unit: { code: string; completion: number | null } | undefined): string {
  if (!unit) return rankColors.noPlan
  const position = rankedUnitCodes.value.indexOf(unit.code)
  if (position >= 0 && position < 3) return rankColors.top
  if (rankedUnitCodes.value.length > 3 && position >= rankedUnitCodes.value.length - 3) return rankColors.bottom
  if (unit.completion == null) return rankColors.noPlan
  return unit.completion >= 100 ? rankColors.achieved : rankColors.warning
}

const mapAreas = computed<TerritoryMapArea[]>(() => centerRegions.map(region => {
  const unit = centerUnit(region.centerKey)
  return {
    id: region.centerKey,
    featureName: region.name,
    label: region.displayName,
    labelPoint: region.labelPoint,
    color: unitColor(unit),
    tooltipTitle: `${unitScopeLabel.value} ${region.displayName}`,
    tooltipLines: [
      { label: 'Xã/phường', value: String(region.wardCount) },
      ...(unit ? [
        { label: 'Thực hiện', value: `${money(unit.actual)} triệu đồng` },
        { label: 'Kế hoạch', value: `${money(unit.plan)} triệu đồng` },
        { label: 'Hoàn thành', value: percent(unit.completion) },
      ] : [{ label: 'Số liệu KPI', value: 'Chưa có' }]),
    ],
  }
}))
const selectedAreaId = computed(() => selectedUnit.value?.areaId ?? null)
function selectArea(areaId: string) {
  clearHoverTimer()
  const code = centerUnit(areaId)?.code ?? null
  selectedCode.value = code
  hoveredCode.value = null
  lastHoveredCode.value = code
}
function hoverArea(areaId: string | null) {
  if (hoverClearTimer) clearTimeout(hoverClearTimer)
  hoverClearTimer = null
  if (areaId) {
    const code = centerUnit(areaId)?.code
    if (!code) return
    if (code === hoveredCode.value) return
    if (hoverEnterTimer) clearTimeout(hoverEnterTimer)
    hoverEnterTimer = setTimeout(() => {
      hoveredCode.value = code
      lastHoveredCode.value = code
      hoverEnterTimer = null
    }, 90)
    return
  }
  if (hoverEnterTimer) clearTimeout(hoverEnterTimer)
  hoverEnterTimer = null
  hoverClearTimer = setTimeout(() => { hoveredCode.value = null; hoverClearTimer = null }, 160)
}
function clearHoverTimer() {
  if (hoverClearTimer) clearTimeout(hoverClearTimer)
  hoverClearTimer = null
  if (hoverEnterTimer) clearTimeout(hoverEnterTimer)
  hoverEnterTimer = null
}
onBeforeUnmount(clearHoverTimer)
</script>

<template>
  <v-dialog v-model="dialogOpen" width="96vw" max-width="1600" scrollable>
    <v-card class="unit-map-dialog">
      <v-card-title class="map-title">
        <span class="map-title-icon"><v-icon icon="mdi-map-marker-radius-outline" size="25" /></span>
        <div class="map-title-copy"><span class="map-eyebrow">GIAO BAN · ĐỊA BÀN CẤP 2</span><h2>Bản đồ chỉ tiêu theo {{ unitScopeLabel }}</h2><p>{{ monthLabel }} · {{ periodFields.label }} · {{ selectedKpiTitle }}</p></div>
        <v-btn class="map-close" icon="mdi-close" variant="text" size="small" aria-label="Đóng bản đồ" @click="dialogOpen = false" />
      </v-card-title>
      <v-card-text class="map-content">
        <div class="map-filters">
          <v-select v-model="localMonth" :items="monthOptions" label="Tháng báo cáo" variant="outlined" density="comfortable" hide-details />
          <v-select v-model="localPeriod" :items="[{ title: 'Trong tháng', value: 'monthly' }, { title: 'Lũy kế', value: 'cumulative' }, { title: 'Kế hoạch năm', value: 'annual' }]" label="Kỳ so sánh" variant="outlined" density="comfortable" hide-details />
          <v-autocomplete v-model="localKpi" :items="kpiOptions" label="Chỉ tiêu KPI" variant="outlined" density="comfortable" hide-details :disabled="loading || !kpiOptions.length" />
          <v-select v-if="group === 'ptm'" v-model="localUnitScope" :items="[{ title: 'Cả địa bàn (TTVT + VNPT)', value: 'area' }, { title: 'Chỉ TTVT', value: 'ttvt' }, { title: 'Chỉ VNPT', value: 'vnpt' }]" label="Phạm vi đơn vị" variant="outlined" density="comfortable" hide-details />
        </div>
        <v-progress-linear v-if="loading" class="mb-3" indeterminate color="primary" />
        <v-alert v-if="error" class="mb-3" type="error" variant="tonal" density="compact">{{ error }}</v-alert>
        <v-alert v-else-if="!loading && !units.length" class="mb-3" type="info" variant="tonal" density="compact">Chưa có số liệu địa bàn cho {{ selectedKpiTitle }} · {{ monthLabel }}.</v-alert>
        <div class="map-layout">
          <div class="map-panel">
            <TerritoryMapChart class="map-chart" map-name="gia-lai-centers" :geo-json="serviceCentersGeoJson" :areas="mapAreas" :selected-area-id="selectedAreaId" @select="selectArea" @hover="hoverArea" />
            <div class="map-service-legend">
              <strong>Xếp hạng và mức hoàn thành KPI của {{ unitScopeLabel }}</strong>
              <div class="map-service-items">
                <span><i :style="{ background: rankColors.top }" />Top 3</span>
                <span><i :style="{ background: rankColors.achieved }" />Đạt kế hoạch</span>
                <span><i :style="{ background: rankColors.warning }" />Chưa đạt kế hoạch</span>
                <span><i :style="{ background: rankColors.bottom }" />3 hạng cuối</span>
                <span><i :style="{ background: rankColors.noPlan }" />Chưa có kế hoạch</span>
              </div>
            </div>
          </div>
          <aside class="map-side">
            <div class="map-side-heading"><strong>Xếp hạng {{ units.length }} địa bàn</strong><small>Thanh: quy mô thực hiện</small></div>
            <div class="map-focus" :class="{ 'map-focus-empty': !focusedUnit }" aria-live="polite">
                <div v-if="focusedUnit" class="map-focus-content">
                  <div class="map-focus-top"><strong>{{ focusedUnit.name }}</strong><span>{{ focusedUnit.rank == null ? 'Chưa xếp hạng' : `Hạng ${focusedUnit.rank}` }}</span></div>
                  <div class="map-focus-metrics">
                    <div><small>{{ localPeriod === 'monthly' ? 'Thực hiện tháng' : 'Thực hiện lũy kế' }}</small><strong>{{ money(focusedUnit.actual) }}</strong></div>
                    <div><small>{{ localPeriod === 'annual' ? 'Kế hoạch năm' : localPeriod === 'cumulative' ? 'Kế hoạch lũy kế' : 'Kế hoạch tháng' }}</small><strong>{{ money(focusedUnit.plan) }}</strong></div>
                    <div><small>Hoàn thành{{ localPeriod === 'annual' ? ' KH năm' : '' }}</small><strong :style="{ color: unitColor(focusedUnit) }">{{ percent(focusedUnit.completion) }}</strong></div>
                  </div>
                  <div v-if="localPeriod === 'monthly'" class="map-focus-insight" :class="{ 'is-up': (focusedUnit.monthlyChange ?? 0) > 0, 'is-down': (focusedUnit.monthlyChange ?? 0) < 0 }">
                    <span>So với tháng trước<small v-if="focusedUnit.monthlyPrevious != null">Tháng trước: {{ money(focusedUnit.monthlyPrevious) }} triệu đồng</small></span>
                    <strong v-if="focusedUnit.monthlyChange != null"><v-icon :icon="focusedUnit.monthlyChange > 0 ? 'mdi-trending-up' : focusedUnit.monthlyChange < 0 ? 'mdi-trending-down' : 'mdi-minus'" size="17" />{{ focusedUnit.monthlyChange > 0 ? '+' : '' }}{{ money(focusedUnit.monthlyChange) }} <small>triệu đồng</small></strong>
                    <strong v-else>Chưa có dữ liệu</strong>
                  </div>
                  <div v-else-if="localPeriod === 'annual'" class="map-focus-insight" :class="{ 'is-up': focusedUnit.annualRemaining != null && focusedUnit.annualRemaining <= 0 }">
                    <span>{{ focusedUnit.annualRemaining == null ? 'Còn thiếu để đạt KH năm' : focusedUnit.annualRemaining < 0 ? 'Vượt kế hoạch năm' : focusedUnit.annualRemaining === 0 ? 'Đã đạt kế hoạch năm' : 'Còn thiếu để đạt KH năm' }}</span>
                    <strong>{{ focusedUnit.annualRemaining == null ? 'Chưa có dữ liệu' : `${money(Math.abs(focusedUnit.annualRemaining))} triệu đồng` }}</strong>
                  </div>
                  <small class="map-focus-unit">Đơn vị: triệu đồng</small>
                  <div class="map-focus-wards"><strong>{{ focusedWards.length }} xã/phường phụ trách</strong><span>{{ focusedWards.map(ward => ward.fullName).join(' · ') }}</span></div>
                </div>
                <span v-else key="hint" class="map-focus-hint">Chọn một địa bàn trong danh sách để xem số liệu.</span>
            </div>
            <v-list class="map-unit-list" density="compact" nav>
              <v-list-item v-for="unit in units" :key="unit.code" :active="focusedUnit?.code === unit.code" rounded="lg" @click="selectArea(unit.areaId)">
                <template #prepend><span class="map-rank">{{ unit.rank == null ? '—' : `#${unit.rank}` }}</span><span class="map-dot" :style="{ background: unitColor(unit) }" /></template>
                <div class="map-unit-main">
                  <div class="map-unit-identity"><strong>{{ unit.name }}</strong><small>{{ money(unit.actual) }} / {{ money(unit.plan) }}</small></div>
                  <v-progress-linear class="map-volume" :model-value="relativeActual(unit.actual)" :color="unitColor(unit)" bg-opacity="0.16" height="8" rounded />
                  <strong class="map-rate" :style="{ color: unitColor(unit) }">{{ percent(unit.completion) }}</strong>
                </div>
              </v-list-item>
            </v-list>
          </aside>
        </div>
        <p class="map-note">Mỗi vùng là một địa bàn phục vụ. Màu dùng cùng quy tắc với biểu đồ xếp hạng; nguồn ranh giới xã/phường: GeoVN.</p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.unit-map-dialog{background:rgb(var(--v-theme-surface))}.map-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px}.map-title>div{min-width:0}.map-title strong{font-size:18px}.map-title small{display:block;margin:5px 0 0 34px;color:rgba(var(--v-theme-on-surface),.62);font-size:12px;font-weight:400;white-space:normal}.map-content{padding:16px 20px 18px!important}.map-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,1fr);gap:16px}.map-panel{min-height:530px;border:1px solid rgba(var(--v-border-color),.17);border-radius:10px;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 3%,rgb(var(--v-theme-surface)));overflow:hidden}.map-chart{width:100%;height:485px}.map-legend{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;padding:0 12px 12px;font-size:11px;color:rgba(var(--v-theme-on-surface),.75)}.map-legend span{display:flex;align-items:center;gap:5px}.map-legend i,.map-dot{display:inline-block;flex:none;width:10px;height:10px;border-radius:50%}.map-side{display:flex;flex-direction:column;min-height:0;border:1px solid rgba(var(--v-border-color),.17);border-radius:10px;padding:12px}.map-side-heading{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:2px 4px 10px}.map-side-heading small{font-size:11px;opacity:.65}.map-unit-list{flex:1;max-height:455px;overflow-y:auto}.map-unit-list :deep(.v-list-item){margin-bottom:3px}.map-unit-list :deep(.v-list-item__prepend){margin-right:10px}.map-unit-list :deep(.v-list-item-title){font-size:13px;font-weight:650}.map-unit-list :deep(.v-list-item-subtitle){font-size:11px}.map-rate{font-size:12px;white-space:nowrap}.map-note{margin:12px 2px 0;color:rgba(var(--v-theme-on-surface),.63);font-size:11px;line-height:1.5}@media(max-width:800px){.map-layout{grid-template-columns:1fr}.map-panel{min-height:400px}.map-chart{height:355px}.map-unit-list{max-height:280px}.map-content{padding:12px!important}}
.unit-map-dialog{max-height:92vh}
.map-content{padding:18px 22px 20px!important}
.map-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px}
.map-layout{grid-template-columns:minmax(0,2fr) minmax(300px,1fr);gap:18px}
.map-panel{min-height:600px;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 6%,rgb(var(--v-theme-surface)))}
.map-side{background:rgb(var(--v-theme-surface))}
.map-panel,.map-side{border-color:rgba(var(--v-border-color),.12);box-shadow:0 2px 5px rgba(18,48,70,.05),0 8px 22px rgba(18,48,70,.10)}
.map-unit-list{background:transparent}
.map-chart{height:clamp(490px,64vh,650px)}
.map-unit-list{max-height:clamp(425px,59vh,600px)}
.map-title{align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid rgba(var(--v-theme-primary),.18);background:color-mix(in srgb,rgb(var(--v-theme-primary)) 14%,rgb(var(--v-theme-surface)));white-space:normal}
.map-title-icon{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:11px;background:rgba(var(--v-theme-primary),.12);color:rgb(var(--v-theme-primary))}
.map-title-copy{flex:1;min-width:0}.map-eyebrow{display:block;margin-bottom:3px;color:rgb(var(--v-theme-primary));font-size:10px;font-weight:800;letter-spacing:.11em}.map-title-copy h2{margin:0;font-size:19px;font-weight:750;line-height:1.35}.map-title-copy p{margin:4px 0 0;color:rgba(var(--v-theme-on-surface),.64);font-size:12px;font-weight:400;line-height:1.5}.map-close{align-self:flex-start}
.map-focus{min-height:116px;margin:0 2px 8px;padding:12px 14px;border:1px solid rgba(var(--v-theme-primary),.16);border-radius:9px;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 5%,rgb(var(--v-theme-surface)))}.map-focus-empty{display:flex;align-items:center;color:rgba(var(--v-theme-on-surface),.62);font-size:12px;line-height:1.5}.map-focus-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.map-focus-top strong{font-size:14px}.map-focus-top span{color:rgb(var(--v-theme-primary));font-size:12px;font-weight:700;white-space:nowrap}.map-focus-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.map-focus-metrics div{min-width:0}.map-focus-metrics small{display:block;color:rgba(var(--v-theme-on-surface),.62);font-size:10px}.map-focus-metrics strong{display:block;margin-top:2px;font-size:14px;white-space:nowrap}.map-focus-unit{display:block;margin-top:6px;color:rgba(var(--v-theme-on-surface),.54);font-size:10px}
.map-rank{display:inline-flex;align-items:center;justify-content:center;flex:none;width:30px;height:28px;margin-right:8px;border-radius:7px;background:rgba(var(--v-theme-primary),.08);color:rgb(var(--v-theme-primary));font-size:11px;font-weight:800}.map-unit-list :deep(.v-list-item__prepend){margin-right:10px}
.map-unit-list :deep(.v-list-item__content){min-width:0;width:100%}.map-unit-main{display:grid;grid-template-columns:minmax(84px,1fr) minmax(65px,.9fr) minmax(72px,auto);align-items:center;gap:10px;width:100%}.map-unit-identity{min-width:0}.map-unit-identity strong,.map-unit-identity small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.map-unit-identity strong{font-size:12px;font-weight:700}.map-unit-identity small{color:rgba(var(--v-theme-on-surface),.58);font-size:10px}.map-volume{min-width:0}.map-rate{text-align:right;font-size:12px;font-weight:750}
.map-service-legend{margin:0 14px 8px;padding:12px 14px;border-radius:9px;background:rgba(var(--v-theme-surface),.94);box-shadow:0 2px 12px rgba(20,55,80,.08)}
.map-service-legend>strong{display:block;margin-bottom:9px;font-size:12px;color:rgba(var(--v-theme-on-surface),.85)}
.map-service-items{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px 12px}
.map-service-items span{display:flex;align-items:center;min-width:0;gap:5px;font-size:11px;line-height:1.35}
.map-service-items i{flex:none;width:11px;height:11px;border-radius:3px;border:1px solid rgba(0,0,0,.12)}
.map-service-items small{color:rgba(var(--v-theme-on-surface),.55)}
.map-focus-wards{margin-top:10px;padding-top:8px;border-top:1px solid rgba(var(--v-border-color),.2)}
.map-focus-wards strong,.map-focus-wards span{display:block;font-size:11px;line-height:1.45}
.map-focus-wards span{max-height:55px;overflow-y:auto;margin-top:3px;color:rgba(var(--v-theme-on-surface),.7)}
.map-focus{position:relative;height:258px;min-height:258px;overflow:hidden;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 11%,rgb(var(--v-theme-surface)))}
.map-focus-empty{display:block}
.map-focus-content{width:100%}
.map-focus-hint{display:flex;align-items:center;height:100%;color:rgba(var(--v-theme-on-surface),.62);font-size:12px;line-height:1.5}
.map-focus-wards span{height:45px;max-height:none}
.map-focus-top{align-items:center}.map-focus-top strong{font-size:16px;color:rgb(var(--v-theme-on-surface))}.map-focus-top span{padding:4px 8px;border-radius:6px;background:rgba(var(--v-theme-primary),.1)}
.map-focus-metrics{gap:6px;margin-top:12px}.map-focus-metrics>div{padding:8px 9px;border-radius:7px;background:rgba(var(--v-theme-surface),.9)}.map-focus-metrics small{font-size:10px;line-height:1.35}.map-focus-metrics strong{font-size:16px;line-height:1.35;font-weight:800;font-variant-numeric:tabular-nums}
.map-focus-insight{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:39px;margin-top:9px;padding:7px 10px;border-radius:7px;background:rgba(var(--v-theme-primary),.08);color:rgb(var(--v-theme-primary))}.map-focus-insight>span{font-size:11px;font-weight:650}.map-focus-insight>span small{display:block;margin-top:2px;font-size:10px;font-weight:500;opacity:.8}.map-focus-insight strong{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}.map-focus-insight strong small{font-size:10px;font-weight:500}.map-focus-insight.is-up{background:rgba(32,152,79,.12);color:#177945}.map-focus-insight.is-down{background:rgba(213,66,75,.11);color:#c52f3c}
.map-focus-unit{margin-top:7px}.map-focus-wards{margin-top:7px;padding-top:7px}
.map-unit-list :deep(.v-list-item){transition:background-color .18s ease,box-shadow .18s ease}
@media(prefers-reduced-motion:reduce){.map-unit-list :deep(.v-list-item){transition:none}}
.map-legend{padding:0 14px 13px}.map-legend>small{font-size:11px;font-weight:700}
@media(max-width:1100px){.map-service-items{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:900px){.map-filters{grid-template-columns:1fr 1fr}.map-filters :deep(.v-autocomplete){grid-column:1/-1}.map-layout{grid-template-columns:1fr}.map-chart{height:460px}.map-panel{min-height:500px}.map-unit-list{max-height:300px}}
@media(max-width:600px){.map-filters{grid-template-columns:1fr}.map-filters :deep(.v-autocomplete){grid-column:auto}.map-content{padding:12px!important}.map-chart{height:360px}.map-panel{min-height:400px}.map-title{padding:14px}.map-title-icon{width:38px;height:38px}.map-title-copy h2{font-size:16px}.map-focus-metrics strong{font-size:12px}.map-service-items{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
