# Kiến Trúc Tổng Thể

## Sơ đồ luồng dữ liệu

```
[Oracle DB]
  Package/Procedure (BA/DBA team viết)
        │  (REF CURSOR / OUT params)
        ▼
[NestJS Backend]
  Controller → Service → Repository (oracledb driver)
        │  (REST/JSON, có validate + cache tuỳ chỗ)
        ▼
[Vue3 + Vuetify3 Frontend]
  Pinia store → API layer (axios) → Component → ECharts widget
        │
        ▼
[Người dùng cuối] — đăng nhập qua SSO VNPT (giai đoạn 2)
```

## Nguyên tắc phân tách trách nhiệm

- **DB layer (Oracle)**: chỉ chứa logic tính toán/nghiệp vụ nặng (aggregate, KPI...) trong package/procedure.
  Backend **không** viết SQL nghiệp vụ phức tạp trực tiếp, chỉ gọi procedure có sẵn.
- **Backend (NestJS)**: là lớp "adapter" — gọi procedure, map dữ liệu Oracle (cursor, OUT param) sang JSON chuẩn,
  xử lý auth/phân quyền, cache, rate-limit, validate input.
- **Frontend (Vue3)**: chỉ tiêu thụ REST API đã chuẩn hoá, không gọi thẳng DB, không chứa business rule tính KPI.

## Cấu trúc thư mục đề xuất

### Backend (NestJS)

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── filters/            # exception filters
│   │   ├── interceptors/       # logging, response transform
│   │   ├── guards/             # SsoAuthGuard, RolesGuard
│   │   ├── decorators/         # @CurrentUser(), @Roles()
│   │   └── pipes/              # validation pipes
│   ├── config/
│   │   ├── database.config.ts
│   │   └── sso.config.ts
│   ├── database/
│   │   ├── oracle.module.ts
│   │   ├── oracle.service.ts   # wrapper connection pool + execute procedure
│   │   └── procedures/         # định nghĩa tên package.procedure + param map
│   ├── modules/
│   │   ├── dashboard/
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.service.ts
│   │   │   ├── dashboard.module.ts
│   │   │   └── dto/
│   │   ├── auth/                # SSO VNPT (giai đoạn 2)
│   │   └── ...module theo nghiệp vụ...
│   └── shared/
└── test/
```

### Frontend (Vue3 + Vuetify3)

```
frontend/
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── plugins/
│   │   ├── vuetify.ts
│   │   └── echarts.ts
│   ├── router/
│   ├── stores/                 # Pinia
│   │   ├── auth.store.ts
│   │   └── dashboard.store.ts
│   ├── api/
│   │   ├── http.ts             # axios instance + interceptor token
│   │   └── dashboard.api.ts
│   ├── composables/
│   │   ├── useChart.ts
│   │   └── useAuth.ts
│   ├── components/
│   │   ├── charts/              # wrapper ECharts theo loại chart
│   │   ├── layout/
│   │   └── widgets/              # KPI card, filter bar...
│   ├── views/
│   │   └── dashboard/
│   └── types/
```

## Quy ước đặt tên module theo nghiệp vụ

Mỗi nhóm báo cáo/điều hành nên là 1 module riêng ở cả BE và FE, ví dụ:
`sales-overview`, `hr-headcount`, `finance-revenue`... Tên module BE và FE nên khớp nhau để dễ tra cứu.

## Môi trường (env)

- `.env` cho từng môi trường: `dev`, `staging`, `prod` — không commit `.env` thật, chỉ commit `.env.example`.
- Biến quan trọng: `ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE_NAME`, `ORACLE_USER`, `ORACLE_PASSWORD`,
  `ORACLE_POOL_MIN`, `ORACLE_POOL_MAX`, `SSO_ISSUER`, `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, `JWT_SECRET`.
