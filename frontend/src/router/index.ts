import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/menu-management',
      name: 'menu-management',
      component: () => import('../views/MenuManagementView.vue'),
      meta: { menuAdmin: true },
    },
    {
      path: '/report-groups',
      name: 'report-groups',
      component: () => import('../views/ReportConfigurationView.vue'),
      meta: { menuAdmin: true },
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('../views/ReportConfigurationView.vue'),
      meta: { menuAdmin: true },
    },
    {
      path: '/system-status',
      name: 'system-status',
      component: () => import('../views/SystemStatusView.vue'),
    },
    {
      path: '/broadband',
      alias: ['/bang-rong', '/bcpt-bang-rong', '/he-thong-dl-giao-ban'],
      name: 'broadband',
      component: () => import('../views/BroadbandView.vue'),
    },
    {
      path: '/bcpt-cntt',
      alias: ['/cntt'],
      name: 'bcpt-cntt',
      component: () => import('../views/CnttView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'module-placeholder',
      component: () => import('../views/ModulePlaceholderView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.restoreSession()

  if (to.meta.public) return auth.isAuthenticated ? { name: 'home' } : true
  if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.menuAdmin && !auth.canManageMenus) return { name: 'home' }
  return true
})
