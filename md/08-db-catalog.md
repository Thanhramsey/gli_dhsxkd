# DB Catalog — Đăng nhập và phân quyền menu

## Quan hệ đang sử dụng

```text
V_NGUOIDUNG_DIABAN.NHANVIEN_ID  → V_NHANVIEN.NHANVIEN_ID
V_NHANVIEN.DONVI_ID             → V_DONVI.DONVI_ID
V_NGUOIDUNG_DIABAN.LEVEL_ROLE   → GLI_NHOM_ND.NHOMND_ID
GLI_NHOM_ND.NHOMND_ID           → GLI_NHOM_ND_MENU.NHOMND_ID
GLI_NHOM_ND_MENU.MENU_ID        → GLI_MENU.MENU_ID
GLI_MENU.MENU_CHA_ID             → GLI_MENU.MENU_ID
ONEBSS_BAOCAO_GLI.NHOMBC_ID     → ONEBSS_NHOMBC_GLI.NHOMBC_ID
```

`V_NGUOIDUNG_DIABAN` là nguồn tài khoản duy nhất cho đăng nhập và CRUD quản trị. Ứng dụng không còn đọc hoặc ghi `V_NGUOIDUNG`.

Thông tin nhân viên được map bằng `NHANVIEN_ID`. Trường `TRANGTHAI` quyết định tài khoản được phép đăng nhập. Nhóm quyền được map trực tiếp từ `V_NGUOIDUNG_DIABAN.LEVEL_ROLE` sang `GLI_NHOM_ND.NHOMND_ID`.

Mỗi người dùng thuộc tối đa một nhóm vì `LEVEL_ROLE` là một cột đơn. Menu hiệu lực là các menu được gán cho nhóm đó trong `GLI_NHOM_ND_MENU`.

## Bảng liên quan

| Đối tượng | Cột sử dụng | Mục đích |
|---|---|---|
| `V_NGUOIDUNG_DIABAN` | `MA_ND`, `MA_NV`, `TEN_NV`, `MATKHAU`, `DONVI_ID`, `MA_DV`, `LEVEL_ROLE`, `NHANVIEN_ID`, `TRANGTHAI` | Tài khoản đăng nhập và quản trị người dùng |
| `V_NHANVIEN` | `NHANVIEN_ID`, `MA_NV`, `TEN_NV`, `CHUCDANH`, `SO_DT`, `EMAIL`, `DONVI_ID` | Hồ sơ nhân viên |
| `V_DONVI` | `DONVI_ID`, `MA_DV`, `TEN_DV` | Thông tin đơn vị |
| `GLI_NHOM_ND` | `NHOMND_ID`, `TEN_NHOMND` | Danh mục nhóm người dùng |
| `GLI_NHOM_ND_MENU` | `NHOMND_ID`, `MENU_ID` | Gán menu cho nhóm |
| `GLI_MENU` | `MENU_ID`, `MENU_NAME`, `MENU_URL`, `MENU_CHA_ID`, `ORDER_INDEX`, `MENU_ICON`, `IS_HEADING` | Cây menu và đường dẫn chức năng |
| `ONEBSS_NHOMBC_GLI` | `NHOMBC_ID`, `NHOM_BC`, `GHICHU` | Danh mục nhóm báo cáo |
| `ONEBSS_BAOCAO_GLI` | `BAOCAO_ID`, `TEN_BC`, `STRING_SQL`, `TM1`–`TM7`, `RPT_VIEW`, `RPT_EXPORT`, `NHOMBC_ID`, `PROC_PK` | Cấu hình báo cáo và nguồn dữ liệu |

## Quy tắc ghi tài khoản

- `MA_ND` là định danh tài khoản và không đổi sau khi tạo.
- Khi chọn `NHANVIEN_ID`, backend sao chép `MA_NV`, `TEN_NV`, `DONVI_ID`, `MA_DV` từ `V_NHANVIEN` và `V_DONVI`.
- `MATKHAU` được đặt thành `SSO_PENDING` cho tài khoản mới vì ứng dụng không xác thực mật khẩu và sẽ chuyển sang SSO.
- `TRANGTHAI = 0` là ngừng hoạt động; giá trị khác `0`, `N`, `INACTIVE`, `LOCKED` được coi là hoạt động.
- `LEVEL_ROLE` có thể để trống nếu tài khoản chưa được phân quyền.
- Nhóm quyền thực tế chỉ lấy từ `LEVEL_ROLE`; ứng dụng không còn đọc hoặc ghi `V_NGUOIDUNG_NHOMND`.

## Quy tắc GLI_MENU

- `MENU_ID` dùng làm ID menu và mã quyền; menu mới dùng `SEQ_MENU`.
- `MENU_CHA_ID` xác định menu cha.
- `ORDER_INDEX` là thứ tự hiển thị.
- `IS_HEADING` xác định mục tiêu đề, không điều hướng trực tiếp.

## Quy tắc cấu hình báo cáo

- `NHOMBC_ID` và `BAOCAO_ID` được sinh trong transaction có khóa bảng để tránh trùng ID.
- Không được xóa nhóm báo cáo khi vẫn còn báo cáo tham chiếu đến nhóm.
- `STRING_SQL` lưu câu lệnh Oracle SQL/PLSQL khi báo cáo truy vấn trực tiếp.
- `PROC_PK` lưu package/procedure khi báo cáo lấy dữ liệu qua thủ tục.
- `TM1` đến `TM7` là các cấu hình tham số của báo cáo và có thể để trống.

Hai bảng cũ `NBH_NHOM_ND` và `NBH_NHOM_ND_MENU` không được ứng dụng truy vấn.
