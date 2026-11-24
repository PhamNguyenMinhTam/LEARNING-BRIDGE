# System Validation Report — Phase 3.1

## Môi trường và phạm vi

Windows, Node.js 24.20.0, MySQL Community Server 8.4.9, Express và Playwright với Chrome headless. Kiểm thử dùng schema loopback cô lập, tài khoản fixture hư cấu và thư mục PDF test riêng. Repo có bốn giao diện Vanilla JS và một API cùng origin. Khảo sát README, routes, controller/service/repository, middleware session và Origin, schema, migration, fixture, tài liệu API, Business Rules, Data Dictionary và các test hiện có. Các tệp dữ liệu demo còn trong repo không được import bởi luồng giao diện chính. Workspace không có `backend/.env` khi bắt đầu. Cấu hình test được truyền qua biến môi trường riêng.

## Database và Backend API

MySQL nạp schema, session migration và seed vào database mới. Chạy lại seed báo fixture đã có và bỏ qua ghi. Information Schema ghi nhận 6 bảng nghiệp vụ, 6 PK, 6 UNIQUE ngoài PK, 9 FK, 12 CHECK và 20 index. Positive lifecycle và 27 kiểm tra từ chối đều đạt. Schema và migration giữ nguyên.

Bộ API xác minh đăng ký Teacher, duplicate email, password hash, session đổi ID khi đăng nhập, logout, hết hạn, đình chỉ, role và CSRF. Government được kiểm tra tạo và sửa trường, pattern, cấp và đình chỉ admin, Review độc lập. Teacher được kiểm tra liên kết nhiều trường, kiểm tra pattern hiện hành, scope, ownership, draft, upload, submit và các thao tác đồng thời. School và Government chỉ xử lý đúng phạm vi. Student API dùng Published Version, loại bỏ Version chưa công bố và quyền restricted, kiểm tra tải file, URL, tìm kiếm, filter và phân trang.

MySQL transport bị ngắt có kiểm soát trả `503 DATABASE_UNAVAILABLE` cho database health với JSON đã lọc. HTTP liveness vẫn trả 200.

## Giao diện và End-to-End

| Tình huống | Bằng chứng |
| --- | --- |
| A — Đóng góp theo trường | Government tạo trường và admin. Teacher đăng ký, liên kết, upload PDF và gửi duyệt. School duyệt. Student tải PDF có byte đúng fixture. |
| B — Đóng góp độc lập | Teacher không có liên kết trường gửi Government Review. Student tìm được tài liệu công khai và lấy URL HTTPS. |
| C — Từ chối và sửa | Teacher thấy ghi chú từ chối, sửa Version 2. Student chỉ thấy Version 2 khi được xuất bản. |
| D — Bảo toàn Version | Version 1 vẫn công khai khi Version 2 Pending hoặc Rejected. |
| E — Đình chỉ School | Quyết định mới trả 403, bản công khai vẫn truy cập được. Kích hoạt lại phục hồi luồng review. |
| F — Withdrawal | Catalog loại Resource. Public detail, download và preview bị chặn. Approval sau đó giữ trạng thái hidden. |
| G — Review đồng thời | Hai phiên Chrome khác nhau cùng submit approve/reject. Một HTTP 200, một HTTP 409. UI báo xung đột và DB ghi đúng reviewer, quyết định và con trỏ công bố. |
| Kiểm tra quyền bổ sung | Guest và sai role bị chặn. School B không đọc hoặc duyệt Review của School A. Session hết hạn và request thiếu Origin bị từ chối. |
| Bố cục và bàn phím | Kiểm tra chiều rộng 1440, 820, 390 px và thao tác Tab/Escape trong Chrome. |

## Chênh lệch và phạm vi chưa xác minh

Định dạng Teacher ID không chứng minh danh tính. Xác minh đăng ký trường ngoại tuyến và quyền phân phối thật là bước nghiệp vụ ngoài hệ thống. Scope Resource được cố định từ lúc tạo, chặt hơn mốc sau lần submit đầu trong tài liệu. Schema chưa phân biệt Resource withdrawn và Resource hidden thông thường, nên quy tắc hiện tại giữ hidden nếu có approval cũ. Chưa kiểm tra hiển thị trực quan PDF trên nhiều browser, file symlink trực tiếp trên Windows thiếu quyền và môi trường production. Đã kiểm tra traversal và Windows junction. [Business Rules](../database/docs/BUSINESS_RULES.md) · [Báo cáo hồi quy](REGRESSION_TEST_REPORT.md)
