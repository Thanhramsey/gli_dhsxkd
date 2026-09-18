import { http } from './http'
import type { ApiResponse } from '../types/api'
import type {
  AdminGroup,
  AdminUser,
  EmployeeOption,
  MenuInput,
  MenuItem,
  ReportDefinition,
  ReportGroup,
  ReportGroupInput,
  ReportInput,
  UserInput,
} from '../types/admin'

export const adminApi = {
  async users(search = ''): Promise<AdminUser[]> {
    const response = await http.get<ApiResponse<AdminUser[]>>('/admin/users', { params: { search } })
    return response.data.data
  },
  async createUser(input: UserInput): Promise<void> {
    await http.post('/admin/users', input)
  },
  async updateUser(id: string, input: Partial<UserInput>): Promise<void> {
    await http.patch(`/admin/users/${id}`, input)
  },
  async deleteUser(id: string): Promise<void> {
    await http.delete(`/admin/users/${id}`)
  },
  async employees(search = ''): Promise<EmployeeOption[]> {
    const response = await http.get<ApiResponse<EmployeeOption[]>>('/admin/employees', { params: { search } })
    return response.data.data
  },
  async groups(): Promise<AdminGroup[]> {
    const response = await http.get<ApiResponse<AdminGroup[]>>('/admin/groups')
    return response.data.data
  },
  async createGroup(name: string): Promise<void> {
    await http.post('/admin/groups', { name })
  },
  async updateGroup(id: string, name: string): Promise<void> {
    await http.patch(`/admin/groups/${id}`, { name })
  },
  async deleteGroup(id: string): Promise<void> {
    await http.delete(`/admin/groups/${id}`)
  },
  async assignGroupMenus(id: string, menuIds: string[]): Promise<void> {
    await http.put(`/admin/groups/${id}/menus`, { ids: menuIds })
  },
  async menus(): Promise<MenuItem[]> {
    const response = await http.get<ApiResponse<MenuItem[]>>('/admin/menus')
    return response.data.data
  },
  async createMenu(input: MenuInput): Promise<void> {
    await http.post('/admin/menus', input)
  },
  async updateMenu(id: string, input: Partial<MenuInput>): Promise<void> {
    await http.patch(`/admin/menus/${id}`, input)
  },
  async deleteMenu(id: string): Promise<void> {
    await http.delete(`/admin/menus/${id}`)
  },
  async reportGroups(): Promise<ReportGroup[]> {
    const response = await http.get<ApiResponse<ReportGroup[]>>('/admin/report-groups')
    return response.data.data
  },
  async createReportGroup(input: ReportGroupInput): Promise<void> {
    await http.post('/admin/report-groups', input)
  },
  async updateReportGroup(id: string, input: ReportGroupInput): Promise<void> {
    await http.patch(`/admin/report-groups/${id}`, input)
  },
  async deleteReportGroup(id: string): Promise<void> {
    await http.delete(`/admin/report-groups/${id}`)
  },
  async reports(search = '', groupId = ''): Promise<ReportDefinition[]> {
    const response = await http.get<ApiResponse<ReportDefinition[]>>('/admin/reports', {
      params: { search, groupId },
    })
    return response.data.data
  },
  async createReport(input: ReportInput): Promise<void> {
    await http.post('/admin/reports', input)
  },
  async updateReport(id: string, input: ReportInput): Promise<void> {
    await http.patch(`/admin/reports/${id}`, input)
  },
  async deleteReport(id: string): Promise<void> {
    await http.delete(`/admin/reports/${id}`)
  },
}
