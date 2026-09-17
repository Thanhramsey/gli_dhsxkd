<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay, useTheme } from 'vuetify'
import { useAuthStore } from '../../stores/auth.store'
import MenuTreeItem from './MenuTreeItem.vue'

const auth = useAuthStore()
const router = useRouter()
const { mobile } = useDisplay()
const theme = useTheme()
const collapsed = ref(false)
const mobileOpen = ref(false)
const userMenuOpen = ref(false)

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

function toggleSidebar() {
  if (mobile.value) mobileOpen.value = !mobileOpen.value
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
  <div
    class="dashboard-shell"
    :class="{
      'dashboard-shell--collapsed': collapsed && !mobile,
      'dashboard-shell--dark': isDark,
    }"
  >
    <aside class="sidebar" :class="{ 'sidebar--open': mobileOpen }">
      <div class="sidebar__brand">
        <span class="sidebar__logo">▲</span>
        <div v-if="!collapsed || mobile" class="sidebar__brand-copy">
          <strong>VNPT Gia Lai</strong>
          <small>DASHBOARD ĐIỀU HÀNH</small>
        </div>
      </div>

      <nav class="sidebar__nav" aria-label="Menu chức năng">
        <p v-if="!collapsed || mobile" class="sidebar__section-title">TỔNG QUAN</p>
        <router-link class="sidebar-link" to="/" :title="collapsed ? 'Trang chủ' : undefined" @click="mobileOpen = false">
          <span class="sidebar-link__icon">▦</span><span v-if="!collapsed || mobile">Trang chủ</span>
        </router-link>

        <p v-if="(!collapsed || mobile) && auth.menus.length" class="sidebar__section-title">CHỨC NĂNG</p>
        <MenuTreeItem
          v-for="menu in auth.menus"
          :key="menu.id"
          :item="menu"
          :collapsed="collapsed && !mobile"
        />

        <p v-if="!collapsed || mobile" class="sidebar__section-title">HỆ THỐNG</p>
        <router-link v-if="auth.canManageMenus" class="sidebar-link" to="/menu-management" :title="collapsed ? 'Quản lý menu' : undefined" @click="mobileOpen = false">
          <span class="sidebar-link__icon">⚙</span><span v-if="!collapsed || mobile">Quản trị hệ thống</span>
        </router-link>
        <router-link class="sidebar-link" to="/system-status" :title="collapsed ? 'Trạng thái hệ thống' : undefined" @click="mobileOpen = false">
          <span class="sidebar-link__icon">●</span><span v-if="!collapsed || mobile">Trạng thái hệ thống</span>
        </router-link>
      </nav>

      <button class="sidebar__collapse" type="button" @click="toggleSidebar">
        <span>{{ collapsed ? '›' : '‹' }}</span>
        <span v-if="!collapsed">Thu gọn menu</span>
      </button>
    </aside>

    <button v-if="mobileOpen" class="sidebar-overlay" aria-label="Đóng menu" @click="mobileOpen = false" />

    <header class="topbar">
      <button class="topbar__toggle" type="button" aria-label="Thu gọn hoặc mở menu" @click="toggleSidebar">
        <span /><span /><span />
      </button>
      <div class="topbar__title">
        <strong>Dashboard điều hành</strong>
        <small>{{ auth.user?.employee.unitName || 'VNPT Gia Lai' }}</small>
      </div>
      <div class="topbar__spacer" />

      <div class="user-menu">
        <button class="user-menu__trigger" type="button" :aria-expanded="userMenuOpen" @click="userMenuOpen = !userMenuOpen">
          <span class="user-menu__avatar">{{ initials }}</span>
          <span class="user-menu__identity">
            <strong>{{ auth.user?.employee.fullName || auth.user?.displayName }}</strong>
            <small>{{ auth.user?.employee.title || auth.user?.account }}</small>
          </span>
          <span class="user-menu__chevron" :class="{ 'user-menu__chevron--open': userMenuOpen }">⌄</span>
        </button>

        <div v-if="userMenuOpen" class="user-dropdown">
          <div class="user-dropdown__header">
            <span class="user-menu__avatar user-menu__avatar--large">{{ initials }}</span>
            <div><strong>{{ auth.user?.employee.fullName || auth.user?.displayName }}</strong><small>{{ auth.user?.account }}</small></div>
          </div>
          <button type="button" @click="toggleTheme">
            <span>{{ isDark ? '☀' : '◐' }}</span>
            <div><strong>{{ isDark ? 'Giao diện sáng' : 'Giao diện tối' }}</strong><small>Đổi theme hiển thị</small></div>
          </button>
          <button class="user-dropdown__logout" type="button" @click="logout">
            <span>↪</span><div><strong>Đăng xuất</strong><small>Kết thúc phiên làm việc</small></div>
          </button>
        </div>
      </div>
    </header>

    <section class="dashboard-content">
      <slot />
    </section>
  </div>
</template>

<style scoped>
.dashboard-shell { --sidebar-width: 260px; --app-bg: #f4f7fb; --surface: #fff; --border: #dce5ed; --text: #284256; --muted: #7b8d9b; min-height: 100vh; color: var(--text); background: var(--app-bg); }
.dashboard-shell--collapsed { --sidebar-width: 76px; }
.dashboard-shell--dark { --app-bg: #111923; --surface: #1b2734; --border: #2c3b49; --text: #e5edf4; --muted: #91a2b0; }
.sidebar { position: fixed; z-index: 40; inset: 0 auto 0 0; width: var(--sidebar-width); display: flex; flex-direction: column; color: #d4e0e8; background: #173650; box-shadow: 3px 0 16px rgba(15, 37, 54, .13); transition: width .2s ease, transform .2s ease; }
.sidebar__brand { min-height: 64px; display: flex; align-items: center; gap: 11px; padding: 0 19px; background: linear-gradient(100deg, #0068b5, #0097d0); }
.sidebar__logo { flex: 0 0 34px; color: #fff; font-size: 26px; transform: rotate(-8deg); }
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
.topbar__title strong,.topbar__title small { display: block; }.topbar__title strong { color: var(--text); font-size: 14px; }.topbar__title small { margin-top: 2px; color: var(--muted); font-size: 9px; }.topbar__spacer { flex: 1; }
.user-menu { position: relative; }.user-menu__trigger { display: flex; align-items: center; gap: 10px; min-width: 210px; padding: 6px 8px; color: inherit; cursor: pointer; background: transparent; border: 0; border-radius: 7px; font-family: inherit; text-align: left; }.user-menu__trigger:hover { background: rgba(0,104,181,.07); }
.user-menu__avatar { display: grid; place-items: center; flex: 0 0 36px; height: 36px; color: #fff; background: linear-gradient(135deg, #0078bd, #00afd9); border-radius: 50%; font-size: 11px; font-weight: 700; }.user-menu__avatar--large { flex-basis: 44px; height: 44px; font-size: 13px; }
.user-menu__identity { min-width: 0; flex: 1; }.user-menu__identity strong,.user-menu__identity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.user-menu__identity strong { color: var(--text); font-size: 11px; }.user-menu__identity small { margin-top: 3px; color: var(--muted); font-size: 9px; }.user-menu__chevron { color: var(--muted); transition: transform .15s; }.user-menu__chevron--open { transform: rotate(180deg); }
.user-dropdown { position: absolute; top: calc(100% + 9px); right: 0; width: 270px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 14px 36px rgba(20, 46, 66, .2); }.user-dropdown__header { display: flex; align-items: center; gap: 11px; padding: 16px; border-bottom: 1px solid var(--border); }.user-dropdown__header div { min-width: 0; }.user-dropdown__header strong,.user-dropdown__header small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.user-dropdown__header strong { color: var(--text); font-size: 12px; }.user-dropdown__header small { margin-top: 3px; color: var(--muted); font-size: 10px; }
.user-dropdown > button { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 16px; color: inherit; cursor: pointer; background: transparent; border: 0; border-bottom: 1px solid var(--border); font-family: inherit; text-align: left; }.user-dropdown > button:last-child { border-bottom: 0; }.user-dropdown > button:hover { background: rgba(0,104,181,.07); }.user-dropdown > button > span { width: 24px; color: #0078bd; font-size: 18px; text-align: center; }.user-dropdown > button strong,.user-dropdown > button small { display: block; }.user-dropdown > button strong { color: var(--text); font-size: 11px; }.user-dropdown > button small { margin-top: 3px; color: var(--muted); font-size: 9px; }.user-dropdown__logout strong,.user-dropdown__logout > span { color: #c0392b !important; }
.dashboard-content { min-height: 100vh; margin-left: var(--sidebar-width); padding-top: 64px; background: var(--app-bg); transition: margin-left .2s ease; }
.dashboard-shell--dark :deep(.panel),.dashboard-shell--dark :deep(.page-heading__date),.dashboard-shell--dark :deep(.quick-item),.dashboard-shell--dark :deep(.catalog),.dashboard-shell--dark :deep(.summary-grid > div) { color: var(--text); background: var(--surface); border-color: var(--border); }.dashboard-shell--dark :deep(.panel__header),.dashboard-shell--dark :deep(.employee-info > div) { border-color: var(--border); }.dashboard-shell--dark :deep(.page-heading h1),.dashboard-shell--dark :deep(.panel__header h2),.dashboard-shell--dark :deep(.quick-item strong),.dashboard-shell--dark :deep(.employee-info dd) { color: var(--text); }.dashboard-shell--dark :deep(.quick-grid) { background: var(--border); }
.sidebar-overlay { display: none; }
@media (max-width: 959px) { .sidebar { width: 260px; transform: translateX(-105%); }.sidebar--open { transform: translateX(0); }.topbar { left: 0; }.dashboard-content { margin-left: 0; }.sidebar__collapse { display: none; }.sidebar-overlay { position: fixed; z-index: 35; inset: 0; display: block; background: rgba(9,25,37,.5); border: 0; }.user-menu__trigger { min-width: 0; }.user-menu__identity { display: none; } }
@media (max-width: 560px) { .topbar { padding-inline: 10px; }.topbar__title small { display: none; }.user-menu__chevron { display: none; }.user-dropdown { position: fixed; top: 58px; right: 10px; left: 10px; width: auto; }.user-menu__trigger { padding-inline: 4px; } }
</style>
