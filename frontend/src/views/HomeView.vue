<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth.store'

const auth = useAuthStore()
const employee = computed(() => auth.user?.employee)
const visibleMenus = computed(() => auth.menus.slice(0, 8))
const formattedDate = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date())
</script>

<template>
  <main class="dashboard-page">
    <header class="page-heading">
      <div>
        <h1>Tổng quan</h1>
        <p>Xin chào <strong>{{ employee?.fullName || auth.user?.displayName }}</strong>, chúc bạn một ngày làm việc hiệu quả.</p>
      </div>
      <div class="page-heading__date">{{ formattedDate }}</div>
    </header>

    <v-alert v-if="!auth.user?.groupIds?.length" type="warning" variant="tonal" density="compact" class="mb-5">
      Tài khoản chưa được gán nhóm người dùng nên chưa có menu chức năng.
    </v-alert>

    <section class="summary-cards" aria-label="Thông tin tổng quan">
      <article class="summary-card summary-card--blue">
        <span class="summary-card__icon">ND</span>
        <div><small>NGƯỜI DÙNG</small><strong>{{ auth.user?.account }}</strong><p>{{ employee?.employeeCode || 'Chưa có mã nhân viên' }}</p></div>
      </article>
      <article class="summary-card summary-card--cyan">
        <span class="summary-card__icon">ĐV</span>
        <div><small>ĐƠN VỊ</small><strong>{{ employee?.unitName || employee?.unitCode || 'Chưa cập nhật' }}</strong><p>{{ employee?.title || 'Chưa cập nhật chức danh' }}</p></div>
      </article>
      <article class="summary-card summary-card--indigo">
        <span class="summary-card__icon">NQ</span>
        <div><small>NHÓM QUYỀN</small><strong>{{ auth.user?.groupName || 'Chưa được gán' }}</strong><p>{{ auth.user?.menuCodes.length || 0 }} quyền được cấp</p></div>
      </article>
      <article class="summary-card summary-card--green">
        <span class="summary-card__icon">MN</span>
        <div><small>MENU HIỂN THỊ</small><strong>{{ auth.menus.length }}</strong><p>Chức năng có thể truy cập</p></div>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel quick-access">
        <header class="panel__header">
          <div><h2>Truy cập nhanh</h2><p>Các chức năng được cấp theo nhóm người dùng</p></div>
          <span>{{ auth.menus.length }} menu</span>
        </header>
        <div v-if="visibleMenus.length" class="quick-grid">
          <router-link v-for="menu in visibleMenus" :key="menu.id" :to="menu.path || menu.redirect || '/'" class="quick-item">
            <span class="quick-item__icon">{{ menu.icon ? '◆' : '▦' }}</span>
            <div><strong>{{ menu.title }}</strong><small>{{ menu.code || menu.name }}</small></div>
            <span class="quick-item__arrow">›</span>
          </router-link>
        </div>
        <div v-else class="empty-menu">
          <span>▦</span><strong>Chưa có menu được cấp</strong><p>Vui lòng liên hệ quản trị viên để được phân quyền.</p>
        </div>
      </article>

      <article class="panel employee-panel">
        <header class="panel__header"><div><h2>Thông tin nhân viên</h2><p>Hồ sơ đang liên kết với tài khoản</p></div></header>
        <dl class="employee-info">
          <div><dt>Họ và tên</dt><dd>{{ employee?.fullName || 'Chưa cập nhật' }}</dd></div>
          <div><dt>Mã nhân viên</dt><dd>{{ employee?.employeeCode || 'Chưa cập nhật' }}</dd></div>
          <div><dt>Chức danh</dt><dd>{{ employee?.title || 'Chưa cập nhật' }}</dd></div>
          <div><dt>Đơn vị</dt><dd>{{ employee?.unitName || employee?.unitCode || 'Chưa cập nhật' }}</dd></div>
          <div><dt>Email</dt><dd>{{ employee?.email || 'Chưa cập nhật' }}</dd></div>
          <div><dt>Nguồn dữ liệu</dt><dd><span class="source-chip">{{ auth.user?.source }}</span></dd></div>
        </dl>
      </article>
    </section>
  </main>
</template>

<style scoped>
.dashboard-page { width: min(1380px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 52px; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.page-heading h1 { margin: 0; color: #20384d; font-size: 28px; font-weight: 700; }
.page-heading p { margin: 6px 0 0; color: #718294; font-size: 13px; }
.page-heading p strong { color: #0068b5; font-weight: 600; }
.page-heading__date { padding: 9px 14px; color: #536b7d; background: #fff; border: 1px solid #dce5ed; border-radius: 6px; font-size: 12px; text-transform: capitalize; }
.summary-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
.summary-card { position: relative; overflow: hidden; display: flex; align-items: center; gap: 14px; min-height: 116px; padding: 20px; color: #fff; border-radius: 8px; box-shadow: 0 5px 14px rgba(31, 66, 96, .12); }
.summary-card::after { content: ''; position: absolute; right: -28px; bottom: -42px; width: 105px; height: 105px; border: 20px solid rgba(255,255,255,.08); border-radius: 50%; }
.summary-card--blue { background: linear-gradient(135deg, #0068b5, #008bc9); }
.summary-card--cyan { background: linear-gradient(135deg, #008fb8, #00b7d8); }
.summary-card--indigo { background: linear-gradient(135deg, #3858a8, #5276ca); }
.summary-card--green { background: linear-gradient(135deg, #16836f, #21a98b); }
.summary-card__icon { z-index: 1; display: grid; place-items: center; flex: 0 0 44px; height: 44px; background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.25); border-radius: 9px; font-size: 12px; font-weight: 700; }
.summary-card > div { z-index: 1; min-width: 0; }
.summary-card small, .summary-card strong, .summary-card p { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.summary-card small { opacity: .78; font-size: 9px; font-weight: 600; letter-spacing: .8px; }
.summary-card strong { margin-top: 7px; font-size: 16px; font-weight: 700; }
.summary-card p { margin: 4px 0 0; opacity: .8; font-size: 11px; }
.dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(320px, .75fr); gap: 20px; }
.panel { overflow: hidden; background: #fff; border: 1px solid #dce5ed; border-radius: 8px; box-shadow: 0 3px 12px rgba(36, 67, 92, .05); }
.panel__header { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 76px; padding: 16px 20px; border-bottom: 1px solid #e5ebf0; }
.panel__header h2 { margin: 0; color: #284256; font-size: 17px; font-weight: 700; }
.panel__header p { margin: 4px 0 0; color: #8998a5; font-size: 11px; }
.panel__header > span { padding: 5px 9px; color: #0068b5; background: #eaf5fc; border-radius: 4px; font-size: 10px; font-weight: 700; }
.quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #e7edf2; }
.quick-item { min-width: 0; display: flex; align-items: center; gap: 12px; min-height: 76px; padding: 14px 18px; color: inherit; text-decoration: none; background: #fff; transition: background .15s ease; }
.quick-item:hover { background: #f1f8fc; }
.quick-item__icon { display: grid; place-items: center; flex: 0 0 38px; height: 38px; color: #0076ba; background: #e7f5fc; border-radius: 7px; }
.quick-item > div { min-width: 0; flex: 1; }
.quick-item strong, .quick-item small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quick-item strong { color: #304b5e; font-size: 13px; font-weight: 600; }
.quick-item small { margin-top: 4px; color: #96a3ac; font-size: 9px; }
.quick-item__arrow { color: #92a4af; font-size: 22px; }
.empty-menu { display: grid; place-items: center; padding: 50px 20px; color: #8495a1; text-align: center; }
.empty-menu > span { margin-bottom: 10px; color: #58acd1; font-size: 30px; }.empty-menu strong { color: #526a7a; font-size: 14px; }.empty-menu p { margin: 6px 0 0; font-size: 11px; }
.employee-info { margin: 0; padding: 7px 20px 14px; }
.employee-info > div { display: grid; grid-template-columns: 112px 1fr; gap: 12px; padding: 13px 0; border-bottom: 1px solid #edf1f4; }
.employee-info > div:last-child { border-bottom: 0; }
.employee-info dt { color: #8997a2; font-size: 11px; }.employee-info dd { min-width: 0; margin: 0; overflow-wrap: anywhere; color: #344e60; font-size: 12px; font-weight: 600; }
.source-chip { padding: 4px 7px; color: #0074b6; background: #eaf5fc; border-radius: 4px; font-size: 9px; }
@media (max-width: 1100px) { .summary-cards { grid-template-columns: repeat(2, 1fr); }.dashboard-grid { grid-template-columns: 1fr; } }
@media (max-width: 650px) { .dashboard-page { width: min(100% - 24px, 1380px); padding-top: 20px; }.page-heading { align-items: flex-start; flex-direction: column; }.summary-cards, .quick-grid { grid-template-columns: 1fr; }.page-heading__date { width: 100%; }.summary-card { min-height: 104px; } }
</style>
