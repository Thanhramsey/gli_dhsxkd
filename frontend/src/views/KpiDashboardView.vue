<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import VChart from 'vue-echarts'
import { kpiApi } from '../api/kpi.api'
import { getAuthErrorMessage } from '../api/auth.api'
import type { KpiRow } from '../types/kpi'
import '../plugins/echarts'

const now = new Date()
const monthNumber = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())
const monthOptions = Array.from({ length: 12 }, (_, index) => ({ title: `Tháng ${index + 1}`, value: index + 1 }))
const yearOptions = Array.from({ length: 8 }, (_, index) => now.getFullYear() + 1 - index)
const month = computed(() => `${year.value}-${String(monthNumber.value).padStart(2, '0')}`)
const rows = ref<KpiRow[]>([])
const selectedKpiNames = ref<string[]>([])
const cumulativeMode = ref(false)
const chipColors = ['#d9efff', '#def5ec', '#fff0d6', '#eee5ff', '#ffe4e4', '#e4edff', '#e5f2d9']
const chartRows = computed(() => selectedKpiNames.value.length
  ? rows.value.filter(row => selectedKpiNames.value.includes(row.name))
  : rows.value)
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const monthLabel = computed(() => {
  return `tháng ${monthNumber.value}/${year.value}`
})
const totalActual = computed(() => rows.value.reduce((sum, row) => sum + (cumulativeMode.value ? row.cumulativeActual : row.monthlyActual), 0))
const totalPlan = computed(() => rows.value.reduce((sum, row) => sum + (cumulativeMode.value ? row.cumulativePlan : row.monthlyPlan), 0))
const completion = computed(() => totalPlan.value ? totalActual.value / totalPlan.value * 100 : null)
function toggleKpiFilter(name: string) {
  selectedKpiNames.value = selectedKpiNames.value.includes(name)
    ? selectedKpiNames.value.filter(item => item !== name)
    : [...selectedKpiNames.value, name]
}
const pieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: (item: { name: string; value: number; percent: number }) => `${item.name}<br/>${cumulativeMode.value ? 'Thực hiện lũy kế' : 'Thực hiện tháng'}: ${numberFormat.format(item.value)} (${item.percent}%)` },
  legend: { type: 'plain', orient: 'horizontal', left: 'center', bottom: 0, width: '96%', itemGap: 10, textStyle: { color: '#526a7b', fontSize: 11 } },
  series: [{ type: 'pie', radius: ['40%', '67%'], center: ['50%', '42%'], itemStyle: { borderColor: '#fff', borderWidth: 3 }, label: { formatter: '{b}\n{d}%' }, labelLayout: { hideOverlap: true }, data: rows.value.filter(row => (cumulativeMode.value ? row.cumulativeActual : row.monthlyActual) > 0).map(row => ({ name: row.name, value: cumulativeMode.value ? row.cumulativeActual : row.monthlyActual })) }],
}))
const lineOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 4, textStyle: { color: '#526a7b' } },
  grid: { left: 62, right: 24, top: 48, bottom: 85 },
  xAxis: { type: 'category', data: chartRows.value.map(row => row.name), axisLabel: { rotate: chartRows.value.length > 6 ? 30 : 0, interval: 0, color: '#526a7b' } },
  yAxis: { type: 'value', axisLabel: { color: '#526a7b', formatter: (value: number) => numberFormat.format(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  series: [
    { name: 'Kế hoạch tháng', type: 'line', smooth: true, symbolSize: 8, data: chartRows.value.map(row => row.monthlyPlan), itemStyle: { color: '#e58a00' }, lineStyle: { color: '#e58a00', width: 3 } },
    { name: 'Thực hiện tháng', type: 'line', smooth: true, symbolSize: 8, data: chartRows.value.map(row => row.monthlyActual), itemStyle: { color: '#087cba' }, lineStyle: { color: '#087cba', width: 3 }, areaStyle: { color: 'rgba(8,124,186,.08)' } },
  ],
}))
const cumulativeLineOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 4, textStyle: { color: '#526a7b' } },
  grid: { left: 62, right: 24, top: 48, bottom: 85 },
  xAxis: { type: 'category', data: chartRows.value.map(row => row.name), axisLabel: { rotate: chartRows.value.length > 6 ? 30 : 0, interval: 0, color: '#526a7b' } },
  yAxis: { type: 'value', axisLabel: { color: '#526a7b', formatter: (value: number) => numberFormat.format(value) }, splitLine: { lineStyle: { color: '#e8eef3' } } },
  series: [
    { name: 'Kế hoạch lũy kế', type: 'line', smooth: true, symbolSize: 8, data: chartRows.value.map(row => row.cumulativePlan), itemStyle: { color: '#e58a00' }, lineStyle: { color: '#e58a00', width: 3 } },
    { name: 'Thực hiện lũy kế', type: 'line', smooth: true, symbolSize: 8, data: chartRows.value.map(row => row.cumulativeActual), itemStyle: { color: '#087cba' }, lineStyle: { color: '#087cba', width: 3 }, areaStyle: { color: 'rgba(8,124,186,.08)' } },
  ],
}))

async function load() {
  if (!month.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await kpiApi.summary(month.value)
    rows.value = result.rows
    selectedKpiNames.value = selectedKpiNames.value.filter(name => result.rows.some(row => row.name === name))
    loaded.value = true
  } catch (cause) {
    rows.value = []
    loaded.value = true
    error.value = getAuthErrorMessage(cause)
  } finally {
    loading.value = false
  }
}

async function initialize() {
  loading.value = true
  error.value = ''
  try {
    let latestMonth: string | null = null
    try {
      latestMonth = await kpiApi.latestMonth()
    } catch {
      // Keep working with a backend process that has not loaded the latest-month route yet.
    }
    if (latestMonth) {
      const [latestYear, latestMonthNumber] = latestMonth.split('-').map(Number)
      year.value = latestYear
      monthNumber.value = latestMonthNumber
      await load()
      return
    }

    const cursor = new Date(year.value, monthNumber.value - 1, 1)
    for (let attempt = 0; attempt < 24; attempt += 1) {
      year.value = cursor.getFullYear()
      monthNumber.value = cursor.getMonth() + 1
      const result = await kpiApi.summary(month.value)
      if (result.rows.length) {
        rows.value = result.rows
        loaded.value = true
        return
      }
      cursor.setMonth(cursor.getMonth() - 1)
    }
    rows.value = []
    loaded.value = true
  } catch (cause) {
    loaded.value = true
    error.value = getAuthErrorMessage(cause)
  } finally {
    loading.value = false
  }
}

onMounted(initialize)
</script>

<template>
  <v-container class="kpi-page" fluid>
    <header class="page-head">
      <div><span class="eyebrow">HỆ THỐNG DỮ LIỆU GIAO BAN</span><h1>Tổng hợp chỉ tiêu KPI</h1><p>Kế hoạch và kết quả thực hiện theo từng chỉ tiêu trong {{ monthLabel }}.</p></div>
      <v-chip color="primary" variant="tonal" prepend-icon="mdi-calendar-month">{{ monthLabel }}</v-chip>
    </header>
    <v-card class="filter-card" elevation="0"><v-card-text class="filter-row">
      <v-select v-model="monthNumber" :items="monthOptions" label="Tháng báo cáo" variant="outlined" hide-details />
      <v-select v-model="year" :items="yearOptions" label="Năm" variant="outlined" hide-details />
      <v-btn color="primary" prepend-icon="mdi-chart-box-outline" :loading="loading" @click="load">Xem số liệu</v-btn>
      <div class="mode-toggle"><span>{{ cumulativeMode ? 'L\u0169y k\u1ebf' : 'Theo th\u00e1ng' }}</span><v-switch v-model="cumulativeMode" color="primary" density="compact" inset hide-details /></div>
    </v-card-text></v-card>
    <v-alert v-if="error" class="mt-5" type="error" variant="tonal">{{ error }}</v-alert>
    <template v-if="loaded && !error">
      <v-row class="summary-row">
        <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>{{ cumulativeMode ? 'K\u1ebe HO\u1ea0CH L\u0168Y K\u1ebe' : 'K\u1ebe HO\u1ea0CH TH\u00c1NG' }}</small><strong>{{ numberFormat.format(totalPlan) }}</strong></v-card></v-col>
        <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>{{ cumulativeMode ? 'TH\u1ef0C HI\u1ec6N L\u0168Y K\u1ebe' : 'TH\u1ef0C HI\u1ec6N TH\u00c1NG' }}</small><strong>{{ numberFormat.format(totalActual) }}</strong></v-card></v-col>
        <v-col cols="12" sm="4"><v-card class="summary-card" elevation="0"><small>{{ cumulativeMode ? 'HO\u00c0N TH\u00c0NH L\u0168Y K\u1ebe' : 'HO\u00c0N TH\u00c0NH' }}</small><strong>{{ completion == null ? '—' : `${numberFormat.format(completion)}%` }}</strong></v-card></v-col>
      </v-row>
      <v-alert v-if="!rows.length" class="mt-4" type="info" variant="tonal">Không có dữ liệu KPI trong {{ monthLabel }}.</v-alert>
      <v-row v-if="rows.length" class="chart-row detail-row">
        <v-col cols="12" lg="5">
          <v-card class="chart-card" elevation="0">
            <v-card-title><div><strong>{{ cumulativeMode ? 'C\u01a1 c\u1ea5u th\u1ef1c hi\u1ec7n l\u0169y k\u1ebf theo KPI' : 'C\u01a1 c\u1ea5u th\u1ef1c hi\u1ec7n theo KPI' }}</strong><span>{{ cumulativeMode ? 'T\u1ef7 tr\u1ecdng th\u1ef1c hi\u1ec7n l\u0169y k\u1ebf \u0111\u1ebfn' : 'T\u1ef7 tr\u1ecdng th\u1ef1c hi\u1ec7n trong' }} {{ monthLabel }}</span></div></v-card-title>
            <v-card-text><VChart class="chart" :option="pieOption" autoresize /></v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" lg="7">
          <v-card class="table-card" elevation="0">
            <v-card-title><div><strong>Chi tiết số liệu KPI</strong><span>Kế hoạch, thực hiện và tỷ lệ hoàn thành · {{ monthLabel }}</span></div></v-card-title>
            <v-data-table
              :headers="[{ title: 'Chỉ tiêu KPI', key: 'name', fixed: 'start', width: 190 }, { title: 'KH tháng', key: 'monthlyPlan', align: 'end' }, { title: 'TH tháng', key: 'monthlyActual', align: 'end' }, { title: 'Hoàn thành tháng', key: 'monthlyRate', align: 'end' }, { title: 'KH lũy kế', key: 'cumulativePlan', align: 'end' }, { title: 'TH lũy kế', key: 'cumulativeActual', align: 'end' }, { title: 'Hoàn thành lũy kế', key: 'cumulativeRate', align: 'end' }]"
              :items="rows"
              :loading="loading"
              :items-per-page="20"
              :items-per-page-options="[10, 20, 50]"
              density="comfortable"
              hover
              fixed-header
              height="430"
              class="kpi-table"
            >
              <template #item.monthlyPlan="{ value }">{{ numberFormat.format(value) }}</template>
              <template #item.monthlyActual="{ value }">{{ numberFormat.format(value) }}</template>
              <template #item.cumulativePlan="{ value }">{{ numberFormat.format(value) }}</template>
              <template #item.cumulativeActual="{ value }">{{ numberFormat.format(value) }}</template>
              <template #item.monthlyRate="{ value }">{{ value == null ? '—' : numberFormat.format(value) + '%' }}</template>
              <template #item.cumulativeRate="{ value }">{{ value == null ? '—' : numberFormat.format(value) + '%' }}</template>
            </v-data-table>
          </v-card>
        </v-col>
      </v-row>
      <v-card v-if="rows.length" class="filter-card chart-filter" elevation="0">
        <v-card-text>
          <div class="chart-filter-label">Lọc chỉ tiêu trên hai biểu đồ đường</div>
          <div class="chart-filter-grid">
            <v-chip
              class="filter-chip"
              :color="selectedKpiNames.length ? '#38566b' : '#087cba'"
              variant="flat"
              :style="selectedKpiNames.length ? { backgroundColor: '#e8eef3', color: '#38566b' } : undefined"
              prepend-icon="mdi-view-grid-outline"
              @click="selectedKpiNames = []"
            >Tất cả</v-chip>
            <v-chip
              v-for="(row, index) in rows"
              :key="row.name"
              class="filter-chip"
              :color="selectedKpiNames.includes(row.name) ? '#087cba' : '#38566b'"
              variant="flat"
              :style="selectedKpiNames.includes(row.name) ? undefined : { backgroundColor: chipColors[index % chipColors.length], color: '#38566b' }"
              :prepend-icon="selectedKpiNames.includes(row.name) ? 'mdi-check-circle' : undefined"
              @click="toggleKpiFilter(row.name)"
            >{{ row.name }}</v-chip>
          </div>
        </v-card-text>
      </v-card>
      <v-row v-if="rows.length" class="chart-row">
        <v-col cols="12" lg="6"><v-card class="chart-card" elevation="0"><v-card-title><strong>Kế hoạch và thực hiện theo KPI</strong><span>Giá trị tháng {{ monthLabel }}</span></v-card-title><v-card-text><VChart class="chart" :option="lineOption" autoresize /></v-card-text></v-card></v-col>
        <v-col cols="12" lg="6"><v-card class="chart-card" elevation="0"><v-card-title><strong>Kế hoạch và thực hiện lũy kế theo KPI</strong><span>Giá trị lũy kế đến {{ monthLabel }}</span></v-card-title><v-card-text><VChart class="chart" :option="cumulativeLineOption" autoresize /></v-card-text></v-card></v-col>
      </v-row>
    </template>
  </v-container>
</template>

<style scoped>
.kpi-page{width:min(1500px,calc(100% - 40px));margin:0 auto;padding:28px 0 60px}.page-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:22px}.eyebrow{color:rgb(var(--v-theme-primary));font-size:11px;font-weight:800;letter-spacing:1.2px}.page-head h1{margin:5px 0;color:rgb(var(--v-theme-on-background));font-size:28px}.page-head p{margin:0;color:rgba(var(--v-theme-on-background),.62)}.filter-card,.summary-card,.chart-card,.table-card{border:0;border-radius:12px;background:rgb(var(--v-theme-surface));box-shadow:0 4px 18px rgba(29,61,83,.08)!important}.filter-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.filter-row :deep(.v-input){max-width:280px}.summary-row,.chart-row{margin-top:8px}.chart-filter{margin-top:16px}.chart-filter :deep(.v-card-text){padding:14px 18px}.chart-filter-label{margin-bottom:12px;color:rgba(var(--v-theme-on-surface),.65);font-size:12px;font-weight:700}.chart-filter-grid{display:flex;flex-wrap:nowrap;gap:10px;overflow-x:auto;padding-bottom:3px;scrollbar-width:thin;scrollbar-color:rgba(var(--v-theme-primary),.3) transparent}.filter-chip{flex:0 0 auto;width:auto;height:auto!important;min-height:42px!important;margin:0!important;padding:7px 14px!important;border-radius:12px!important;justify-content:center;white-space:nowrap!important;text-align:center}.filter-chip :deep(.v-chip__content){white-space:nowrap;text-align:center;line-height:1.3}.summary-card{height:100%;padding:18px 20px}.summary-card small,.summary-card strong{display:block}.summary-card small{color:rgba(var(--v-theme-on-surface),.58);font-size:11px;font-weight:700;letter-spacing:.5px}.summary-card strong{margin-top:8px;color:rgb(var(--v-theme-primary));font-size:24px}.chart-card{height:100%;overflow:hidden}.chart-card :deep(.v-card-title),.table-card :deep(.v-card-title){padding:19px 21px 9px;white-space:normal}.chart-card :deep(.v-card-title strong),.chart-card :deep(.v-card-title span),.table-card :deep(.v-card-title strong),.table-card :deep(.v-card-title span){display:block}.chart-card :deep(.v-card-title strong),.table-card :deep(.v-card-title strong){font-size:16px}.chart-card :deep(.v-card-title span),.table-card :deep(.v-card-title span){margin-top:5px;color:rgba(var(--v-theme-on-surface),.56);font-size:12px;font-weight:400}.chart-card :deep(.v-card-text){padding:0 12px 12px}.chart{height:360px}.table-card{height:100%;overflow:hidden}.kpi-table :deep(.v-table__wrapper){scrollbar-width:thin;scrollbar-color:rgba(var(--v-theme-primary),.32) transparent}.kpi-table :deep(table){border-collapse:separate;border-spacing:0}.kpi-table :deep(th){min-width:112px!important;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 7%,rgb(var(--v-theme-surface)))!important;color:rgb(var(--v-theme-primary))!important;font-size:12px!important;font-weight:700!important;white-space:nowrap;z-index:2!important}.kpi-table :deep(th:first-child){position:sticky;left:0;z-index:5!important;min-width:190px!important;background:color-mix(in srgb,rgb(var(--v-theme-primary)) 7%,rgb(var(--v-theme-surface)))!important;box-shadow:2px 0 4px rgba(29,61,83,.08)}.kpi-table :deep(td){min-width:112px;border-bottom-color:rgba(var(--v-border-color),.1)!important;font-size:12px;white-space:nowrap}.kpi-table :deep(td:first-child){position:sticky;left:0;z-index:2;min-width:190px;font-weight:600;background:rgb(var(--v-theme-surface));box-shadow:2px 0 4px rgba(29,61,83,.06)}.kpi-table :deep(tbody tr:nth-child(even) td:first-child){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 2.2%,rgb(var(--v-theme-surface)))}.kpi-table :deep(tbody tr:hover td:first-child){background:color-mix(in srgb,rgb(var(--v-theme-primary)) 6.5%,rgb(var(--v-theme-surface)))!important}.kpi-table :deep(tbody tr:nth-child(even)){background:rgba(var(--v-theme-primary),.022)}.kpi-table :deep(tbody tr:hover){background:rgba(var(--v-theme-primary),.065)!important}.kpi-table :deep(.v-data-table-footer){border-top:1px solid rgba(var(--v-border-color),.1);background:color-mix(in srgb,rgb(var(--v-theme-primary)) 3%,rgb(var(--v-theme-surface)))}@media(max-width:600px){.kpi-page{width:calc(100% - 24px)}.page-head{align-items:flex-start;flex-direction:column}.filter-row{align-items:stretch;flex-direction:column}.filter-row :deep(.v-input){max-width:none}}
.mode-toggle{display:flex;align-items:center;gap:8px;margin-left:auto;padding:0;color:rgb(var(--v-theme-primary));font-size:13px;font-weight:600;white-space:nowrap}.mode-toggle :deep(.v-input){flex:0 0 auto;width:42px;max-width:none;margin:0}.mode-toggle :deep(.v-selection-control){min-height:30px}.mode-toggle :deep(.v-switch__track){opacity:.25}.mode-toggle :deep(.v-switch__thumb){box-shadow:0 1px 4px rgba(20,50,70,.2)}@media(max-width:600px){.mode-toggle{margin-left:0;align-self:flex-end}}</style>
