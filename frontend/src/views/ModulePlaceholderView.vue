<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <v-container class="placeholder">
    <v-empty-state icon="mdi-hammer-wrench" title="Chức năng đang được hoàn thiện" :text="`Đường dẫn ${route.fullPath} đã được cấp trong menu nhưng chưa có view tương ứng ở phiên bản hiện tại.`">
      <template #actions><v-btn to="/" color="primary" prepend-icon="mdi-home-outline">Về trang chủ</v-btn></template>
    </v-empty-state>
  </v-container>
</template>

<style scoped>
.placeholder{max-width:760px;padding-top:100px}
</style>
