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
| `GET` | `/broadband/procedures` | Session | Danh sách 7 báo cáo được phép gọi trong `NBH_CDS_NEW.PACK_BR` |
| `GET` | `/broadband/units` | Session | Danh mục `DONVI_ID`, `TEN_DV` từ bảng `DON_VI` |
| `POST` | `/broadband/procedures/:key` | Session | Gọi một procedure báo cáo bằng khóa allowlist và bind variables |

## Báo cáo băng rộng

Body của `POST /broadband/procedures/:key`:

```json
{
  "fromDate": "2026-09-01",
  "toDate": "2026-09-21",
  "unitId": 0,
  "serviceId": 0,
  "subscriberTypeId": 0,
  "areaId": 0
}
```

`fromDate` và `toDate` dùng định dạng `YYYY-MM-DD`. Giá trị `0` ở các bộ lọc nghĩa là lấy tất cả theo quy ước của package. Frontend không được gửi tên package hoặc procedure tùy ý; `:key` chỉ nhận một trong các khóa do backend khai báo. Tên package/procedure được chọn từ allowlist phía server, còn toàn bộ giá trị đầu vào được truyền bằng typed bind variables.

Response người dùng giữ `groupId`, `groupName` và `groupIds` để tương thích giao diện hiện có. Do `LEVEL_ROLE` là một giá trị đơn, `groupIds` chỉ rỗng hoặc chứa đúng một phần tử.

Mã menu được phép mở trang quản trị cấu hình bằng biến `MENU_ADMIN_CODE`. Giá trị này phải là `MENU_ID` tương ứng trong `GLI_MENU`; frontend dùng biến `VITE_MENU_ADMIN_CODE` cùng giá trị.

## Dữ liệu giao ban v2 — Doanh thu PTM

Các API sau yêu cầu session. Trường `group` nhận `actual`, `maintenance` hoặc `ptm`:

| Method | Endpoint | Đầu vào | Nguồn nhóm `ptm` |
|---|---|---|---|
| `GET` | `/kpi/v2-months` | `?group=ptm` | Tháng có dữ liệu thực hiện của các KPI `DTPTM_*` |
| `POST` | `/kpi/v2-report` | `{ "month": "2026-10", "group": "ptm", "unitScope": "area" }` | `BCGIAOBAN_GLI.SP_VIEW_PTM` với `P_MONTH` được bind |
| `POST` | `/kpi/v2-unit-trend` | `{ "month": "2026-10", "group": "ptm", "unitScope": "area", "kpi": "DTPTM_FIBER", "unitCode": "..." }` | Cùng procedure theo từng tháng đến tháng báo cáo |

`unitScope` của nhóm PTM nhận `area` (mặc định: TTVT + VNPT cùng địa bàn), `ttvt` hoặc `vnpt`. `unitCode` trong response là `DIABAN_ID` của `v_donvi_diaban`; mã toàn tỉnh vẫn là `237`. Các chỉ tiêu tháng, lũy kế và kế hoạch năm được cộng theo KPI và địa bàn trong phạm vi đã chọn. Response dùng cấu trúc `KpiV2Row` như hai tab doanh thu còn lại. `monthlyChange` là thực hiện tháng báo cáo trừ thực hiện tháng liền trước, lấy bằng hai lần gọi procedure có bind tháng; thiếu số so sánh trả `null`. `remainingAnnual` được tính từ kế hoạch năm trừ thực hiện lũy kế khi có kế hoạch hợp lệ.

Response `/kpi/v2-report` với `group: "ptm"` có thêm `subscriberRows` gồm các KPI `SLPTM_*`: `kpi`, `unitCode`, `unitName`, `chartName`, `monthlyCount`, `previousCount`, `change`, `cumulativeCount`. Các số này tính theo thuê bao, không chia cho triệu/tỷ. Giữ `null` khi thiếu dữ liệu; `change` là tháng báo cáo trừ tháng liền trước.

`subscriberRows` còn trả `monthlyPlan`, `annualPlan` từ proc sau khi gom đơn vị. Giao diện sản lượng dùng biểu đồ hai thanh ghép so sánh tháng trước (cam vàng) và tháng báo cáo (xanh VNPT), cùng bảng tháng trước, tháng báo cáo, tăng/giảm, thực hiện lũy kế; sắp theo sản lượng tháng giảm dần.

Phạm vi PTM `area` bao gồm cả `TTCSKH`, `TTKDGP` dưới dạng đơn vị riêng. Các dòng này có `unitCode` dạng `TTCSKH:MA_DV` / `TTKDGP:MA_DV`, `isTerritory: false` trong cả `rows` và `subscriberRows`; không hiển thị trên bản đồ vùng. Dùng nguyên `unitCode` đó khi gọi `/kpi/v2-unit-trend`.

## Chuyển sang SSO

`JwtAuthGuard`, `AuthenticatedUser` và contract `/auth/me` được giữ ổn định. Khi có thông tin OIDC chính thức, thay bước nhận `MA_ND` trong `/auth/login` bằng callback SSO và ánh xạ claim SSO sang đúng `MA_ND`.
