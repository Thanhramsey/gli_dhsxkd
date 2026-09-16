export interface ApiMeta {
  requestId: string
  timestamp: string
}

export interface ApiResponse<T> {
  success: true
  data: T
  meta: ApiMeta
}

export interface ApiErrorResponse {
  statusCode: number
  message: string | string[]
  timestamp: string
  path: string
}

export interface ApiHealth {
  status: 'ok'
}

export interface OracleHealth {
  status: 'connected'
  databaseTime: string
}