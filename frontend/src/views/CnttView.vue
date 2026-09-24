<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { cnttApi } from '../api/cntt.api'
import { getAuthErrorMessage } from '../api/auth.api'
import ComparisonBarChart from '../components/charts/ComparisonBarChart.vue'
import CnttPlanProgressChart from '../components/charts/CnttPlanProgressChart.vue'
import ServiceCompositionChart from '../components/charts/ServiceCompositionChart.vue'
import type { CnttRevenueRow } from '../types/cntt'

const today = new Date()
const month = ref(today.getMonth() + 1)
const year = ref(today.getFullYear())
const monthItems = Array.from({ length: 12 }, (_, index) => ({ title: `Tháng ${index + 1}`, value: index + 1 }))
const yearItems = Array.from({ length: 8 }, (_, index) => today.getFullYear() + 1 - index)
const rows = ref<CnttRevenueRow[]>([])
const loading = ref(false)
const hasLoaded = ref(false)
const error = ref('')
const search = ref('')
let requestId = 0

const selectedMonth = computed(() => `${year.value}-${String(month.value).padStart(2, '0')}`)
const monthLabel = computed(() => `tháng ${month.value}/${year.value}`)
const allUnits = computed(() => rows.value.filter((row) => !row.isTotal))
const displayedUnits = computed(() => {
  const query = normalize(search.value)
  return query ? allUnits.value.filter((row) => normalize(row.unitName).includes(query)) : allUnits.value
})
const scopeLabel = computed(() => search.value.trim() ? `${displayedUnits.value.length} đơn vị đang lọc` : 'Toàn bộ đơn vị')
const totals = computed(() => {
  const serverTotal = !search.value.trim() ? rows.value.find((row) => row.isTotal) : undefined
  if (serverTotal) return serverTotal
  const sum = (key: keyof CnttRevenueRow) => displayedUnits.value.reduce((acc, row) => acc + Number(row[key] ?? 0), 0)
  const plan = sum('plan')
  const actual = sum('actual')
  return {
    unitId: null,
    unitName: 'TỔNG CỘNG',
    plan,
    serviceGroupA: sum('serviceGroupA'),
    serviceGroupBC: sum('serviceGroupBC'),
    serviceRevenue: sum('serviceRevenue'),
    equipmentGroupA: sum('equipmentGroupA'),
    equipmentGroupBC: sum('equipmentGroupBC'),
    equipmentRevenue: sum('equipmentRevenue'),
    actual,
    completionRate: plan > 0 ? actual / plan * 100 : null,
    isTotal: true,
  } satisfies CnttRevenueRow
})
const rankedUnits = computed(() => [...displayedUnits.value].sort((a, b) => b.actual - a.actual))
const chartNames = computed(() => rankedUnits.value.map((row) => row.unitName))
const planActualSeries = computed(() => [
  { name: 'Kế hoạch', color: '#a6c9e1', data: rankedUnits.value.map((row) => toMillion(row.plan)) },
  { name: 'Thực hiện', color: '#087cba', data: rankedUnits.value.map((row) => toMillion(row.actual)) },
])
const progressItems = computed(() => rankedUnits.value.map((row) => ({
  name: row.unitName,
  plan: toMillion(row.plan),
  actual: toMillion(row.actual),
  rate: row.completionRate,
})))
const groupA = computed(() => Math.max(0, totals.value.serviceGroupA + totals.value.equipmentGroupA))
const groupBC = computed(() => Math.max(0, totals.value.serviceGroupBC + totals.value.equipmentGroupBC))
const compositionItems = computed(() => [
  { name: 'Nhóm A', value: groupA.value, color: '#087cba' },
  { name: 'Nhóm B,C', value: groupBC.value, color: '#20a98e' },
])
const classifiedTotal = computed(() => groupA.value + groupBC.value)
const completion = computed(() => totals.value.completionRate ?? 0)
const headers = [
  { title: 'Đơn vị', key: 'unitName', width: 260 },
  { title: 'Kế hoạch', key: 'plan', align: 'end' as const },
  { title: 'DT nhóm A', key: 'serviceGroupA', align: 'end' as const },
  { title: 'DT nhóm B,C', key: 'serviceGroupBC', align: 'end' as const },
  { title: 'DT dịch vụ', key: 'serviceRevenue', align: 'end' as const },
  { title: 'DT thiết bị A', key: 'equipmentGroupA', align: 'end' as const },
  { title: 'DT thiết bị B,C', key: 'equipmentGroupBC', align: 'end' as const },
  { title: 'DT thiết bị', key: 'equipmentRevenue', align: 'end' as const },
  { title: 'Thực hiện', key: 'actual', align: 'end' as const },
  { title: '% KH', key: 'completionRate', align: 'end' as const },
]
const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const rateFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

function normalize(value: string): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}
function toMillion(value: number): number {
  return value / 1_000_000
}
function money(value: number): string {
  return numberFormatter.format(toMillion(value))
}
function rate(value: number | null): string {
  return value == null ? '—' : `${rateFormatter.format(value)}%`
}
function rateColor(value: number | null): string {
  if (value == null) return 'grey'
  return value >= 100 ? 'success' : value >= 70 ? 'warning' : 'error'
}
async function load(): Promise<void> {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  try {
    const result = await cnttApi.revenue(selectedMonth.value)
    if (currentRequest !== requestId) return
    rows.value = result.rows
    hasLoaded.value = true
  } catch (cause) {
    if (currentRequest !== requestId) return
    rows.value = []
    hasLoaded.value = true
    error.value = getAuthErrorMessage(cause)
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <v-container fluid class="cntt-page">
    <div class="page-head">
      <div>
        <span class="eyebrow">BÁO CÁO PHÁT TRIỂN CNTT</span>
        <h1>Kết quả doanh thu dịch vụ số</h1>
        <p>Theo dõi kế hoạch và doanh thu thực hiện của các đơn vị trong {{ monthLabel }}.</p>
      </div>
      <v-chip color="primary" variant="tonal" prepend-icon="mdi-calendar-month">{{ monthLabel }}</v-chip>
    </div>

    <v-card class="filter-card" elevation="0">
      <v-card-text class="filter-content">
        <v-select v-model="month" :items="monthItems" label="Tháng báo cáo" variant="outlined" density="comfortable" hide-details />
        <v-select v-model="year" :items="yearItems" label="Năm" variant="outlined" density="comfortable" hide-details />
        <v-btn color="primary" prepend-icon="mdi-chart-box-outline" :loading="loading" size="large" @click="load">Xem báo cáo</v-btn>
      </v-card-text>
    </v-card>

    <v-alert v-if="error" class="mt-5" type="error" variant="tonal" closable @click:close="error = ''">{{ error }}</v-alert>

    <template v-if="hasLoaded && !error">
      <v-alert v-if="!allUnits.length" class="mt-5" type="info" variant="tonal">Không có dữ liệu CNTT trong {{ monthLabel }}.</v-alert>
      <template v-else>
        <div class="section-label">TỔNG QUAN · {{ scopeLabel }}</div>
        <v-row class="kpi-grid">
          <v-col cols="12" sm="6" xl="3">
            <v-card class="kpi-card" elevation="0"><v-card-text>
              <span class="kpi-icon blue"><v-icon icon="mdi-target" /></span>
              <span class="kpi-label">Kế hoạch</span>
              <strong>{{ money(totals.plan) }}</strong>
              <small>triệu đồng · {{ monthLabel }}</small>
            </v-card-text></v-card>
          </v-col>
          <v-col cols="12" sm="6" xl="3">
            <v-card class="kpi-card" elevation="0"><v-card-text>
              <span class="kpi-icon teal"><v-icon icon="mdi-cash-multiple" /></span>
              <span class="kpi-label">Doanh thu thực hiện</span>
              <strong>{{ money(totals.actual) }}</strong>
              <small>triệu đồng · không cộng lại từ các khoản thành phần</small>
            </v-card-text></v-card>
          </v-col>
          <v-col cols="12" sm="6" xl="3">
            <v-card class="kpi-card" elevation="0"><v-card-text>
              <span class="kpi-icon amber"><v-icon icon="mdi-percent-outline" /></span>
              <span class="kpi-label">Hoàn thành kế hoạch</span>
              <strong>{{ rate(totals.completionRate) }}</strong>
              <v-progress-linear class="mt-3" :model-value="Math.min(100, Math.max(0, completion))" color="primary" rounded height="8" />
            </v-card-text></v-card>
          </v-col>
          <v-col cols="12" sm="6" xl="3">
            <v-card class="kpi-card" elevation="0"><v-card-text>
              <span class="kpi-icon violet"><v-icon icon="mdi-office-building-outline" /></span>
              <span class="kpi-label">Đơn vị có dữ liệu</span>
              <strong>{{ displayedUnits.length }}</strong>
              <small>đơn vị trong phạm vi đang xem</small>
            </v-card-text></v-card>
          </v-col>
        </v-row>

        <v-card class="search-card" elevation="0">
          <v-card-text class="search-content">
            <div><strong>Phân tích theo đơn vị</strong><span>Tìm đơn vị để cập nhật đồng thời chỉ số, biểu đồ và bảng.</span></div>
            <v-text-field v-model="search" label="Tìm tên đơn vị" prepend-inner-icon="mdi-magnify" clearable variant="outlined" density="comfortable" hide-details />
          </v-card-text>
        </v-card>

        <v-row v-if="displayedUnits.length" class="chart-grid">
          <v-col cols="12" lg="7">
            <v-card class="chart-card" elevation="0">
              <v-card-title><strong>Thực hiện so với kế hoạch · {{ monthLabel }}</strong><span>Xếp theo doanh thu thực hiện · đơn vị: triệu đồng</span></v-card-title>
              <v-card-text><CnttPlanProgressChart :items="progressItems" :loading="loading" /></v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" lg="5">
            <v-card class="chart-card" elevation="0">
              <v-card-title><strong>Cơ cấu doanh thu theo nhóm</strong><span>Doanh thu dịch vụ và thiết bị đã phân nhóm A/B,C</span></v-card-title>
              <v-card-text>
                <ServiceCompositionChart v-if="classifiedTotal > 0" :items="compositionItems" :loading="loading" />
                <v-empty-state v-else icon="mdi-chart-donut" title="Chưa có doanh thu phân nhóm" />
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12">
            <v-card class="chart-card" elevation="0">
              <v-card-title><strong>Kế hoạch và thực hiện · {{ monthLabel }}</strong><span>So sánh theo đơn vị · triệu đồng</span></v-card-title>
              <v-card-text><ComparisonBarChart :categories="chartNames" :series="planActualSeries" orientation="vertical" :loading="loading" /></v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-card class="table-card" elevation="0">
          <v-card-title><div><strong>Chi tiết doanh thu theo đơn vị</strong><span>Số liệu tính bằng triệu đồng · {{ monthLabel }} · {{ scopeLabel }}</span></div></v-card-title>
          <v-data-table
            :headers="headers"
            :items="displayedUnits"
            :loading="loading"
            :items-per-page="20"
            :items-per-page-options="[20, 50, 100, 200, 500]"
            density="comfortable"
            hover
            fixed-header
            height="540"
            class="revenue-table"
            no-data-text="Không có đơn vị phù hợp"
          >
            <template #item="{ item, columns }">
              <tr>
                <td v-for="column in columns" :key="String(column.key)" :class="{ 'text-end': column.key !== 'unitName' }">
                  <template v-if="column.key === 'unitName'">{{ item.unitName }}</template>
                  <v-chip v-else-if="column.key === 'completionRate'" :color="rateColor(item.completionRate)" size="small" variant="tonal">{{ rate(item.completionRate) }}</v-chip>
                  <template v-else>{{ money(Number(item[column.key as keyof CnttRevenueRow] ?? 0)) }}</template>
                </td>
              </tr>
            </template>
            <template #body.prepend="{ columns }">
              <tr v-if="displayedUnits.length" class="total-row">
                <td v-for="column in columns" :key="String(column.key)" :class="{ 'text-end': column.key !== 'unitName' }">
                  <template v-if="column.key === 'unitName'">{{ totals.unitName }}</template>
                  <v-chip v-else-if="column.key === 'completionRate'" :color="rateColor(totals.completionRate)" size="small" variant="tonal">{{ rate(totals.completionRate) }}</v-chip>
                  <template v-else>{{ money(Number(totals[column.key as keyof CnttRevenueRow] ?? 0)) }}</template>
                </td>
              </tr>
            </template>
          </v-data-table>
          <!-- <v-card-text class="source-note">Nguồn: NBH_CDS_NEW.PACK_CNTT.TONGHOP_DOANHTHU_CNTT. Các khoản doanh thu thành phần không nhất thiết cộng bằng “Thực hiện”.</v-card-text> -->
        </v-card>
      </template>
    </template>
  </v-container>
</template>

<style scoped>
.cntt-page{max-width:1600px;padding:28px 20px 64px;margin:auto}.page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}.eyebrow,.section-label{color:rgb(var(--v-theme-primary));font-size:12px;font-weight:800;letter-spacing:1.2px}.page-head h1{font-size:30px;line-height:1.25;margin:7px 0;color:rgb(var(--v-theme-on-background))}.page-head p{color:rgba(var(--v-theme-on-background),.65);font-size:14px}.page-head .v-chip{margin-top:6px}.filter-card,.kpi-card,.chart-card,.search-card,.table-card{border:0;border-radius:12px;background:rgb(var(--v-theme-surface));box-shadow:0 4px 18px rgba(29,61,83,.08)!important}.filter-content{display:grid;grid-template-columns:minmax(160px,260px) minmax(130px,180px) auto;align-items:center;gap:14px;padding:18px!important}.filter-content .v-btn{justify-self:start}.section-label{margin:28px 0 8px}.kpi-grid{margin-top:0}.kpi-card{height:100%}.kpi-card .v-card-text{display:flex;flex-direction:column;min-height:158px;padding:19px 21px}.kpi-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;margin-bottom:10px}.kpi-icon.blue{color:#087cba;background:#e5f3fb}.kpi-icon.teal{color:#159c84;background:#e5f7f2}.kpi-icon.amber{color:#bf8420;background:#fff3dc}.kpi-icon.violet{color:#6858aa;background:#f0ebff}.kpi-label{font-size:12px;color:rgba(var(--v-theme-on-surface),.64);font-weight:700;text-transform:uppercase;letter-spacing:.35px}.kpi-card strong{font-size:28px;line-height:1.3;margin-top:3px;color:rgb(var(--v-theme-on-surface))}.kpi-card small{font-size:11px;color:rgba(var(--v-theme-on-surface),.55);line-height:1.5}.search-card{margin:18px 0}.search-content{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 21px!important}.search-content>div{display:grid;gap:3px}.search-content strong{font-size:16px}.search-content span{font-size:12px;color:rgba(var(--v-theme-on-surface),.58)}.search-content .v-text-field{max-width:350px;min-width:230px}.chart-grid{margin-bottom:16px}.chart-card{height:100%;overflow:hidden}.chart-card .v-card-title,.table-card .v-card-title{padding:19px 21px 9px;white-space:normal}.chart-card .v-card-title strong,.chart-card .v-card-title span,.table-card .v-card-title strong,.table-card .v-card-title span{display:block}.chart-card .v-card-title strong,.table-card .v-card-title strong{font-size:16px}.chart-card .v-card-title span,.table-card .v-card-title span{margin-top:5px;font-size:12px;font-weight:400;color:rgba(var(--v-theme-on-surface),.56)}.chart-card .v-card-text{padding:0 12px 12px}.table-card{overflow:hidden}.revenue-table :deep(.v-table__wrapper){scrollbar-width:thin;scrollbar-color:rgba(var(--v-theme-primary),.32) transparent}.revenue-table :deep(th){min-width:128px!important;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 7%,rgb(var(--v-theme-surface)))!important;color:rgb(var(--v-theme-primary))!important;font-size:12px!important;font-weight:700!important;white-space:nowrap;z-index:2!important}.revenue-table :deep(th:first-child){min-width:245px!important}.revenue-table :deep(td){min-width:128px;border-bottom-color:rgba(var(--v-border-color),.1)!important;font-size:12px;white-space:nowrap}.revenue-table :deep(td:first-child){min-width:245px;font-weight:600}.revenue-table :deep(tbody tr:nth-child(even)){background:rgba(var(--v-theme-primary),.022)}.revenue-table :deep(tbody tr:hover){background:rgba(var(--v-theme-primary),.065)!important}.revenue-table :deep(.total-row){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 11%,rgb(var(--v-theme-surface)))!important;font-weight:800;color:rgb(var(--v-theme-primary))}.source-note{border-top:1px solid rgba(var(--v-border-color),.1);font-size:11px;color:rgba(var(--v-theme-on-surface),.55)}@media(max-width:700px){.cntt-page{padding:20px 12px 48px}.page-head{flex-direction:column}.page-head h1{font-size:24px}.filter-content{grid-template-columns:1fr 1fr}.filter-content .v-btn{grid-column:1/-1;width:100%}.search-content{align-items:stretch;flex-direction:column}.search-content .v-text-field{max-width:none}}
</style>
