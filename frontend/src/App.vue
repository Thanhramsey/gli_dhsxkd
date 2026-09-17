<script setup lang="ts">
import { useRoute } from 'vue-router'
import DashboardShell from './components/layout/DashboardShell.vue'

const route = useRoute()
</script>

<template>
  <v-app class="app-root">
    <router-view v-if="route.meta.public" />
    <DashboardShell v-else>
      <router-view />
    </DashboardShell>
  </v-app>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
}
</style>
