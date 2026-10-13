import { http } from './http'
import type { ApiResponse } from '../types/api'
import type { KpiSummary } from '../types/kpi'

export const kpiApi = {
  async latestMonth(): Promise<string | null> {
    const response = await http.get<ApiResponse<{ month: string | null }>>('/kpi/latest-month')
    return response.data.data.month
  },
  async summary(month: string): Promise<KpiSummary> {
    const response = await http.post<ApiResponse<KpiSummary>>('/kpi/summary', { month }, { timeout: 120_000 })
    return response.data.data
  },
}
