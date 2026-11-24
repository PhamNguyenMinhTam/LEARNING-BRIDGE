# Báo cáo End-to-End — Phase 2.7

Môi trường kiểm thử là Windows, Node.js 24.20.0, Express, Playwright với Google Chrome headless và MySQL Community Server 8.4.9 chạy riêng trên loopback. Các tài khoản và Resource đều là fixtures hư cấu. MySQL test dùng thư mục riêng, nạp business schema và session migration. Kho PDF của browser test nằm trong Temp. API dùng tài khoản MySQL có quyền giới hạn trong schema test. Không chạy với dữ liệu production.

## Kết quả trình duyệt

| Tình huống | Kỳ vọng và quan sát được | Kết quả |
| --- | --- | --- |
| A — School contribution | Government tạo trường, đổi Teacher ID Pattern và cấp School Admin. Teacher đăng ký, khai báo đúng pattern, tạo Draft, tải PDF và gửi duyệt. School duyệt, Student tìm đúng Version 1 và tải PDF qua browser. API preview trả PDF inline. | PASSED |
| B — Independent contribution | Teacher không có liên kết trường gửi bản nháp độc lập. Government duyệt qua hàng chờ riêng. Student tìm thấy Resource và lấy URL HTTPS bên thứ ba từ Backend. | PASSED |
| C — Rejection và resubmission | School từ chối Version 1 với lý do. Teacher thấy ghi chú, tạo và sửa Version 2, gửi lại. Sau khi được duyệt, Student thấy Version 2. | PASSED |
| D — Published Version preservation | Student tiếp tục thấy Version 1 khi Version 2 Pending rồi Rejected. | PASSED |
| E — School suspension | School bị đình chỉ mất quyền quyết định mới, API trả 403. Version đã xuất bản vẫn truy cập được. Sau kích hoạt lại, School xử lý được hàng chờ. | PASSED |
| F — Unauthorized access | Guest không đọc Resource Teacher, Teacher không gọi Government APIs, School B không thấy hoặc duyệt Review của School A. Request thiếu Origin, session hết hạn, PDF chưa xuất bản và URL dashboard sai vai trò đều bị chặn. Logout hủy session. | PASSED |
| G — Withdrawal | Government dùng giao diện để rút xuất bản. Public search loại Resource, detail/download/preview trả 404. Approval sau đó vẫn giữ Resource ở trạng thái hidden. | PASSED |
| Responsive và bàn phím | Kiểm tra chiều ngang 1440, 820 và 390 px, gồm Student, các trang đăng nhập và dashboard đã xác thực. Filter dialog mobile mở được và đóng bằng Escape. Kiểm tra focus-visible bằng Tab. | PASSED |

Kịch bản A–G là bảy bước kiểm thử trong một bài Playwright dùng dữ liệu nối tiếp. Bài Playwright còn lại kiểm tra bố cục và thao tác bàn phím. Không dùng mocked API trong E2E.

## Backend và ràng buộc dữ liệu

| Kiểm thử | Quan sát được | Kết quả |
| --- | --- | --- |
| `npm.cmd test` | 33/33 unit và HTTP kiểm thử tự động | PASSED |
| `npm.cmd run test:db` | 6/6 tích hợp MySQL, gồm auth, Government, health, Public, Review và Teacher | PASSED |
| `database/tests/validation.sql` | Positive lifecycle, publication và withdrawal | PASSED |
| `database/tests/negative_tests.sql` | 27/27 ca, gồm FK, UNIQUE, CHECK và con trỏ xuất bản | PASSED |
| Kiểm tra cú pháp JavaScript | Frontend, Backend và các bài kiểm thử | PASSED |
| Điều hướng sang dịch vụ bên thứ ba | Kiểm tra URL do API trả, cùng thuộc tính `noopener noreferrer`. Fixture dùng hostname `example.invalid`, nên không kiểm tra tải nội dung từ website đó. | NOT RUN cho nội dung đích |
| Hiển thị trực quan PDF trong các trình xem khác nhau | Download qua Chrome và phản hồi HTTP inline đã được kiểm tra. Chưa kiểm tra cách trình xem native vẽ trang PDF trên nhiều browser. | NOT RUN |

## Vấn đề đã phát hiện và xử lý

- Các trang đăng nhập cũ dùng trường School/Teacher ID hoặc username và không gọi session API. Form dùng email theo contract hiện hành, vào đúng dashboard sau khi `/auth/me` trả role thực.
- Government có CSP cũ chặn mọi kết nối. Cấu hình đã cho phép kết nối cùng origin, tiếp tục chặn native form submission và object.
- School cần tên và trạng thái của trường từ server. Thêm endpoint profile theo session và mở rộng metadata hàng chờ để dựng bảng mà không tạo N+1 request chi tiết.
- Lượt Playwright đầu kẹt khi chọn trường do nhãn của select chứa text các option. Form dùng label `for` và ID rõ ràng, đồng thời test đặt thời hạn cho từng thao tác. Sau sửa, hành trình A–G hoàn thành.

## Giới hạn còn lại

Schema chưa lưu lý do withdrawal hoặc trạng thái withdrawal riêng. Kết quả G xác nhận quy tắc chặn tự xuất bản cho Resource ẩn có approval cũ, gồm một số trường hợp chưa từng xuất bản. Đây là hành vi MVP bảo thủ. PDF không được quét malware và việc render inline còn tùy browser/CSP. Kiểm thử đường dẫn dùng Windows junction vì máy không có quyền tạo file symlink. Môi trường triển khai và thiết bị người dùng khác chưa nằm trong lần chạy này.

**Kết luận: READY FOR MVP TESTING.** Các luồng chính đã được kiểm chứng với browser thật và MySQL cô lập.
