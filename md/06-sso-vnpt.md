# SSO VNPT — Thiết Kế Tích Hợp (Giai Đoạn 2)

> **Lưu ý quan trọng**: Tài liệu này mô tả kiến trúc tích hợp SSO theo chuẩn OAuth2/OIDC phổ biến.
> Chi tiết chính xác (endpoint, tên claim, cơ chế lấy quyền nhân viên) **phải lấy từ tài liệu kỹ thuật SSO
> nội bộ của VNPT** do đội hạ tầng/IAM tập đoàn cung cấp — AI không được tự suy đoán URL hay client_id thật.
> Hãy để các giá trị này ở dạng biến môi trường/placeholder cho đến khi có thông tin chính thức.

## Giả định kiến trúc chuẩn (OAuth2 Authorization Code + PKCE, hoặc OIDC)

```
[Người dùng] → [Frontend Vue3] → redirect → [SSO VNPT Login Page]
                                                     │ (đăng nhập thành công)
                                                     ▼
[Frontend] ← redirect kèm authorization code ← [SSO VNPT]
      │
      ▼ (gửi code lên backend)
[Backend NestJS] → đổi code lấy access_token/id_token → [SSO VNPT Token Endpoint]
      │
      ▼ verify token, lấy thông tin nhân viên + quyền
[Backend] → phát hành JWT nội bộ (session) cho FE dùng gọi API dashboard
```

Ưu tiên dùng **Authorization Code Flow với PKCE** (an toàn cho SPA) thay vì Implicit Flow.

## Backend — Module Auth

```
modules/auth/
├── auth.controller.ts     # /auth/login, /auth/callback, /auth/logout, /auth/me
├── auth.service.ts        # đổi code → token, verify id_token, lấy user info
├── strategies/
│   └── sso-oidc.strategy.ts   # dùng passport-openidconnect hoặc openid-client
├── guards/
│   ├── jwt-auth.guard.ts      # xác thực JWT nội bộ trên mọi API
│   └── roles.guard.ts         # kiểm tra quyền theo role/phòng ban
└── decorators/
    ├── current-user.decorator.ts
    └── roles.decorator.ts
```

- Dùng thư viện chuẩn OIDC (`openid-client` hoặc `passport-openidconnect`) thay vì tự viết flow OAuth2 thủ công,
  giảm rủi ro bảo mật.
- Backend lưu `client_secret` của SSO — **không bao giờ** đưa `client_secret` ra frontend.
- Sau khi verify token VNPT, backend nên phát hành **JWT nội bộ riêng** (ký bằng `JWT_SECRET` của hệ thống) để:
  - Kiểm soát thời gian sống session độc lập với token SSO.
  - Nhúng thêm claim nội bộ (role, phòng ban, danh sách dashboard được xem) sau khi map từ hệ thống quyền.

## Lấy quyền nhân viên

- Token/id_token từ SSO VNPT thường trả về thông tin định danh (mã nhân viên, phòng ban...) qua claims.
- Cần làm rõ với team IAM VNPT: quyền xem dashboard (theo phòng ban/chức vụ) được cấp qua:
  - (a) claim có sẵn trong token SSO, hoặc
  - (b) 1 API riêng tra cứu quyền theo mã nhân viên (hệ thống phân quyền nội bộ/HRM).
- Thiết kế `RolesGuard` + decorator `@Roles('DIRECTOR', 'DEPT_MANAGER')` ở cấp Controller/route để chặn theo vai trò,
  tách biệt khỏi logic xác thực (`JwtAuthGuard`).

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DIRECTOR', 'DEPT_MANAGER')
@Get('revenue-summary')
getRevenueSummary(@Query() filter: DashboardFilterDto, @CurrentUser() user: AuthUser) {
  // nếu không phải DIRECTOR, service tự lọc dữ liệu theo departmentCode của user
}
```

## Frontend — luồng đăng nhập

```
router/guards/auth.guard.ts
  - route yêu cầu login → nếu chưa có session → redirect sang /auth/login (BE khởi tạo redirect tới SSO)
  - sau khi SSO callback về BE, BE redirect về FE kèm JWT nội bộ (qua cookie HttpOnly hoặc trao đổi 1 lần)
```

- Ưu tiên lưu token trong **HttpOnly cookie** (BE set cookie) thay vì `localStorage` để giảm rủi ro XSS,
  nếu kiến trúc BE/FE cùng domain hoặc dùng cơ chế proxy phù hợp.
- Nếu bắt buộc dùng Bearer token ở FE (SPA thuần), lưu token trong memory (Pinia store) thay vì `localStorage`,
  và có cơ chế refresh token hợp lý.
- `stores/auth.store.ts`: giữ `user`, `roles`, `isAuthenticated`; cung cấp action `login()`, `logout()`, `fetchMe()`.

## Việc cần làm trước khi code thật (checklist trao đổi với team IAM VNPT)

- [ ] Xác nhận chuẩn: OAuth2 thuần hay OIDC (có id_token/JWKS không).
- [ ] Danh sách endpoint: authorize, token, userinfo, jwks, logout (end_session).
- [ ] Danh sách claim trả về: mã nhân viên, tên, phòng ban, chức vụ, email...
- [ ] Cơ chế lấy quyền/role: trong token hay qua API riêng.
- [ ] Redirect URI được whitelist cho từng môi trường (dev/staging/prod).
- [ ] Thời gian sống token, cơ chế refresh, cơ chế logout tập trung (single logout) nếu có.

## Giai đoạn hiện tại (chưa có SSO)

- Trong lúc chờ tích hợp SSO thật, có thể dựng **AuthModule tạm** với login user/password nội bộ hoặc mock user,
  nhưng nên giữ đúng interface (`AuthUser`, `JwtAuthGuard`, `RolesGuard`) để khi tích hợp SSO thật chỉ cần thay
  `auth.service.ts` mà không phải sửa toàn bộ các module dashboard đã gắn `@UseGuards`.
