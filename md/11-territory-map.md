# Bản đồ địa bàn giao ban

## Dữ liệu hiện tại

- `frontend/src/assets/gia-lai-wards.json`: ranh giới 135 xã/phường, định danh bằng mã xã/phường. Không chứa thông tin TTVT hoặc nhân viên.
- `frontend/src/assets/gia-lai-center-assignments.json`: gán mã xã/phường cho mã TTVT. Đây là dữ liệu phân công cấp 2, tách khỏi ranh giới.
- `frontend/src/assets/gia-lai-service-centers.json`: 12 vùng TTVT được gộp từ ranh giới xã/phường theo bảng phân công, kèm tên và điểm đặt nhãn. Tạo lại bằng `scripts/generate-gia-lai-center-boundaries.py` khi phân công cấp 2 thay đổi.
- `frontend/src/components/charts/TerritoryMapChart.vue`: phần vẽ chung. Nhận GeoJSON và danh sách vùng đã chuẩn hóa (`id`, tên feature, màu, nhãn, tooltip), phát sự kiện chọn/rê chuột theo `id`. Không biết TTVT, nhân viên hay tên KPI.
- `frontend/src/components/KpiUnitMapDialog.vue`: ghép số liệu KPI cấp 2 với vùng TTVT để đưa vào phần vẽ chung.

## Khi triển khai địa bàn cấp 3

API cần trả về quan hệ **mã xã/phường → mã nhân viên phụ trách**, cùng số liệu KPI của nhân viên theo tháng/chỉ tiêu/kỳ so sánh. Mã xã/phường phải khớp `properties.code` trong ranh giới gốc; không đối chiếu bằng tên vì tên có thể đổi hoặc trùng.

Giao diện cấp 3 dùng lại `gia-lai-wards.json` và `TerritoryMapChart.vue`, tạo một vùng cho mỗi xã/phường với `id` là mã xã/phường. Màu và tooltip được tính từ nhân viên phụ trách do API trả về. Không thêm tọa độ hoặc tên nhân viên cố định vào component bản đồ.

Nếu một xã/phường được chia cho nhiều nhân viên, ranh giới cấp xã không đủ để tô chính xác từng phần. Khi đó cần dữ liệu ranh giới nhỏ hơn hoặc quy ước hiển thị riêng cho vùng dùng chung.
