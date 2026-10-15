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
  | 'TONG_HOP_KPI_CAM_MESH'
  | 'TONG_HOP_KPI_TSL'
  | 'TONG_HOP_KPI_CNTT'
  | 'TONG_HOP_KPI_VINA_TS'

export interface KpiTrendRow {
  month: string
  subscribers: number | null
  revenue: number | null
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
