import { http } from './http'
import type { ApiResponse } from '../types/api'
import type { KpiMaintenance, KpiPsc, KpiPscProcedure, KpiSummary, KpiTrend, KpiTrendProcedure } from '../types/kpi'

export const kpiApi = {
  async latestMonth(procedure?: KpiTrendProcedure): Promise<string | null> {
    const response = await http.get<ApiResponse<{ month: string | null }>>('/kpi/latest-month', { params: procedure ? { procedure } : undefined })
    return response.data.data.month
  },
  async summary(month: string): Promise<KpiSummary> {
    const response = await http.post<ApiResponse<KpiSummary>>('/kpi/summary', { month }, { timeout: 120_000 })
    return response.data.data
  },
  async trend(month: string, procedure: KpiTrendProcedure): Promise<KpiTrend> {
    const response = await http.post<ApiResponse<KpiTrend>>('/kpi/trend', { month, procedure }, { timeout: 120_000 })
    return response.data.data
  },
  async psc(month: string, procedure: KpiPscProcedure): Promise<KpiPsc> {
    const response = await http.post<ApiResponse<KpiPsc>>('/kpi/psc', { month, procedure }, { timeout: 120_000 })
    return response.data.data
  },
  async maintenance(month: string): Promise<KpiMaintenance> {
    const response = await http.post<ApiResponse<KpiMaintenance>>('/kpi/maintenance', { month }, { timeout: 120_000 })
    return response.data.data
  },
}
