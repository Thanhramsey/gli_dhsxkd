import type { AxiosError } from 'axios'
import { http } from './http'
import type {
  ApiErrorResponse,
  ApiHealth,
  ApiResponse,
  OracleHealth,
} from '../types/api'

export const healthApi = {
  async getApiHealth(): Promise<ApiHealth> {
    const response = await http.get<ApiResponse<ApiHealth>>('/health')
    return response.data.data
  },

  async getOracleHealth(): Promise<OracleHealth> {
    const response = await http.get<ApiResponse<OracleHealth>>('/health/oracle')
    return response.data.data
  },
}

export function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ApiErrorResponse>
  const message = axiosError.response?.data?.message

  if (Array.isArray(message)) return message.join(', ')
  if (message) return message
  if (axiosError.code === 'ECONNABORTED') return 'Yêu cầu hết thời gian chờ'

  return 'Không thể kết nối đến dịch vụ'
}