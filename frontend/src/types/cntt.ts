export interface CnttRevenueRow {
  unitId: number | null
  unitName: string
  plan: number
  serviceGroupA: number
  serviceGroupBC: number
  serviceRevenue: number
  equipmentGroupA: number
  equipmentGroupBC: number
  equipmentRevenue: number
  actual: number
  completionRate: number | null
  isTotal: boolean
}

export interface CnttRevenueResult {
  month: string
  rows: CnttRevenueRow[]
}
