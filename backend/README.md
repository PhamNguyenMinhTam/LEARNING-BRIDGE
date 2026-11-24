# Learning Bridge — Backend Foundation v1.0

Giai đoạn 2.1 bổ sung API Express, cấu hình môi trường, pool MySQL và hai endpoint kiểm tra trạng thái. Backend dùng JavaScript CommonJS, Node.js 24 LTS, Express, mysql2/promise, dotenv và cors. Bộ kiểm thử dùng `node:test`. [Lịch phát hành Node.js](https://nodejs.org/en/about/previous-releases)

## Cài đặt trên Windows PowerShell

Cài Node.js 24 LTS để có `node` và `npm.cmd`. Dùng MySQL Community Server 8.4 LTS và schema đã thiết lập ở giai đoạn trước. Từ thư mục gốc repo:

```powershell
node --version
npm.cmd --version
mysql --version
Set-Location backend
npm.cmd ci
Copy-Item .env.example .env
notepad .env
```

Sửa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` và `DB_NAME` theo MySQL cục bộ. `DB_NAME` phải là tên schema thực tế, ví dụ `learning_bridge_dev` nếu đã dùng tên đó trong hướng dẫn database. Đặt mật khẩu thật trong `.env`, có thể dùng dấu nháy khi mật khẩu chứa dấu `#`. Biến môi trường của tiến trình được ưu tiên hơn tệp. `HOST` mặc định là `127.0.0.1`, `PORT` là `3000` và `NODE_ENV` là `development`.

Hai endpoint hiện tại chỉ dùng truy vấn `SELECT 1`. Tài khoản MySQL ứng dụng riêng cần đăng nhập qua TCP và có quyền chọn schema đã cấu hình. Tài khoản chỉ có `USAGE` có thể chạy `SELECT 1` nhưng có thể bị từ chối khi chọn schema. Một cấp quyền hẹp đủ cho giai đoạn này là `SELECT` trên một bảng của schema, ví dụ `schools`, do người quản trị cấp cho tài khoản hiện có. Không cần quyền ghi, DDL, quyền toàn cục hay quyền cấp tiếp. Đăng nhập thử với mật khẩu nhập theo prompt:

```powershell
mysql --protocol=TCP --host=127.0.0.1 --port=3306 --user=learning_bridge_app --password --database=learning_bridge_dev --execute="SELECT 1;"
```

Thay tên schema và tài khoản trong lệnh theo `.env`. Nếu chưa có schema, làm theo hướng dẫn database bằng tài khoản quản trị phát triển. Báo cáo giai đoạn trước ghi nhận sáu bảng `users`, `schools`, `teacher_schools`, `resources`, `resource_versions` và `resource_reviews`. API chọn schema đó và không tự chạy schema hay seed. Pool tối đa năm kết nối, dùng UTF-8 và diễn giải ngày giờ theo UTC ở driver. Khi có truy vấn thời gian ở các giai đoạn sau, cần đặt múi giờ session MySQL về UTC theo thiết kế. [Hướng dẫn database](../database/README.md) · [Báo cáo xác minh](../database/docs/VERIFICATION_REPORT.md)

## Chạy và kiểm thử

```powershell
npm.cmd run dev
```

Mở PowerShell thứ hai ở `backend/`:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
Invoke-RestMethod http://127.0.0.1:3000/api/health/db
npm.cmd test
npm.cmd run test:db
```

Dùng `npm.cmd start` để chạy không theo dõi thay đổi tệp. Dừng bằng Ctrl+C để đóng HTTP server và pool. `npm.cmd test` dùng MySQL giả lập. `npm.cmd run test:db` chạy pool và truy vấn thật, yêu cầu MySQL đang chạy và cấu hình hợp lệ.

| Endpoint | Kết quả |
| --- | --- |
| `GET /api/health` | HTTP 200 với `{"status":"ok","service":"learning-bridge-api"}`, độc lập với MySQL |
| `GET /api/health/db` | HTTP 200 với `{"status":"ok","database":"connected"}` hoặc HTTP 503 với lỗi JSON đã lọc. Chỉ dùng trong development qua loopback. Production trả 404. |

### Lỗi kết nối thường gặp

- `ECONNREFUSED` hoặc `ETIMEDOUT`. Kiểm tra MySQL đã chạy và cổng khớp bằng `Test-NetConnection 127.0.0.1 -Port 3306`.
- `ER_ACCESS_DENIED_ERROR`. Kiểm tra tên tài khoản, mật khẩu và host gắn với tài khoản MySQL.
- `ER_DBACCESS_DENIED_ERROR` hoặc `ER_BAD_DB_ERROR`. Kiểm tra tên schema và quyền tài khoản trên schema.
- `EADDRINUSE`. Đổi `PORT` hoặc giải phóng cổng đang dùng.

## Cấu trúc và bảo mật

- `src/app.js` tạo ứng dụng. `src/server.js` đọc cấu hình, tạo pool, mở cổng và xử lý tắt tiến trình.
- `src/config/` xác thực biến môi trường và tạo pool. Repository thực hiện truy vấn health. Controller tạo phản hồi, routes khai báo URL và middlewares xử lý lỗi tập trung.
- `tests/` chứa kiểm thử HTTP với MySQL giả lập và kiểm tra kết nối thật riêng biệt.
- JSON giới hạn 32 KB. Khi frontend chạy khác origin, mở qua HTTP và đặt `CORS_ORIGINS=http://127.0.0.1:5500,http://localhost:5500` theo địa chỉ thực tế. Mặc định danh sách rỗng và CORS không cấp quyền gửi credentials.
- Giữ `.env` ngoài Git và ngoài frontend. Khi thêm truy vấn có dữ liệu đầu vào, dùng `pool.execute('... WHERE id = ?', [id])`. Khi triển khai qua proxy, đặt `NODE_ENV=production`. Cấp quyền dựa trên dữ liệu xác thực phía server và giữ PDF riêng tư ngoài thư mục public.

## Các giai đoạn tiếp theo

| Giai đoạn | Phạm vi dự kiến |
| --- | --- |
| 2.2 Authentication & Authorization | Đăng ký giáo viên, đăng nhập/đăng xuất, băm mật khẩu, session phía server, RBAC và phân quyền theo trường |
| 2.3 Government | Quản lý trường và pattern mã giáo viên, tài khoản quản trị trường, duyệt đóng góp độc lập |
| 2.4 Teacher | Khai báo liên kết với nhiều trường, tạo tài nguyên và bản nháp, metadata tệp và gửi duyệt |
| 2.5 School | Hàng chờ duyệt, duyệt hoặc từ chối kèm lý do, dùng transaction để bảo toàn trạng thái |
| 2.6 Student | Tìm kiếm và lọc công khai, đọc phiên bản đã xuất bản, truy cập tệp an toàn và dùng liên kết chính thức |

Kiểm tra pattern mã giáo viên chỉ xác nhận định dạng. Một giáo viên có thể khai báo liên kết nhiều trường. Đình chỉ trường không tự gỡ tài nguyên hợp lệ. Sửa nội dung đã duyệt tạo phiên bản mới. Trường chỉ duyệt hồ sơ thuộc phạm vi của mình, còn Government duyệt đóng góp độc lập. Học sinh tìm tài nguyên công khai mà không cần đăng nhập. Chỉ lưu bản sao sách giáo khoa chính thức khi có quyền. [Quy tắc nghiệp vụ](../database/docs/BUSINESS_RULES.md) · [Thiết kế transaction](../database/docs/DATABASE_DESIGN.md)
