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
