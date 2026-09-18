<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay, useTheme } from 'vuetify'
import vnptLogo from '../../assets/vnpt-logo.png'
import { useAuthStore } from '../../stores/auth.store'
import MenuTreeItem from './MenuTreeItem.vue'

const auth = useAuthStore()
const router = useRouter()
const { mobile } = useDisplay()
const theme = useTheme()
const collapsed = ref(false)
const drawerOpen = ref(!mobile.value)
const userMenuOpen = ref(false)

watch(mobile, (isMobile) => {
  drawerOpen.value = !isMobile
  if (isMobile) collapsed.value = false
})

const savedTheme = localStorage.getItem('dashboard-theme')
if (savedTheme === 'dashboardDark' || savedTheme === 'dashboardTheme') {
  theme.change(savedTheme)
}

const isDark = computed(() => theme.global.current.value.dark)
const initials = computed(() =>
  (auth.user?.employee.fullName || auth.user?.displayName || 'ND')
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join(''),
)
const userRoleLabel = computed(() => {
  const employeeTitle = auth.user?.employee.title?.trim()
  const hasReadableTitle = employeeTitle && !/^\d+$/.test(employeeTitle)

  if (hasReadableTitle) return employeeTitle
  return auth.user?.groupName || 'Chưa phân quyền'
})


function toggleSidebar() {
  if (mobile.value) drawerOpen.value = !drawerOpen.value
  else collapsed.value = !collapsed.value
}

function toggleTheme() {
  const nextTheme = isDark.value ? 'dashboardTheme' : 'dashboardDark'
  theme.change(nextTheme)
  localStorage.setItem('dashboard-theme', nextTheme)
}

async function logout() {
  userMenuOpen.value = false
  await auth.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="dashboard-shell" :class="{ 'dashboard-shell--dark': isDark }">
    <v-navigation-drawer
      v-model="drawerOpen"
      class="app-drawer"
      color="#173650"
      :rail="collapsed && !mobile"
      :temporary="mobile"
      :width="260"
      :rail-width="76"
    >
      <template #prepend>
        <div class="drawer-brand">
          <img class="drawer-brand__logo" :src="vnptLogo" alt="VNPT" />
          <div v-if="!collapsed || mobile" class="drawer-brand__copy">
            <strong>Gia Lai</strong>
            <small>DASHBOARD ĐIỀU HÀNH</small>
          </div>
        </div>
      </template>

      <v-list class="sidebar-nav" nav density="compact" aria-label="Menu chức năng">
        <v-list-subheader v-if="!collapsed || mobile">TỔNG QUAN</v-list-subheader>
        <v-list-item to="/" title="Trang chủ" prepend-icon="mdi-view-dashboard-outline" rounded="lg" @click="mobile && (drawerOpen = false)" />

        <v-list-subheader v-if="(!collapsed || mobile) && auth.menus.length">CHỨC NĂNG</v-list-subheader>
        <MenuTreeItem v-for="menu in auth.menus" :key="menu.id" :item="menu" />

        <v-list-subheader v-if="!collapsed || mobile">HỆ THỐNG</v-list-subheader>
        <v-list-item v-if="auth.canManageMenus" to="/menu-management" title="Quản trị hệ thống" prepend-icon="mdi-shield-account-outline" rounded="lg" @click="mobile && (drawerOpen = false)" />
        <v-list-item v-if="auth.canManageMenus" to="/report-groups" title="Nhóm báo cáo" prepend-icon="mdi-folder-table-outline" rounded="lg" @click="mobile && (drawerOpen = false)" />
        <v-list-item v-if="auth.canManageMenus" to="/reports" title="Báo cáo" prepend-icon="mdi-file-chart-outline" rounded="lg" @click="mobile && (drawerOpen = false)" />
        <v-list-item to="/system-status" title="Trạng thái hệ thống" prepend-icon="mdi-server-network-outline" rounded="lg" @click="mobile && (drawerOpen = false)" />
      </v-list>

      <template v-if="!mobile" #append>
        <v-divider />
        <v-btn class="drawer-collapse" variant="text" block :prepend-icon="collapsed ? 'mdi-chevron-right' : 'mdi-chevron-left'" @click="toggleSidebar">
          <span v-if="!collapsed">Thu gọn</span>
        </v-btn>
      </template>
    </v-navigation-drawer>

    <v-app-bar class="app-topbar" flat border density="comfortable">
      <v-app-bar-nav-icon aria-label="Thu gọn hoặc mở menu" @click="toggleSidebar" />
      <!-- <img class="topbar__logo" :src="vnptLogo" alt="VNPT" /> -->
      <!-- <v-app-bar-title class="topbar__title">
        <strong>Dashboard điều hành</strong>
        <small>{{ auth.user?.employee.unitName || 'VNPT Gia Lai' }}</small>
      </v-app-bar-title> -->
      <v-spacer></v-spacer>


      <v-menu v-model="userMenuOpen" location="bottom end" :close-on-content-click="false">
        <template #activator="{ props }">
          <v-btn v-bind="props" class="user-menu__trigger" variant="text" height="48">
            <v-avatar color="primary" size="36">{{ initials }}</v-avatar>
            <span class="user-menu__identity">
              <strong>{{ auth.user?.employee.fullName || auth.user?.displayName }}</strong>
              <small>{{ userRoleLabel }}</small>
            </span>
            <v-icon icon="mdi-chevron-down" size="18" />
          </v-btn>
        </template>

        <v-card class="user-dropdown" min-width="290">
          <v-list>
             <v-list-item :title="auth.user?.employee.fullName || auth.user?.displayName" :subtitle="`${auth.user?.account} · ${userRoleLabel}`">
              <template #prepend><v-avatar color="primary" size="42">{{ initials }}</v-avatar></template>
            </v-list-item>
          </v-list>
          <v-divider />
          <v-list nav density="comfortable">
            <v-list-item :title="isDark ? 'Giao diện sáng' : 'Giao diện tối'" subtitle="Đổi theme hiển thị" :prepend-icon="isDark ? 'mdi-white-balance-sunny' : 'mdi-weather-night'" @click="toggleTheme" />
            <v-list-item class="text-error" title="Đăng xuất" subtitle="Kết thúc phiên làm việc" prepend-icon="mdi-logout" @click="logout" />
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <v-main class="dashboard-content">
      <slot />
    </v-main>
  </div>
</template>

<style scoped>
.dashboard-shell { --sidebar-width: 260px; --app-bg: #f4f7fb; --surface: #fff; --border: #dce5ed; --text: #284256; --muted: #7b8d9b; min-height: 100vh; color: var(--text); background: var(--app-bg); }
.dashboard-shell--collapsed { --sidebar-width: 76px; }
.dashboard-shell--dark { --app-bg: #111923; --surface: #1b2734; --border: #2c3b49; --text: #e5edf4; --muted: #91a2b0; }
.sidebar { position: fixed; z-index: 40; inset: 0 auto 0 0; width: var(--sidebar-width); display: flex; flex-direction: column; color: #d4e0e8; background: #173650; box-shadow: 3px 0 16px rgba(15, 37, 54, .13); transition: width .2s ease, transform .2s ease; }
.sidebar__brand { min-height: 64px; display: flex; align-items: center; gap: 11px; padding: 0 12px; background: linear-gradient(100deg, #0068b5, #0097d0); }
.sidebar__logo { width: 88px; height: 38px; flex: 0 0 auto; object-fit: contain; padding: 5px 7px; background: #fff; border-radius: 7px; box-shadow: 0 4px 12px rgba(0,51,91,.18); transition: width .2s ease; }
.dashboard-shell--collapsed .sidebar__logo { width: 52px; }
.sidebar__brand-copy { min-width: 0; }.sidebar__brand-copy strong,.sidebar__brand-copy small { display: block; white-space: nowrap; }.sidebar__brand-copy strong { color: #fff; font-size: 15px; }.sidebar__brand-copy small { margin-top: 3px; color: rgba(255,255,255,.7); font-size: 8px; letter-spacing: .8px; }
.sidebar__nav { flex: 1; overflow-x: hidden; overflow-y: auto; padding: 14px 0; }
.sidebar__section-title { margin: 15px 18px 7px; color: #718da1; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
.sidebar-link { width: calc(100% - 16px); min-height: 42px; display: flex; align-items: center; gap: 11px; margin: 3px 8px; padding: 8px 11px; color: #cbd9e4; text-decoration: none; border-radius: 6px; transition: background .15s, color .15s; }
.sidebar-link:hover { color: #fff; background: rgba(255,255,255,.08); }.sidebar-link.router-link-active { color: #fff; background: linear-gradient(90deg, #0079bd, #059ed2); box-shadow: 0 4px 12px rgba(0,111,177,.2); }
.sidebar-link__icon { display: grid; place-items: center; flex: 0 0 22px; color: #61c7eb; font-size: 13px; }.sidebar-link > span:last-child { overflow: hidden; white-space: nowrap; font-size: 12px; font-weight: 500; }
.dashboard-shell--collapsed .sidebar-link { width: 46px; justify-content: center; margin-inline: auto; padding: 8px; }
.sidebar__collapse { min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 9px; color: #a9bdca; cursor: pointer; background: rgba(4, 27, 43, .25); border: 0; border-top: 1px solid rgba(255,255,255,.07); font-family: inherit; font-size: 11px; }.sidebar__collapse:hover { color: #fff; background: rgba(4,27,43,.4); }.sidebar__collapse span:first-child { font-size: 24px; }
.topbar { position: fixed; z-index: 30; top: 0; right: 0; left: var(--sidebar-width); height: 64px; display: flex; align-items: center; padding: 0 18px; background: var(--surface); border-bottom: 1px solid var(--border); box-shadow: 0 2px 8px rgba(37, 65, 86, .04); transition: left .2s ease; }
.topbar__toggle { width: 38px; height: 38px; display: grid; place-content: center; gap: 4px; margin-right: 12px; cursor: pointer; background: transparent; border: 0; border-radius: 6px; }.topbar__toggle:hover { background: rgba(0,104,181,.08); }.topbar__toggle span { width: 18px; height: 2px; background: #5a7182; border-radius: 2px; }
.topbar__logo { width: 82px; height: 30px; object-fit: contain; margin-right: 12px; padding-right: 12px; background: #fff; border-right: 1px solid var(--border); }
.topbar__title strong,.topbar__title small { display: block; }.topbar__title strong { color: var(--text); font-size: 14px; }.topbar__title small { margin-top: 2px; color: var(--muted); font-size: 9px; }.topbar__spacer { flex: 1; }
.user-menu { position: relative; }.user-menu__trigger { display: flex; align-items: center; gap: 10px; min-width: 210px; padding: 6px 8px; color: inherit; cursor: pointer; background: transparent; border: 0; border-radius: 7px; font-family: inherit; text-align: left; }.user-menu__trigger:hover { background: rgba(0,104,181,.07); }
.user-menu__avatar { display: grid; place-items: center; flex: 0 0 36px; height: 36px; color: #fff; background: linear-gradient(135deg, #0078bd, #00afd9); border-radius: 50%; font-size: 11px; font-weight: 700; }.user-menu__avatar--large { flex-basis: 44px; height: 44px; font-size: 13px; }
.user-menu__identity { min-width: 0; flex: 1; }.user-menu__identity strong,.user-menu__identity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.user-menu__identity strong { color: var(--text); font-size: 11px; }.user-menu__identity small { margin-top: 3px; color: var(--muted); font-size: 9px; }.user-menu__chevron { width: 7px; height: 7px; margin: 0 3px 3px 5px; border-right: 1.5px solid var(--muted); border-bottom: 1.5px solid var(--muted); transform: rotate(45deg); transition: transform .15s; }.user-menu__chevron--open { margin-bottom: -3px; transform: rotate(225deg); }
.user-dropdown { position: absolute; top: calc(100% + 9px); right: 0; width: 270px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 14px 36px rgba(20, 46, 66, .2); }.user-dropdown__header { display: flex; align-items: center; gap: 11px; padding: 16px; border-bottom: 1px solid var(--border); }.user-dropdown__header div { min-width: 0; }.user-dropdown__header strong,.user-dropdown__header small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.user-dropdown__header strong { color: var(--text); font-size: 12px; }.user-dropdown__header small { margin-top: 3px; color: var(--muted); font-size: 10px; }
.user-dropdown > button { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 16px; color: inherit; cursor: pointer; background: transparent; border: 0; border-bottom: 1px solid var(--border); font-family: inherit; text-align: left; }.user-dropdown > button:last-child { border-bottom: 0; }.user-dropdown > button:hover { background: rgba(0,104,181,.07); }.user-dropdown > button > span { width: 24px; color: #0078bd; font-size: 18px; text-align: center; }.user-dropdown > button strong,.user-dropdown > button small { display: block; }.user-dropdown > button strong { color: var(--text); font-size: 11px; }.user-dropdown > button small { margin-top: 3px; color: var(--muted); font-size: 9px; }.user-dropdown__logout strong,.user-dropdown__logout > span { color: #c0392b !important; }
.dashboard-content { min-height: 100vh; background: var(--app-bg); }
.dashboard-shell--dark :deep(.panel),.dashboard-shell--dark :deep(.page-heading__date),.dashboard-shell--dark :deep(.quick-item),.dashboard-shell--dark :deep(.catalog),.dashboard-shell--dark :deep(.summary-grid > div) { color: var(--text); background: var(--surface); border-color: var(--border); }.dashboard-shell--dark :deep(.panel__header),.dashboard-shell--dark :deep(.employee-info > div) { border-color: var(--border); }.dashboard-shell--dark :deep(.page-heading h1),.dashboard-shell--dark :deep(.panel__header h2),.dashboard-shell--dark :deep(.quick-item strong),.dashboard-shell--dark :deep(.employee-info dd) { color: var(--text); }.dashboard-shell--dark :deep(.quick-grid) { background: var(--border); }
.sidebar-overlay { display: none; }
@media (max-width: 959px) { .sidebar { width: 260px; transform: translateX(-105%); }.sidebar--open { transform: translateX(0); }.topbar { left: 0; }.dashboard-content { margin-left: 0; }.sidebar__collapse { display: none; }.sidebar-overlay { position: fixed; z-index: 35; inset: 0; display: block; background: rgba(9,25,37,.5); border: 0; }.user-menu__trigger { min-width: 0; }.user-menu__identity { display: none; } }
@media (max-width: 560px) { .topbar { padding-inline: 10px; }.topbar__logo { width: 70px; margin-right: 8px; padding-right: 8px; }.topbar__title small { display: none; }.user-menu__chevron { display: none; }.user-dropdown { position: fixed; top: 58px; right: 10px; left: 10px; width: auto; }.user-menu__trigger { padding-inline: 4px; } }
.app-drawer{border:0!important}.drawer-brand{min-height:64px;display:flex;align-items:center;gap:11px;padding:0 12px;background:linear-gradient(100deg,#0068b5,#0097d0)}.drawer-brand__logo{width:88px;height:38px;flex:0 0 auto;object-fit:contain;padding:5px 7px;background:#fff;border-radius:7px;box-shadow:0 4px 12px rgba(0,51,91,.18)}.v-navigation-drawer--rail .drawer-brand__logo{width:52px}.drawer-brand__copy strong,.drawer-brand__copy small{display:block;white-space:nowrap}.drawer-brand__copy strong{color:#fff;font-size:15px}.drawer-brand__copy small{margin-top:3px;color:rgba(255,255,255,.72);font-size:8px;letter-spacing:.8px}.sidebar-nav{color:#cbd9e4;background:transparent}.sidebar-nav :deep(.v-list-subheader){color:#718da1;font-size:10px;font-weight:700;letter-spacing:1px}.sidebar-nav :deep(.v-list-item){margin-block:3px}.sidebar-nav :deep(.v-list-item--active){color:#fff;background:linear-gradient(90deg,#0079bd,#059ed2)}.sidebar-nav :deep(.v-icon){color:#61c7eb}.drawer-collapse{min-height:48px;color:#a9bdca;text-transform:none}.app-topbar{background:rgb(var(--v-theme-surface))!important}.dashboard-content{min-height:100vh;background:rgb(var(--v-theme-background))}.user-menu__trigger{min-width:210px!important;padding:4px 8px!important;text-transform:none}.user-menu__identity{text-align:left}.user-dropdown{position:static!important;width:auto!important;border-radius:8px}.topbar__title :deep(.v-toolbar-title__placeholder){overflow:visible}.topbar__title strong,.topbar__title small{display:block}.topbar__title strong{font-size:14px}.topbar__title small{margin-top:2px;color:rgb(var(--v-theme-on-surface),.62);font-size:10px}
@media(max-width:959px){.user-menu__trigger{min-width:0!important}.user-menu__identity{display:none}}
@media(max-width:560px){.topbar__logo{width:70px;margin-right:8px;padding-right:8px}.topbar__title small{display:none}}
</style>
