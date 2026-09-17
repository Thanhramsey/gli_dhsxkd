# DB Catalog — Đăng nhập và phân quyền menu

## Quan hệ đang sử dụng

```text
V_NGUOIDUNG_DIABAN.NHANVIEN_ID  → V_NHANVIEN.NHANVIEN_ID
V_NHANVIEN.DONVI_ID             → V_DONVI.DONVI_ID
V_NGUOIDUNG_NHOMND.MA_ND        → V_NGUOIDUNG_DIABAN.MA_ND
V_NGUOIDUNG_NHOMND.NHOMND_ID    → GLI_NHOM_ND.NHOMND_ID
GLI_NHOM_ND.NHOMND_ID           → GLI_NHOM_ND_MENU.NHOMND_ID
GLI_NHOM_ND_MENU.MENU_ID        → GLI_MENU.MENU_ID
GLI_MENU.MENU_CHA_ID             → GLI_MENU.MENU_ID
```

`V_NGUOIDUNG_DIABAN` là nguồn tài khoản duy nhất cho đăng nhập và CRUD quản trị. Ứng dụng không còn đọc hoặc ghi `V_NGUOIDUNG`.

Thông tin nhân viên được map bằng `NHANVIEN_ID`. Trường `TRANGTHAI` quyết định tài khoản được phép đăng nhập. Việc gán nhóm lấy qua `V_NGUOIDUNG_NHOMND` bằng `MA_ND`.

Một người dùng có thể thuộc nhiều nhóm. Menu hiệu lực là hợp của menu thuộc tất cả nhóm và được loại trùng theo `MENU_ID`.

## Bảng liên quan

| Đối tượng | Cột sử dụng | Mục đích |
|---|---|---|
| `V_NGUOIDUNG_DIABAN` | `MA_ND`, `MA_NV`, `TEN_NV`, `MATKHAU`, `DONVI_ID`, `MA_DV`, `LEVEL_ROLE`, `NHANVIEN_ID`, `TRANGTHAI` | Tài khoản đăng nhập và quản trị người dùng |
| `V_NHANVIEN` | `NHANVIEN_ID`, `MA_NV`, `TEN_NV`, `CHUCDANH`, `SO_DT`, `EMAIL`, `DONVI_ID` | Hồ sơ nhân viên |
| `V_DONVI` | `DONVI_ID`, `MA_DV`, `TEN_DV` | Thông tin đơn vị |
| `V_NGUOIDUNG_NHOMND` | `MA_ND`, `NHOMND_ID` | Gán một hoặc nhiều nhóm cho tài khoản |
| `GLI_NHOM_ND` | `NHOMND_ID`, `TEN_NHOMND` | Danh mục nhóm người dùng |
| `GLI_NHOM_ND_MENU` | `NHOMND_ID`, `MENU_ID` | Gán menu cho nhóm |
| `GLI_MENU` | `MENU_ID`, `MENU_NAME`, `MENU_URL`, `MENU_CHA_ID`, `ORDER_INDEX`, `MENU_ICON`, `IS_HEADING` | Cây menu và đường dẫn chức năng |

## Quy tắc ghi tài khoản

- `MA_ND` là định danh tài khoản và không đổi sau khi tạo.
- Khi chọn `NHANVIEN_ID`, backend sao chép `MA_NV`, `TEN_NV`, `DONVI_ID`, `MA_DV` từ `V_NHANVIEN` và `V_DONVI`.
- `MATKHAU` được đặt thành `SSO_PENDING` cho tài khoản mới vì ứng dụng không xác thực mật khẩu và sẽ chuyển sang SSO.
- `TRANGTHAI = 0` là ngừng hoạt động; giá trị khác `0`, `N`, `INACTIVE`, `LOCKED` được coi là hoạt động.
- Nhóm quyền thực tế chỉ lấy từ `V_NGUOIDUNG_NHOMND`.

## Quy tắc GLI_MENU

- `MENU_ID` dùng làm ID menu và mã quyền; menu mới dùng `SEQ_MENU`.
- `MENU_CHA_ID` xác định menu cha.
- `ORDER_INDEX` là thứ tự hiển thị.
- `IS_HEADING` xác định mục tiêu đề, không điều hướng trực tiếp.

Hai bảng cũ `NBH_NHOM_ND` và `NBH_NHOM_ND_MENU` không được ứng dụng truy vấn.
