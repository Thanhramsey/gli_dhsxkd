# Dashboard Điều Hành - Frontend

Ứng dụng Vue 3 sử dụng TypeScript, Vuetify 3, Pinia, Vue Router và Axios.

## Cài đặt

```powershell
npm install
Copy-Item .env.example .env
```

`VITE_API_BASE_URL` mặc định là `http://localhost:3000`. Chỉ thay đổi biến này khi backend chạy ở địa chỉ khác.

## Chạy local

Khởi động backend trước:

```powershell
cd ../backend
npm run start:dev
```

Sau đó khởi động frontend:

```powershell
cd ../frontend
npm run dev
```

Mở `http://localhost:5173`. Màn hình trạng thái sẽ gọi `/health` và `/health/oracle` để xác nhận luồng frontend → backend → Oracle.

## Build

```powershell
npm run build
npm run preview
```

## Cấu trúc

```text
src/
  api/          Axios instance và API theo domain
  components/   component tái sử dụng
  composables/  Composition API dùng chung
  plugins/      cấu hình Vuetify
  router/       Vue Router
  stores/       Pinia store theo domain
  types/        kiểu request/response
  views/        màn hình theo route
```