# Coding Standards & Quy Trình

## Ngôn ngữ & style

- TypeScript strict mode (`strict: true`) cho cả BE và FE.
- ESLint + Prettier thống nhất cấu hình ở cả 2 repo (hoặc monorepo), format tự động trước commit
  (husky + lint-staged).
- Đặt tên biến/hàm tiếng Anh, comment/mô tả nghiệp vụ có thể tiếng Việt nếu cần rõ ràng cho domain đặc thù.

## Git

- Nhánh: `main` (production), `develop` (tích hợp), `feature/xxx`, `fix/xxx`.
- Commit message theo Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`...
- Không commit trực tiếp lên `main`/`develop`, dùng Pull Request + review tối thiểu 1 người.

## Checklist khi AI tạo module dashboard mới

1. Đã xác nhận tên package/procedure Oracle và tham số với `db-catalog.md` (hoặc hỏi lại người dùng) — chưa đoán.
2. DTO filter có validate đầy đủ (`class-validator`).
3. Service có hàm map riêng, không trả raw Oracle row ra ngoài.
4. Controller có gắn `@UseGuards(JwtAuthGuard, RolesGuard)` nếu route cần đăng nhập (mặc định: có, trừ khi ghi rõ
   là public/health-check).
5. Có xử lý lỗi (try/catch hoặc filter) không để lộ chi tiết lỗi Oracle.
6. FE: store gọi API qua `api/*.api.ts`, không gọi axios trực tiếp trong component.
7. FE: chart dùng wrapper trong `components/charts/`, không viết `option` ECharts trực tiếp trong view.
8. Có trạng thái `loading` / `error` hiển thị rõ ràng cho người dùng (skeleton, alert).
9. Responsive: kiểm tra layout trên màn hình nhỏ (dùng grid Vuetify).
10. Không hardcode secret/connection string — dùng biến môi trường.

## Testing (khuyến nghị mức tối thiểu)

- Backend: unit test cho hàm mapper (map dữ liệu Oracle → DTO response) vì đây là điểm dễ sai lệch khi DBA đổi
  cấu trúc trả về; test Guard/RolesGuard với các case role khác nhau.
- Frontend: test các composable/store logic quan trọng (không nhất thiết test toàn bộ UI).

## Quy trình kiểm tra sau khi hoàn thành tính năng

- Không tự động chạy `npm run build` sau khi hoàn thành từng tính năng; người dùng sẽ chủ động chạy và kiểm tra trên máy.
- Chỉ chạy build khi người dùng yêu cầu trực tiếp hoặc khi cần xác minh một lỗi biên dịch/build cụ thể.
- Có thể chạy kiểm tra nhẹ, phù hợp phạm vi thay đổi như lint hoặc test mục tiêu khi cần, nhưng không coi build là bước bắt buộc cho mỗi thay đổi.

## Logging & Monitoring

- Backend log theo format có cấu trúc (JSON) gồm: `requestId`, `userId` (nếu có), `module`, `duration`, `status`.
- Log riêng các lần gọi procedure Oracle chậm (> ngưỡng, VD 2s) để phát hiện điểm nghẽn.

## Tài liệu cần AI/Dev luôn cập nhật song song khi code

- `docs/db-catalog.md`: danh sách procedure đã dùng, tham số, mô tả.
- `docs/api-contract.md` hoặc Swagger tự sinh: danh sách API, request/response mẫu.
- File `06-sso-vnpt.md`: cập nhật checklist khi có thông tin chính thức từ team IAM.
