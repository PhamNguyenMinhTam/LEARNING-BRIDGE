# Bug Report — Phase 3.1

| ID | Mức | Thành phần | Trạng thái |
| --- | --- | --- | --- |
| LB-31-01 | P1 | School Review dialog | Đã sửa |
| LB-31-02 | P2 | Fetch client và lỗi phản hồi | Đã sửa |
| LB-31-03 | P2 | Fetch client và timeout | Đã sửa |

## LB-31-01 — Phản hồi cũ thay hồ sơ đang xem

- **Tái hiện** — Mở Review A và giữ phản hồi. Đóng dialog, mở Review B, đợi B hiển thị rồi trả phản hồi A.
- **Kỳ vọng** — Nội dung và đối tượng được chọn vẫn là B.
- **Thực tế** — Tiêu đề đổi từ B về A. Biến selected dùng cho thao tác quyết định cũng bị cập nhật từ phản hồi cũ. Backend vẫn kiểm tra vai trò và phạm vi School.
- **Nguyên nhân** — Điều kiện chỉ kiểm tra dialog đang mở, thiếu liên kết giữa phản hồi và lần mở hiện tại.
- **Sửa và kiểm chứng** — Chỉ lần mở mới nhất được cập nhật nội dung, lựa chọn và thông báo lỗi. Playwright tái hiện FAILED trước sửa và kiểm tra hồi quy sau sửa.

## LB-31-02 — Phản hồi bất thường hiện lỗi kỹ thuật

- **Tái hiện** — Trong Student Catalog, mô phỏng HTTP 200 với JSON không đọc được. Thử thêm HTTP 200 trả HTML và HTTP 503 không có JSON.
- **Kỳ vọng** — Người dùng nhận thông báo tiếng Việt ổn định và có thể tìm lại sau khi kết nối phục hồi.
- **Thực tế** — JSON không hợp lệ hiển thị lỗi parser tiếng Anh. HTTP 200 trả HTML đưa `null` cho màn hình mong đợi JSON.
- **Nguyên nhân** — Đọc JSON trực tiếp và để SQL/API client caller tự xử lý kiểu phản hồi.
- **Sửa và kiểm chứng** — Client chuẩn hóa lỗi nội dung và fallback theo HTTP status. Giữ `204` hợp lệ cho logout. Hồi quy thử JSON lỗi, HTML, 503, mất kết nối và kết quả trống sau phục hồi.

## LB-31-03 — Loading vô hạn

- **Tái hiện** — Giữ request catalog mở mà không gửi phản hồi và dịch đồng hồ browser qua 61 giây.
- **Kỳ vọng** — Màn hình kết thúc trạng thái loading và báo timeout.
- **Thực tế** — Vẫn hiện “Đang tìm tài liệu…”.
- **Nguyên nhân** — Client chỉ có thể nhận tín hiệu hủy từ caller. Không có deadline nội bộ.
- **Sửa và kiểm chứng** — Timeout 15 giây cho đọc, 60 giây cho ghi, bao gồm đọc response body. Caller vẫn có thể hủy. Với request ghi bị timeout hoặc mất kết nối, thông báo nhắc tải lại dữ liệu để xác nhận kết quả. Client không tự gửi lại mutation.
