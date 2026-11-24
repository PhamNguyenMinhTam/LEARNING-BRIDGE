# Security Audit — Phase 3.2

Đã rà session, Origin/CORS, phân quyền theo vai trò và trường, ownership, SQL, Review transaction, các API công khai và kho PDF. Bằng chứng gồm đọc mã, kiểm thử hồi quy và MySQL cô lập. Đánh giá theo rủi ro kiểm soát truy cập, cấu hình bảo mật và tính toàn vẹn của dữ liệu.

| ID | Mức | Điều kiện và bằng chứng | Tác động | Xử lý |
| --- | --- | --- | --- | --- |
| LB-32-01 | High | Sau withdrawal, Phase 3.1 ghi hidden và xóa con trỏ. Trạng thái này trùng với Resource chưa từng công bố nhưng có Review approved. | Mất dấu bản từng công bố, chặn nhầm bản hợp lệ, không có đường phục hồi có kiểm tra. Quy tắc cũ đã ngăn tự công bố lại trong các luồng đã kiểm tra. | Trạng thái hành chính bền vững, giữ con trỏ, lý do lần rút gần nhất và Government-only reinstatement. |
| LB-32-02 | Medium | Đường dẫn kho được hệ điều hành ánh xạ qua junction. Đọc đã kiểm tra root bằng lstat, còn ghi dùng mkdir và open trực tiếp. | Ghi PDF ra ngoài vị trí kho dự kiến nếu cấu hình hay thư mục cục bộ bị thay thế. | Từ chối root junction khi ghi. Kiểm tra lại cấu trúc PDF khi reviewer mở tệp và lúc đánh giá điều kiện công bố. |
| LB-32-03 | Low | Upload đã giới hạn size và đồng thời nhưng chưa hạn chế số request theo IP. | Có thể dùng tài nguyên CPU/đĩa nhiều lần từ một client đã đăng nhập. | Dùng rate limiter hiện có và giữ giới hạn size/concurrency. |

Đăng ký gán Teacher ở server. Argon2id, session regeneration, hết hạn, logout và đình chỉ tài khoản có kiểm thử. API sử dụng identifier và phạm vi từ session/DB. MySQL nhận tham số, sort dùng allowlist, URL yêu cầu HTTPS. Giao diện dùng DOM text cho nội dung API. Kiểm tra Git chỉ thấy cấu hình mẫu và dữ liệu fixture trong phạm vi thay đổi. [Báo cáo bản sửa](SECURITY_FIX_REPORT.md)
