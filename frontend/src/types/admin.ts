import type { MenuItem } from './auth'

export interface AdminUser {
  id: string
  account: string
  displayName: string
  employeeId: string
  employeeCode: string | null
  employeeName: string | null
  unitName: string | null
  status: number
  groupIds: string[]
  groupNames: string[]
}

export interface AdminGroup {
  id: string
  name: string
  menuIds: string[]
  userCount: number
}

export interface EmployeeOption {
  id: string
  code: string
  name: string
  unitName: string | null
}

export interface UserInput {
  account: string
  employeeId: string
  status: number
  groupIds: string[]
}

export interface MenuInput {
  name: string
  url?: string
  parentId?: string
  orderIndex?: number
  icon?: string
  isHeading: boolean
}

export interface ReportGroup {
  id: string
  name: string
  note: string | null
  reportCount: number
}

export interface ReportDefinition {
  id: string
  name: string
  sql: string | null
  parameters: Array<string | null>
  reportView: string | null
  reportExport: string | null
  groupId: string | null
  groupName: string | null
  procedurePackage: string | null
}

export interface ReportGroupInput {
  name: string
  note?: string
}

export interface ReportInput {
  name: string
  sql?: string
  tm1?: string
  tm2?: string
  tm3?: string
  tm4?: string
  tm5?: string
  tm6?: string
  tm7?: string
  reportView?: string
  reportExport?: string
  groupId?: string
  procedurePackage?: string
}

export type { MenuItem }
