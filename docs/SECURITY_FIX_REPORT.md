# Security Fix Report — Phase 3.2

- **LB-32-01** — Public SQL yêu cầu administrative_status normal và Published Version hợp lệ. Withdraw dùng cùng khóa Resource với Submit và Review. Reinstatement có endpoint riêng, yêu cầu Government active, Origin hợp lệ và version_id thuộc Resource. Kiểm tra lại Review approved, public access, rights, đường dẫn và nội dung. Phản hồi Teacher được chiếu trường rõ ràng để không trả lý do withdrawal hoặc ID hành chính.
- **LB-32-02** — Xác minh ổ đĩa trước khi duyệt/phục hồi và trước khi reviewer mở PDF. Upload xác nhận root là thư mục, dùng tên UUID và open độc quyền. Unit test kiểm tra junction/link root, traversal, file hỏng và kích thước. Không giữ khóa MySQL trong lúc kiểm tra PDF cho thao tác duyệt/phục hồi.
- **LB-32-03** — Giới hạn 30 request tải lên trên mỗi IP trong 15 phút theo từng tiến trình. Header nosniff, Referrer-Policy và SAMEORIGIN được đặt cho ứng dụng.

Các giới hạn còn lại gồm kiểm tra cấu trúc PDF thay vì quét malware, ACL kho do hệ điều hành quản lý, rate limiter trong bộ nhớ từng tiến trình, và lịch sử hành chính chỉ lưu thông tin gần nhất. Thao tác download đã bắt đầu hoặc bản sao đã tải ngoài ứng dụng không thể thu hồi. File symlink Windows trực tiếp phụ thuộc quyền hệ điều hành; regression có thử junction để xác minh nhánh thoát thư mục. [Checklist triển khai](DEPLOYMENT_SECURITY_CHECKLIST.md)

## Kết quả xác minh

- Node test: 33/33.
- MySQL 8.4.9 cô lập: 7/7 integration tests. Kiểm tra legacy_hold và chạy 28/28 ca SQL cả trước lẫn sau migration 002.
- Chrome headless: 5/5 Playwright. Tiến trình Backend mới dùng cùng Database và kho PDF vẫn trả 404 cho detail, preview và download của Resource đã rút. Teacher bị từ chối khi yêu cầu reinstatement.
- API reinstatement chặn Version sai Resource, restricted và PDF bị thiếu. Cho phép Government phục hồi Version có đủ điều kiện.
- Một lượt integration đồng thời sớm trả 500 khi khai báo liên kết trường. Luồng liên kết nay dùng lại retry có giới hạn cho lỗi khóa MySQL. Lượt cuối đạt. Không xác nhận mã lỗi gốc của phản hồi 500 vì HTTP đã lọc nội dung.

Chưa thực hiện restore drill, pentest môi trường triển khai, xác minh TLS/proxy thật hoặc quét malware. Kết quả phù hợp với chuẩn bị triển khai, chưa phải phê duyệt mở production.
