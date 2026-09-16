# Dashboard Dieu Hanh - Backend

NestJS REST API ket noi cac package/procedure Oracle va cung cap du lieu da chuan hoa cho dashboard Vue 3.

## Yeu cau

- Node.js 24 hoac phien ban phu hop voi truong `engines` cua cac dependency
- npm
- Quyen ket noi Oracle va `EXECUTE` tren cac package nghiep vu khi bat tich hop DB

Node-oracledb dang chay o Thin mode, vi vay khong can Oracle Instant Client. Chi cau hinh Thick mode neu Oracle hien tai yeu cau tinh nang khong duoc Thin mode ho tro.

## Cai dat

```powershell
npm install
Copy-Item .env.example .env
```

Mac dinh `ORACLE_ENABLED=false`, do do backend co the khoi dong va chay test ma khong can Oracle. Khi da co thong tin ket noi that, cap nhat `.env` va dat `ORACLE_ENABLED=true`.

Khong commit file `.env` hoac thong tin dang nhap Oracle.

## Chay ung dung

```powershell
# Development watch mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

- Health check: `GET http://localhost:3000/health`
- Oracle connection check: `GET http://localhost:3000/health/oracle`
- Swagger UI: `http://localhost:3000/docs`

Response thanh cong co dang:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "...",
    "timestamp": "..."
  }
}
```

Client co the gui header `x-request-id`; backend se giu lai gia tri nay trong response header va `meta.requestId`.

## Oracle

`OracleService` tao mot connection pool khi module khoi dong va dong pool khi ung dung shutdown. Moi loi goi procedure phai:

1. Khai bao ten package/procedure tap trung trong `src/database/procedures/`.
2. Validate input bang DTO truoc khi goi DB.
3. Dung bind parameters, khong noi input vao PL/SQL.
4. Map ten cot Oracle sang response DTO camelCase trong feature service.

OUT `REF CURSOR` duoc `OracleService` doc thanh mang truoc khi dong connection. Scalar OUT bind duoc giu nguyen trong `outBinds`.

## Kiem tra

```powershell
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Cau truc chinh

```text
src/
  common/       filters, interceptors, guards, decorators, pipes
  config/       app config, Oracle config, env validation
  database/     Oracle pool va procedure catalog
  modules/      cac module dashboard theo nghiep vu
  shared/       thanh phan dung chung
```

SSO VNPT thuoc giai doan sau. Cac bien SSO trong `.env.example` hien chi la placeholder va chua duoc su dung.