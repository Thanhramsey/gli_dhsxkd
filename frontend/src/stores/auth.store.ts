import { defineStore } from 'pinia'
import { authApi } from '../api/auth.api'
import type { AuthUser, MenuItem } from '../types/auth'

const menuAdminCode = import.meta.env.VITE_MENU_ADMIN_CODE || 'MENU_MANAGEMENT'
const adminGroupIds = (import.meta.env.VITE_ADMIN_GROUP_IDS || '1').split(',').map((id: string) => id.trim())

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    menus: [] as MenuItem[],
    initialized: false,
    loading: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
    canManageMenus: (state) =>
      Boolean(
        state.user?.menuCodes.includes(menuAdminCode) ||
          state.user?.groupIds?.some((groupId) => adminGroupIds.includes(groupId)) ||
          state.menus.some((menu) => menu.path === '/menu-management'),
      ),
  },
  actions: {
    async login(account: string) {
      this.loading = true
      try {
        this.user = await authApi.login(account)
        this.menus = await authApi.myMenus()
        this.initialized = true
      } finally {
        this.loading = false
      }
    },
    async restoreSession() {
      if (this.initialized) return
      try {
        this.user = await authApi.me()
        this.menus = await authApi.myMenus()
      } catch {
        this.user = null
        this.menus = []
      } finally {
        this.initialized = true
      }
    },
    async logout() {
      try {
        await authApi.logout()
      } finally {
        this.user = null
        this.menus = []
        this.initialized = true
      }
    },
  },
})
