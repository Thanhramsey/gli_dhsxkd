import type { AxiosError } from 'axios'
import { http } from './http'
import type { ApiErrorResponse, ApiResponse } from '../types/api'
import type { AuthUser, MenuItem, UserGroup } from '../types/auth'

interface AuthPayload {
  user: AuthUser
}

function normalizeUser(user: AuthUser): AuthUser {
  return {
    ...user,
    groupIds: user.groupIds ?? (user.groupId ? [user.groupId] : []),
    menuCodes: user.menuCodes ?? [],
  }
}

function normalizeMenu(menu: MenuItem): MenuItem {
  return {
    ...menu,
    isHeading: menu.isHeading ?? false,
    children: (menu.children ?? []).map(normalizeMenu),
  }
}

export const authApi = {
  async login(account: string): Promise<AuthUser> {
    const response = await http.post<ApiResponse<AuthPayload>>('/auth/login', { account })
    return normalizeUser(response.data.data.user)
  },
  async me(): Promise<AuthUser> {
    const response = await http.get<ApiResponse<AuthPayload>>('/auth/me')
    return normalizeUser(response.data.data.user)
  },
  async logout(): Promise<void> {
    await http.post('/auth/logout')
  },
  async myMenus(): Promise<MenuItem[]> {
    const response = await http.get<ApiResponse<MenuItem[]>>('/menus/mine')
    return response.data.data.map(normalizeMenu)
  },
  async menuCatalog(): Promise<MenuItem[]> {
    const response = await http.get<ApiResponse<MenuItem[]>>('/menus/catalog')
    return response.data.data.map(normalizeMenu)
  },
  async groups(): Promise<UserGroup[]> {
    const response = await http.get<ApiResponse<UserGroup[]>>('/menus/groups')
    return response.data.data
  },
}

export function getAuthErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ApiErrorResponse>
  const message = axiosError.response?.data?.message
  if (Array.isArray(message)) return message.join(', ')
  return message || 'Không thể đăng nhập. Vui lòng thử lại.'
}
