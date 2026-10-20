# Chạy local và production

## Local

- Backend: `backend/.env` (hoặc `.env.local` nếu có), cookie Secure=false.
- Frontend: `.env.development` dùng `/api`. Vite chuyển `/api/*` sang `http://127.0.0.1:3000/*`.
- Vào `http://localhost:5173` hoặc `http://<IP-LAN>:5173`; frontend và backend chạy cùng máy phát triển.

Trong thư mục backend:

```powershell
npm.cmd run start:dev
```

Trong thư mục frontend:

```powershell
npm.cmd run dev
```

Khởi động lại cả hai sau khi đổi env hoặc Vite config.

## Production

Frontend: `https://bcdhsxkd.vnptgialai.vn`

API: `https://api-dhsxkd.vnptgialai.vn`

Frontend `.env.production`:

```dotenv
VITE_API_BASE_URL=https://api-dhsxkd.vnptgialai.vn
```

Trong thư mục frontend chạy `npm.cmd run build`, triển khai nội dung `dist` lên website frontend. URL API được đóng vào bundle lúc build; đổi env cần build và cập nhật lại toàn bộ dist.

Backend dùng `.env.production`, tách riêng khỏi `.env.local` và `.env`. File này không được commit. Máy deploy mới có thể copy `.env.production.example` thành `.env.production`, sau đó điền cấu hình Oracle và JWT_SECRET thực tế. File trên máy hiện tại đã được tạo từ cấu hình backend đang có.

```dotenv
NODE_ENV=production
PORT=3000
CORS_ORIGINS=https://bcdhsxkd.vnptgialai.vn
AUTH_COOKIE_SECURE=true
```

Trong thư mục backend:

```powershell
npm.cmd run build
npm.cmd run start:prod
```

`start:prod` dùng Node hỗ trợ `--env-file` (Node 22 hiện đang dùng có hỗ trợ) để nạp `.env.production` trước khi Nest khởi động. Đặt working directory của service là thư mục backend. Nếu service chạy trực tiếp Node thì dùng `node --env-file=.env.production dist/main` với cùng working directory.

Biến môi trường đã đặt ở Windows/service được ưu tiên hơn file env. Khi thay đổi CORS, cookie hoặc kết nối DB, khởi động lại đúng tiến trình/service backend.

## Reverse proxy của API

IIS/nginx tại domain API chuyển nguyên đường dẫn và mọi phương thức, gồm `OPTIONS`, tới `http://127.0.0.1:3000`. Ví dụ `/auth/login` phải tới backend `/auth/login`, không thêm `/api`.

Để Nest quản lý CORS; proxy cần giữ các header `Access-Control-*` trên cả response thành công và lỗi như 401. Tránh cấu hình thêm header CORS trùng ở proxy và tránh chặn OPTIONS hoặc yêu cầu Windows Authentication trước khi request tới Nest.

Frontend gửi cookie bằng `withCredentials: true`; backend cho phép credentials và đúng origin frontend. Hai domain production cùng chạy HTTPS nên cookie host-only `SameSite=Lax; Secure` hiện tại phù hợp, không cần đặt cookie domain dùng chung.
