# Frontend — Vue3 + Vuetify3 Conventions

## Stack

- Vue 3 (`<script setup>` + Composition API — không dùng Options API cho code mới).
- Vuetify 3 làm UI component library (layout, form, table, navigation).
- Pinia cho state management (không dùng Vuex).
- Axios cho gọi API, có 1 instance dùng chung.
- Apache ECharts (qua `vue-echarts` hoặc wrapper tự viết — xem file `05-charts-echarts.md`).
- Vue Router cho điều hướng, kèm route guard kiểm tra đăng nhập (SSO) và phân quyền theo role.

## Cấu trúc component

- **views/**: 1 trang dashboard = 1 view, layout tổng thể + bố trí các widget/chart.
- **components/widgets/**: các khối tái sử dụng như KPI card, filter bar, bảng dữ liệu.
- **components/charts/**: wrapper cho từng loại chart (LineChart.vue, BarChart.vue, PieChart.vue...), nhận `props`
  là data đã chuẩn hoá, tự dựng `option` ECharts bên trong — view không tự viết option ECharts trực tiếp.

## API layer

```ts
// api/http.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      // điều hướng về trang login SSO
    }
    return Promise.reject(err);
  },
);
```

```ts
// api/dashboard.api.ts
import { http } from './http';

export const dashboardApi = {
  getRevenueSummary: (params: { fromDate: string; toDate: string; departmentCode?: string }) =>
    http.get('/dashboard/revenue-summary', { params }),
};
```

## State management (Pinia)

- Store nên tách theo domain (`dashboard.store.ts`, `auth.store.ts`), không gom mọi thứ vào 1 store lớn.
- Store chịu trách nhiệm gọi API layer, giữ state `loading`, `error`, `data` — component chỉ đọc state, không tự
  gọi axios trực tiếp trong component (trừ trường hợp đơn giản, dùng composable).

```ts
// stores/dashboard.store.ts
export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    revenueSummary: null as RevenueSummary | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchRevenueSummary(filter: DashboardFilter) {
      this.loading = true;
      this.error = null;
      try {
        const res = await dashboardApi.getRevenueSummary(filter);
        this.revenueSummary = res.data;
      } catch (e: any) {
        this.error = e?.response?.data?.message ?? 'Có lỗi xảy ra';
      } finally {
        this.loading = false;
      }
    },
  },
});
```

## Vuetify — quy ước UI

- Dùng hệ thống layout của Vuetify (`v-container`, `v-row`, `v-col`) để dashboard responsive tốt trên nhiều màn hình.
- Dùng `v-card` làm khung chuẩn cho mỗi widget/chart, tiêu đề rõ ràng, có slot cho filter riêng nếu cần.
- Theme màu: định nghĩa 1 lần trong `plugins/vuetify.ts` (light/dark nếu cần), không hardcode màu trong từng component
  — để đồng bộ với màu dùng trong ECharts.
- Loading state: dùng `v-skeleton-loader` hoặc `v-progress-circular` khi store đang `loading`.
- Table dữ liệu lớn: dùng `v-data-table` (server-side paging nếu dữ liệu nhiều, gọi API phân trang).

## Filter dùng chung

- Xây `FilterBar.vue` tái sử dụng cho các dashboard (khoảng ngày, phòng ban...), emit sự kiện `@apply` để view
  gọi store fetch lại dữ liệu — tránh mỗi dashboard tự viết logic filter riêng.

## Quy ước đặt tên

- Component: PascalCase (`RevenueChart.vue`).
- Composable: `useXxx.ts`.
- Store: `xxx.store.ts`.
- API module: `xxx.api.ts`.
