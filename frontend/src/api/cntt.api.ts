import { http } from './http'
import type { ApiResponse } from '../types/api'
import type { CnttRevenueResult } from '../types/cntt'

export const cnttApi = {
  async revenue(month: string): Promise<CnttRevenueResult> {
    const response = await http.post<ApiResponse<CnttRevenueResult>>(
      '/cntt/revenue',
      { month },
      { timeout: 120_000 },
    )
    return response.data.data
  },
}
