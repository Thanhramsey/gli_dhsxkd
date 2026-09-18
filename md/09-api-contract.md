# API Contract — Auth và Menu

Tất cả response thành công được bọc theo `{ success, data, meta }`. Session được lưu trong cookie HttpOnly `dhsxkd_session`.

| Method | Endpoint | Xác thực | Nội dung |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Nhận `{ "account": "MA_ND" }`, không nhận mật khẩu |
| `GET` | `/auth/me` | Session | Hồ sơ, nhóm quyền và mã menu của người đang đăng nhập |
| `POST` | `/auth/logout` | Public | Xóa session cookie |
| `GET` | `/menus/mine` | Session | Cây menu của nhóm được map qua `LEVEL_ROLE` |
| `GET` | `/menus/catalog` | Session + mã menu quản trị | Toàn bộ cây menu để quản trị |
| `GET` | `/menus/groups` | Session + mã menu quản trị | Danh mục nhóm từ `GLI_NHOM_ND` |
| `GET/POST` | `/admin/report-groups` | Session + quyền quản trị | Danh sách hoặc thêm nhóm báo cáo |
| `PATCH/DELETE` | `/admin/report-groups/:id` | Session + quyền quản trị | Sửa hoặc xóa nhóm báo cáo |
| `GET/POST` | `/admin/reports` | Session + quyền quản trị | Danh sách hoặc thêm báo cáo |
| `PATCH/DELETE` | `/admin/reports/:id` | Session + quyền quản trị | Sửa hoặc xóa báo cáo |

Response người dùng giữ `groupId`, `groupName` và `groupIds` để tương thích giao diện hiện có. Do `LEVEL_ROLE` là một giá trị đơn, `groupIds` chỉ rỗng hoặc chứa đúng một phần tử.

Mã menu được phép mở trang quản trị cấu hình bằng biến `MENU_ADMIN_CODE`. Giá trị này phải là `MENU_ID` tương ứng trong `GLI_MENU`; frontend dùng biến `VITE_MENU_ADMIN_CODE` cùng giá trị.

## Chuyển sang SSO

`JwtAuthGuard`, `AuthenticatedUser` và contract `/auth/me` được giữ ổn định. Khi có thông tin OIDC chính thức, thay bước nhận `MA_ND` trong `/auth/login` bằng callback SSO và ánh xạ claim SSO sang đúng `MA_ND`.
