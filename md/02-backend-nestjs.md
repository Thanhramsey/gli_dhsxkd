# Backend — NestJS Conventions

## Nguyên tắc chung

- Mỗi tính năng dashboard = 1 module NestJS riêng (`XxxModule`), gồm Controller, Service, DTO, và (nếu cần)
  file định nghĩa procedure trong `database/procedures/`.
- **Controller**: chỉ nhận request, validate qua DTO, gọi Service, trả response. Không chứa logic xử lý dữ liệu.
- **Service**: gọi `OracleService` để thực thi procedure, map dữ liệu thô (cursor/rows) sang response DTO.
- Không viết business logic tính toán KPI ở Service — đó là việc của procedure Oracle. Service chỉ transform format
  (đổi tên field, format ngày, gộp nhóm hiển thị nếu cần cho FE).

## DTO & Validation

- Dùng `class-validator` + `class-transformer` cho mọi input (query param, body).
- Ví dụ DTO filter báo cáo:

```ts
// dto/dashboard-filter.dto.ts
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class DashboardFilterDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsOptional()
  @IsString()
  departmentCode?: string;
}
```

- Bật `ValidationPipe` global trong `main.ts` với `whitelist: true, forbidNonWhitelisted: true` để chặn field lạ.

## Gọi Oracle Package/Procedure

- Không viết chuỗi SQL raw ghép trực tiếp từ input người dùng.
- Luôn dùng bind parameters của `node-oracledb`, không nối chuỗi.
- Tên package/procedure, tên tham số nên khai báo tập trung (VD: enum hoặc const), không rải rác hardcode string
  trong nhiều file — tránh sai lệch khi DBA đổi tên procedure.

```ts
// database/procedures/dashboard.procedures.ts
export const PKG_DASHBOARD = {
  PACKAGE: 'PKG_DASHBOARD',
  GET_REVENUE_SUMMARY: 'GET_REVENUE_SUMMARY',
};
```

```ts
// modules/dashboard/dashboard.service.ts
async getRevenueSummary(filter: DashboardFilterDto) {
  const result = await this.oracleService.executeProcedure(
    PKG_DASHBOARD.PACKAGE,
    PKG_DASHBOARD.GET_REVENUE_SUMMARY,
    {
      p_from_date: filter.fromDate,
      p_to_date: filter.toDate,
      p_dept_code: filter.departmentCode ?? null,
      p_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
    },
  );
  return this.mapRevenueSummary(result);
}
```

- Viết 1 hàm `mapXxx()` riêng cho từng procedure để tách rõ phần "raw data từ DB" và phần "response trả FE".
  Không để FE phụ thuộc trực tiếp vào tên cột Oracle (thường viết hoa, snake_case) — map sang camelCase.

## Xử lý lỗi

- Dùng `HttpException`/`Custom Exception Filter` thống nhất, không để lộ chi tiết lỗi Oracle (ORA-xxxxx) ra FE.
- Log lỗi chi tiết ở server (kèm mã procedure, tham số — che thông tin nhạy cảm), trả FE message rút gọn.

```ts
// common/filters/all-exceptions.filter.ts — chuẩn hoá response lỗi dạng:
// { statusCode, message, errorCode?, timestamp, path }
```

## Response format chuẩn

Thống nhất 1 format bọc response cho toàn bộ API (dùng Interceptor):

```json
{
  "success": true,
  "data": { ... },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

## Caching (khuyến nghị)

- Với báo cáo tổng hợp nặng, cân nhắc cache ngắn hạn (VD: `@nestjs/cache-manager`, TTL vài phút) theo key = hash
  của filter, để giảm tải Oracle khi nhiều người xem cùng dashboard.

## Connection Pool Oracle

- Dùng pool (`oracledb.createPool`) khởi tạo 1 lần lúc app bootstrap (trong `OracleModule`), không tạo connection
  mới mỗi request.
- Đóng pool graceful khi app shutdown (`onApplicationShutdown`).
- Cấu hình `poolMin`, `poolMax`, `poolTimeout` qua env, không hardcode.

## Swagger / Tài liệu API

- Dùng `@nestjs/swagger` để tự sinh doc, gắn `@ApiProperty()` vào DTO — giúp FE và AI hiểu rõ contract API.
