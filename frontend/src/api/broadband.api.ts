import { http } from './http'
import type { ApiResponse } from '../types/api'
import type {
  BroadbandFilter,
  BroadbandProcedureKey,
  BroadbandProcedureResult,
  BroadbandUnit,
} from '../types/broadband'

export const broadbandApi = {
  async units(): Promise<BroadbandUnit[]> {
    const response = await http.get<ApiResponse<BroadbandUnit[]>>('/broadband/units')
    return response.data.data
  },

  async execute(
    key: BroadbandProcedureKey,
    filter: BroadbandFilter,
  ): Promise<BroadbandProcedureResult> {
    const response = await http.post<ApiResponse<BroadbandProcedureResult>>(
      `/broadband/procedures/${key}`,
      filter,
      { timeout: 120_000 },
    )
    return response.data.data
  },
}
