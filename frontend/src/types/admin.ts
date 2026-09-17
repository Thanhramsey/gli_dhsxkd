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

export type { MenuItem }
