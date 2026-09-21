export type BroadbandProcedureKey =
  | 'ptm-employee'
  | 'ptm-location'
  | 'ptm-area'
  | 'xgspon-location'
  | 'xgspon-employee'
  | 'cancel-location'
  | 'cancel-area'

export interface BroadbandFilter {
  fromDate: string
  toDate: string
  unitId: number
  serviceId: number
  subscriberTypeId: number
  areaId: number
}

export interface BroadbandProcedureResult {
  key: BroadbandProcedureKey
  procedure: string
  title: string
  rows: Array<Record<string, unknown>>
}

export interface BroadbandUnit {
  id: number
  name: string
}
