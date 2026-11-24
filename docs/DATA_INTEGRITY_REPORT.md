# Data Integrity Report — Phase 3.2

## Mô hình và thứ tự khóa

Sáu bảng nghiệp vụ và khóa ngoại ghép giữa Resource với Published Version được giữ. PK, FK, UNIQUE và CHECK tiếp tục kiểm soát ownership theo quan hệ, số phiên bản, trạng thái Review và con trỏ. Create Resource cùng Version 1, tạo Version mới, Submit, Review, withdrawal và reinstatement dựa vào transaction. Các thao tác cạnh tranh khóa Resource trước khi ghi. Review chỉ cập nhật pending. Khi ghi fail phải rollback cả quyết định và con trỏ.

## Migration 002

Dừng tất cả app writers và chụp backup đã kiểm tra trước khi chạy. Áp dụng `backend/migrations/002_resource_withdrawal.sql` một lần sau migration session. Dùng DBA cho DDL và backfill. Không chạy migration tự động khi app start. Cài phiên bản ứng dụng mới sau khi backfill hoàn tất. Migration gồm DDL và UPDATE riêng vì MySQL DDL tự commit. Nếu UPDATE bị gián đoạn sau khi DDL đã áp dụng, kiểm tra trạng thái schema và chạy lại riêng câu UPDATE trong cửa sổ bảo trì trước khi mở app.

- `normal` dùng kết hợp hidden/NULL hoặc published/con trỏ như trước. Nếu đã reinstatement, `reinstated_at` và `reinstated_by` phân biệt với publication thông thường.
- `withdrawn` chuyển hidden nhưng giữ `published_version_id`. Lý do, thời điểm và actor được lưu theo lần withdrawal gần nhất.
- `legacy_hold` áp dụng với bản ghi hidden có approval trước migration. Schema cũ không cho biết đã thực sự rút hay chưa, cũng đã xóa con trỏ nếu từng rút. Migration giữ ẩn và không tạo lịch sử giả.
- Reinstatement dùng `POST /api/government/resources/:id/reinstate`, body `{"version_id":"12"}`. Endpoint chấp nhận bản đủ điều kiện thuộc cùng Resource. Trả 409 nếu Resource đang normal hoặc Version không đủ quyền/nội dung; 404 nếu Version thuộc Resource khác hoặc không tồn tại.

Fixture SQL cũ có thể giữ nguyên. Bản ghi mới thông thường không tự bị hold sau khi approve một Version restricted. Chọn rollback bằng quy trình backup và đối soát dữ liệu với DBA. Không hạ app trong khi schema còn withdrawn có con trỏ. Rollback DDL trực tiếp có thể mất metadata và cần chuyển các con trỏ hidden về NULL trước khi khôi phục CHECK cũ, vì vậy cần có kế hoạch bảo toàn các thay đổi sau backup. Không chạy rollback tự động.

[Cơ chế Review cũ và giao thức khóa](../backend/docs/REVIEW_API.md) · [Checklist triển khai](DEPLOYMENT_SECURITY_CHECKLIST.md)
