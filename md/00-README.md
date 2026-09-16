# AI Coding Guide — Dashboard Điều Hành

Bộ tài liệu này dùng để "nạp ngữ cảnh" cho AI (Claude, Copilot, Cursor...) khi hỗ trợ code dự án
**Dashboard điều hành** kết nối Oracle DB (package/procedure có sẵn), backend NestJS, frontend Vue3 + Vuetify3,
biểu đồ Apache ECharts, và tích hợp SSO tập đoàn VNPT trong tương lai.

## Cách dùng

- Đặt các file `.md` này ở gốc repo, ví dụ thư mục `docs/ai/`.
- Với Claude Code / Cursor: có thể gộp nội dung vào `CLAUDE.md` hoặc `.cursorrules` ở root, hoặc để AI đọc riêng
  từng file khi cần theo ngữ cảnh (backend, frontend, DB, SSO).
- Khi bắt đầu 1 task mới, luôn nhắc AI đọc: `01-architecture.md` + file chuyên biệt liên quan đến task
  (VD: sửa API → đọc `02-backend-nestjs.md` + `03-database-oracle.md`).

## Danh sách file

| File | Nội dung |
|---|---|
| `01-architecture.md` | Kiến trúc tổng thể, luồng dữ liệu, quy ước thư mục |
| `02-backend-nestjs.md` | Quy ước code NestJS: module, service, DTO, error handling |
| `03-database-oracle.md` | Quy ước gọi package/procedure Oracle, mapping cursor → JSON |
| `04-frontend-vue3.md` | Quy ước Vue3 + Vuetify3: cấu trúc component, state, API layer |
| `05-charts-echarts.md` | Quy ước dựng biểu đồ ECharts, wrapper component, theme |
| `06-sso-vnpt.md` | Thiết kế tích hợp SSO VNPT (OAuth2/OIDC), phân quyền |
| `07-coding-standards.md` | Coding convention chung, git, review checklist |

## Nguyên tắc AI cần tuân thủ khi code dự án này

1. **Không tự ý sửa logic nghiệp vụ trong package/procedure Oracle** — đó là phần do team DBA/BA khác phụ trách.
   Backend chỉ gọi và map dữ liệu.
2. **Luôn qua DTO + validation** ở NestJS trước khi gọi procedure, không truyền thẳng input người dùng vào SQL/PLSQL.
3. **Không hardcode chuỗi kết nối, secret, token** — dùng biến môi trường (`.env`, ConfigModule).
4. **Chart component phải tái sử dụng được** — không viết option ECharts lặp lại ở nhiều nơi.
5. **SSO là lớp xác thực trung tâm** — mọi API (trừ health-check) phải đi qua Guard xác thực khi SSO được bật.
6. Khi không chắc chắn về tên procedure/package, tham số, hoặc cấu trúc trả về — AI nên hỏi lại thay vì đoán.
