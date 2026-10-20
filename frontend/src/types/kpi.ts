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

export type KpiTrendProcedure =
  | 'TONG_HOP_KPI_BRCD'
  | 'TONG_HOP_KPI_MYTV'
  | 'TONG_HOP_KPI_CAM'
  | 'TONG_HOP_KPI_MESH'
  | 'TONG_HOP_KPI_TSL'
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
