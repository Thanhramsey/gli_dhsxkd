export interface KpiRow {
  name: string
  monthlyPlan: number
  cumulativePlan: number
  monthlyActual: number
  cumulativeActual: number
  monthlyRate: number | null
  cumulativeRate: number | null
}

export interface KpiSummary {
  month: string
  rows: KpiRow[]
}

export interface KpiFiberDevelopmentRow {
  kpi: string
  kpiName: string
  unitGroup: string
  unitCode: string
  unitName: string
  plan: number | null
  actual: number | null
  cumulativePlan: number | null
  cumulativeActual: number | null
  annualPlan: number | null
}

export interface KpiFiberDevelopment {
  month: string
  rows: KpiFiberDevelopmentRow[]
}

export interface KpiFiberPscRow {
  service: string
  unitGroup: string
  unitCode: string
  unitName: string
  monthlyPscSubscribers: number | null
  monthlyNetPscSubscribers: number | null
  monthlyRevenue: number | null
  cumulativeRevenue: number | null
  monthlyRevenuePlan: number | null
  cumulativeRevenuePlan: number | null
  annualRevenuePlan: number | null
}

export interface KpiFiberPsc {
  month: string
  rows: KpiFiberPscRow[]
}

export type KpiV2Code = string

export interface KpiV2Row {
  kpi: KpiV2Code
  unitCode: string
  unitName: string
  chartName: string
  monthlyRevenue: number | null
  monthlyPlan: number | null
  cumulativeRevenue: number | null
  cumulativePlan: number | null
  annualPlan: number | null
  rank: number | null
  cumulativeRank: number | null
  annualRank: number | null
  monthlyChange: number | null
  remainingAnnual: number | null
}

export interface KpiV2Report {
  month: string
  rows: KpiV2Row[]
}

export interface KpiV2SubscriberRow {
  kpi: string
  unitCode: string
  unitName: string
  service: string
  indicator: string
  previousYear: number | null
  currentYear: number | null
  previousCount: number | null
  currentCount: number | null
  change: number | null
}

export interface KpiV2SubscriberReport {
  month: string
  rows: KpiV2SubscriberRow[]
}

export interface KpiV2TrendRow {
  month: string
  monthlyRevenue: number | null
  monthlyPlan: number | null
  cumulativeRevenue: number | null
  cumulativePlan: number | null
  annualPlan: number | null
  monthlyChange: number | null
  remainingAnnual: number | null
}

export interface KpiV2UnitTrend {
  month: string
  kpi: string
  unitCode: string
  rows: KpiV2TrendRow[]
}

export interface KpiSubscriberMovementRow {
  centerCode: string
  centerName: string
  teamCode: string
  teamName: string
  areaCode: string
  areaName: string
  values: Record<string, number | null>
}

export interface KpiSubscriberMovement {
  month: string
  rows: KpiSubscriberMovementRow[]
}

export type KpiTrendProcedure =
  | 'TONG_HOP_KPI_BRCD'
  | 'TONG_HOP_KPI_MYTV'
  | 'TONG_HOP_KPI_CAM'
  | 'TONG_HOP_KPI_MESH'
  | 'TONG_HOP_KPI_TSL'
  | 'TONG_HOP_KPI_DITT'
  | 'TONG_HOP_KPI_CNTT'
  | 'TONG_HOP_KPI_VINA_TS'

export interface KpiTrendRow {
  month: string
  subscribers: number | null
  revenue: number | null
  plan?: number | null
  completionRate?: number | null
  cumulativeRevenue?: number | null
  cumulativePlan?: number | null
  cumulativeRate?: number | null
  annualPlan?: number | null
  annualRate?: number | null
  snapshotMonth?: string | null
  billingCycle?: string | null
  chartName?: string | null
  kpi?: string | null
  updatedAt?: string | null
}

export interface KpiTrend {
  month: string
  rows: KpiTrendRow[]
}

export type KpiPscProcedure = 'TYLE_NGUNG_PSC_FIBER' | 'TYLE_NGUNG_PSC_MYTV'

export interface KpiPscRow {
  unitCode: string
  unitName: string
  monthlyNew: number | null
  monthlyPsc: number | null
  cumulativeNew: number | null
  cumulativePsc: number | null
  cumulativeNetGrowth: number | null
  cumulativeStopped: number | null
  cumulativeStopRate: number | null
}

export interface KpiPsc {
  month: string
  rows: KpiPscRow[]
}

export interface KpiMaintenanceRow {
  unitCode: string
  unitName: string
  baseRevenueFiber: number | null
  baseRevenueMyTv: number | null
  baseRevenue: number | null
  cumulativeBaseRevenueFiber: number | null
  cumulativeBaseRevenueMyTv: number | null
  cumulativeBaseRevenue: number | null
  fiberSubscribers: number | null
  mytvSubscribers: number | null
  subscribers: number | null
  arpuFiber: number | null
  arpuMyTv: number | null
  stoppedFiberSubscribers: number | null
  stoppedMyTvSubscribers: number | null
  stoppedSubscribers: number | null
  stoppedFiberRevenue: number | null
  stoppedMyTvRevenue: number | null
  stoppedRevenue: number | null
  estimatedCanceledFiberRevenue: number | null
  estimatedCanceledMyTvRevenue: number | null
  estimatedCanceledRevenue: number | null
  maintainedRevenue: number | null
  maintainedRate: number | null
}

export interface KpiMaintenance {
  month: string
  rows: KpiMaintenanceRow[]
}
