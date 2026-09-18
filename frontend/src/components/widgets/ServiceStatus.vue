<script setup lang="ts">
defineProps<{
  label: string
  description: string
  connected: boolean
  error: string | null
  loading: boolean
}>()
</script>

<template>
  <v-card class="service-status" :aria-label="label" variant="outlined">
    <div class="service-status__heading">
      <v-avatar :color="connected ? 'success' : 'error'" size="38" variant="tonal">
        <v-icon :icon="connected ? 'mdi-check-network-outline' : 'mdi-network-off-outline'" />
      </v-avatar>
      <div>
        <h2>{{ label }}</h2>
        <p>{{ description }}</p>
      </div>
    </div>

    <v-skeleton-loader v-if="loading" type="text" width="96" />
    <v-chip
      v-else
      :color="connected ? 'success' : 'error'"
      size="small"
      variant="tonal"
    >
      {{ connected ? 'Đang hoạt động' : 'Mất kết nối' }}
    </v-chip>

    <v-alert v-if="error && !loading" class="mt-4" type="error" variant="tonal" density="compact">{{ error }}</v-alert>
  </v-card>
</template>

<style scoped>
.service-status {
  min-height: 150px;
  padding: 24px;
  border: 1px solid #d9dfdc;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
}
.service-status__heading { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 22px; }
.service-status h2 { margin: 0 0 3px; color: #17211f; font-size: 18px; line-height: 1.35; }
.service-status p { margin: 0; color: #65716e; font-size: 14px; }
</style>
