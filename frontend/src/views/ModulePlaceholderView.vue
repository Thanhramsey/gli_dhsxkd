<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <main class="placeholder"><span>MODULE</span><h1>Chức năng đang được hoàn thiện</h1><p>Đường dẫn <code>{{ route.fullPath }}</code> đã được cấp trong menu nhưng chưa có view tương ứng ở phiên bản hiện tại.</p><v-btn to="/" color="primary">Về trang chủ</v-btn></main>
</template>

<style scoped>
.placeholder { width:min(760px,calc(100% - 36px));margin:0 auto;padding:110px 0;text-align:center }.placeholder>span { color:#168da8;font-size:11px;font-weight:900;letter-spacing:2px }.placeholder h1 { margin:14px 0;color:#18394d;font-size:38px }.placeholder p { margin:0 auto 28px;color:#71818a;line-height:1.7 }.placeholder code { color:#12615b;background:#e8f2f1;padding:3px 6px;border-radius:4px }
</style>
