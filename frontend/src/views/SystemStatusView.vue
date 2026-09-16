<script setup lang="ts">
import { computed, onMounted } from 'vue'
import ServiceStatus from '../components/widgets/ServiceStatus.vue'
import { useSystemStore } from '../stores/system.store'

const systemStore = useSystemStore()
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const formattedDatabaseTime = computed(() =>
  systemStore.databaseTime
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'medium' }).format(
        new Date(systemStore.databaseTime),
      )
    : 'Chưa nhận dữ liệu',
)

const formattedLastCheckedAt = computed(() =>
  systemStore.lastCheckedAt
    ? new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(systemStore.lastCheckedAt))
    : 'Chưa kiểm tra',
)

onMounted(() => systemStore.checkServices())
</script>

<template>
  <main class="status-page">
    <header class="status-page__header">
      <div>
        <p class="status-page__eyebrow">TRẠNG THÁI HỆ THỐNG</p>
        <h1>Dashboard điều hành</h1>
        <p class="status-page__summary">
          Theo dõi kết nối giữa giao diện, API NestJS và cơ sở dữ liệu Oracle.
        </p>
      </div>
      <v-btn color="primary" variant="flat" :loading="systemStore.loading" @click="systemStore.checkServices">
        Kiểm tra lại
      </v-btn>
    </header>

    <div class="status-page__rule" />

    <section class="status-grid" aria-label="Trạng thái các dịch vụ">
      <ServiceStatus label="Backend API" description="NestJS REST API" :connected="systemStore.api.connected" :error="systemStore.api.error" :loading="systemStore.loading" />
      <ServiceStatus label="Oracle Database" description="Connection pool và truy vấn SYSDATE" :connected="systemStore.oracle.connected" :error="systemStore.oracle.error" :loading="systemStore.loading" />
    </section>

    <section class="telemetry" aria-label="Thông tin kết nối">
      <div><span>Thời gian Oracle</span><strong>{{ formattedDatabaseTime }}</strong></div>
      <div><span>Lần kiểm tra gần nhất</span><strong>{{ formattedLastCheckedAt }}</strong></div>
      <div><span>API endpoint</span><strong>{{ apiBaseUrl }}</strong></div>
    </section>
  </main>
</template>

<style scoped>
.status-page { width: min(1080px, calc(100% - 40px)); margin: 0 auto; padding: 72px 0 48px; }
.status-page__header { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; }
.status-page__eyebrow { margin: 0 0 12px; color: #12615b; font-size: 12px; font-weight: 800; }
.status-page h1 { margin: 0; color: #17211f; font-family: Georgia, 'Times New Roman', serif; font-size: 46px; font-weight: 500; line-height: 1.1; letter-spacing: 0; }
.status-page__summary { max-width: 620px; margin: 14px 0 0; color: #65716e; font-size: 16px; }
.status-page__rule { height: 4px; margin: 34px 0; background: linear-gradient(90deg, #12615b 0 18%, #d7a735 18% 25%, #d9dfdc 25%); }
.status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.telemetry { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 36px; border-top: 1px solid #d9dfdc; border-bottom: 1px solid #d9dfdc; }
.telemetry > div { min-width: 0; padding: 22px 24px; border-right: 1px solid #d9dfdc; }
.telemetry > div:last-child { border-right: 0; }
.telemetry span, .telemetry strong { display: block; }
.telemetry span { margin-bottom: 7px; color: #65716e; font-size: 12px; font-weight: 700; }
.telemetry strong { overflow-wrap: anywhere; color: #17211f; font-size: 14px; }
@media (max-width: 700px) {
  .status-page { width: min(100% - 28px, 1080px); padding-top: 40px; }
  .status-page__header { align-items: stretch; flex-direction: column; }
  .status-page h1 { font-size: 36px; }
  .status-grid, .telemetry { grid-template-columns: 1fr; }
  .telemetry > div { border-right: 0; border-bottom: 1px solid #d9dfdc; }
  .telemetry > div:last-child { border-bottom: 0; }
}
</style>