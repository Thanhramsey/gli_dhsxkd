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
  <v-container class="status-page" fluid>
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

    <v-row aria-label="Trạng thái các dịch vụ">
      <v-col cols="12" md="6"><ServiceStatus label="Backend API" description="NestJS REST API" :connected="systemStore.api.connected" :error="systemStore.api.error" :loading="systemStore.loading" /></v-col>
      <v-col cols="12" md="6"><ServiceStatus label="Oracle Database" description="Connection pool và truy vấn SYSDATE" :connected="systemStore.oracle.connected" :error="systemStore.oracle.error" :loading="systemStore.loading" /></v-col>
    </v-row>

    <v-card class="telemetry" aria-label="Thông tin kết nối" variant="outlined">
      <v-row no-gutters>
        <v-col cols="12" md="4"><v-list-item title="Thời gian Oracle" :subtitle="formattedDatabaseTime" prepend-icon="mdi-database-clock-outline" /></v-col>
        <v-col cols="12" md="4"><v-list-item title="Lần kiểm tra gần nhất" :subtitle="formattedLastCheckedAt" prepend-icon="mdi-clock-check-outline" /></v-col>
        <v-col cols="12" md="4"><v-list-item title="API endpoint" :subtitle="apiBaseUrl" prepend-icon="mdi-api" /></v-col>
      </v-row>
    </v-card>
  </v-container>
</template>

<style scoped>
.status-page { width: min(1080px, calc(100% - 40px)); margin: 0 auto; padding: 72px 0 48px; }
.status-page__header { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; }
.status-page__eyebrow { margin: 0 0 12px; color: #12615b; font-size: 12px; font-weight: 800; }
.status-page h1 { margin: 0; color: rgb(var(--v-theme-on-background)); font-family: 'Be Vietnam Pro', Tahoma, sans-serif; font-size: 46px; font-weight: 700; line-height: 1.1; letter-spacing: -.02em; }
.status-page__summary { max-width: 620px; margin: 14px 0 0; color: rgba(var(--v-theme-on-background), .66); font-size: 16px; }
.status-page__rule { height: 4px; margin: 34px 0; background: linear-gradient(90deg, #12615b 0 18%, #d7a735 18% 25%, #d9dfdc 25%); }
.telemetry { margin-top: 24px; }
.telemetry :deep(.v-col){border-right:1px solid rgba(var(--v-border-color),var(--v-border-opacity))}.telemetry :deep(.v-col:last-child){border-right:0}.telemetry :deep(.v-list-item){min-height:88px}.telemetry :deep(.v-list-item-subtitle){white-space:normal;overflow-wrap:anywhere;opacity:.75}
@media (max-width: 700px) {
  .status-page { width: min(100% - 28px, 1080px); padding-top: 40px; }
  .status-page__header { align-items: stretch; flex-direction: column; }
  .status-page h1 { font-size: 36px; }
  .telemetry :deep(.v-col){border-right:0;border-bottom:1px solid rgba(var(--v-border-color),var(--v-border-opacity))}.telemetry :deep(.v-col:last-child){border-bottom:0}
}
</style>
