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
  <section class="service-status" :aria-label="label">
    <div class="service-status__heading">
      <span
        class="service-status__indicator"
        :class="connected ? 'is-connected' : 'is-disconnected'"
        aria-hidden="true"
      />
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

    <p v-if="error && !loading" class="service-status__error">{{ error }}</p>
  </section>
</template>

<style scoped>
.service-status {
  min-height: 150px;
  padding: 24px;
  border: 1px solid #d9dfdc;
  border-radius: 8px;
  background: #fff;
}
.service-status__heading { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 22px; }
.service-status__indicator { width: 10px; height: 10px; margin-top: 8px; border-radius: 50%; flex: 0 0 auto; background: #b42318; box-shadow: 0 0 0 5px #fee4e2; }
.service-status__indicator.is-connected { background: #16794b; box-shadow: 0 0 0 5px #dff3e8; }
.service-status h2 { margin: 0 0 3px; color: #17211f; font-size: 18px; line-height: 1.35; }
.service-status p { margin: 0; color: #65716e; font-size: 14px; }
.service-status__error { margin-top: 14px !important; color: #b42318 !important; }
</style>