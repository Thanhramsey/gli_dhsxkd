import { http } from './http'
import type { ApiResponse } from '../types/api'
import type {
  BroadbandFilter,
  BroadbandProcedureKey,
  BroadbandProcedureResult,
} from '../types/broadband'

export const broadbandApi = {
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
