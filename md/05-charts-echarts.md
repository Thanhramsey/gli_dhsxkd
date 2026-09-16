# Charts — Apache ECharts Conventions

## Thư viện

- Dùng `echarts` (core) kết hợp `vue-echarts` để có component `<v-chart>` tích hợp sẵn reactivity cho Vue3.
- Cài: `npm i echarts vue-echarts`.
- Chỉ import các module ECharts cần dùng (tree-shaking) thay vì import toàn bộ `echarts` để giảm bundle size.

```ts
// plugins/echarts.ts
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
} from 'echarts/components';

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
]);
```

## Nguyên tắc wrapper component

- Mỗi loại biểu đồ có 1 component wrapper trong `components/charts/`, nhận **data đã chuẩn hoá** qua props
  (không nhận nguyên object ECharts `option` từ view) — để logic dựng option tập trung 1 chỗ, dễ đổi theme sau này.

```vue
<!-- components/charts/LineChart.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import VChart from 'vue-echarts';

const props = defineProps<{
  title?: string;
  categories: string[];
  series: { name: string; data: number[] }[];
  loading?: boolean;
}>();

const option = computed(() => ({
  title: props.title ? { text: props.title, left: 'left' } : undefined,
  tooltip: { trigger: 'axis' },
  legend: { bottom: 0 },
  grid: { left: 40, right: 20, top: props.title ? 40 : 20, bottom: 40 },
  xAxis: { type: 'category', data: props.categories },
  yAxis: { type: 'value' },
  series: props.series.map((s) => ({
    name: s.name,
    type: 'line',
    smooth: true,
    data: s.data,
  })),
}));
</script>

<template>
  <v-chart :option="option" :loading="loading" autoresize style="height: 360px" />
</template>
```

- View chỉ cần truyền data:

```vue
<LineChart
  title="Doanh thu theo tháng"
  :categories="months"
  :series="[{ name: 'Doanh thu', data: revenues }]"
  :loading="dashboardStore.loading"
/>
```

## Chuẩn hoá màu sắc / theme

- Định nghĩa 1 bảng màu dùng chung (`constants/chart-theme.ts`) đồng bộ với theme Vuetify, tránh mỗi chart tự chọn
  màu ngẫu nhiên.
- Đăng ký theme ECharts riêng nếu cần (`echarts.registerTheme('vnpt-dashboard', {...})`).

## Responsive & hiệu năng

- Luôn bật `autoresize` cho `<v-chart>` để chart co giãn theo container/khi đổi kích thước sidebar.
- Với dashboard nhiều chart (>6-8), cân nhắc lazy-load chart khi widget vào viewport (`v-intersect` của Vuetify)
  để tránh render tất cả cùng lúc gây giật.
- Dữ liệu time-series dài nên dùng `dataZoom` thay vì render hết lên trục X.

## Loại chart thường dùng cho dashboard điều hành

| Nhu cầu | Loại chart |
|---|---|
| So sánh theo thời gian (doanh thu, KPI theo tháng) | Line / Area |
| So sánh theo danh mục (phòng ban, sản phẩm) | Bar |
| Tỷ trọng cơ cấu | Pie / Donut |
| Nhiều chỉ số cùng lúc, khác đơn vị | Line + Bar kết hợp (dual yAxis) |
| KPI tổng quan | Không cần chart — dùng số lớn + `v-card` + icon xu hướng tăng/giảm |
| Theo dõi tiến độ so với mục tiêu | Gauge / Liquid fill (nếu cần) |

## Export / in ấn (nếu dashboard cần xuất báo cáo)

- ECharts hỗ trợ `chartInstance.getDataURL()` để xuất ảnh PNG — hữu ích khi cần chức năng "xuất báo cáo" từ dashboard.
