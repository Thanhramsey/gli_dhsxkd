export interface EmployeeProfile {
  employeeId: string | null
  employeeCode: string | null
  fullName: string
  title: string | null
  phone: string | null
  email: string | null
  unitId: string | null
  unitCode: string | null
  unitName: string | null
}

export interface AuthUser {
  userId: string
  account: string
  displayName: string
  groupIds: string[]
  groupId: string | null
  groupName: string | null
  employee: EmployeeProfile
  menuCodes: string[]
  source: 'V_NGUOIDUNG_DIABAN'
}

export interface MenuItem {
  id: string
  parentId: string | null
  name: string
  title: string
  code: string
  path: string | null
  component: string | null
  redirect: string | null
  icon: string | null
  orderNo: number
  status: string | null
  show: string | null
  affix: string | null
  isHeading: boolean
  children: MenuItem[]
}

export interface UserGroup {
  id: string
  name: string
}
