# Learning Bridge — Backend

Backend gồm nền tảng Express/MySQL của Phase 2.1, xác thực và phân quyền của Phase 2.2, Government Management APIs của Phase 2.3 và Teacher APIs của Phase 2.4. Backend dùng JavaScript CommonJS, Node.js 24 LTS, Express, mysql2/promise, dotenv và cors. Bộ kiểm thử dùng `node:test`. [Lịch phát hành Node.js](https://nodejs.org/en/about/previous-releases)

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

Hai endpoint health chỉ dùng truy vấn `SELECT 1`. Tài khoản MySQL ứng dụng riêng cần đăng nhập qua TCP và có quyền chọn schema đã cấu hình. Tài khoản chỉ có `USAGE` có thể chạy `SELECT 1` nhưng có thể bị từ chối khi chọn schema. Một cấp quyền đủ riêng cho health check là `SELECT` trên một bảng của schema, ví dụ `schools`, do người quản trị cấp cho tài khoản hiện có. Health check không cần quyền ghi, DDL, quyền toàn cục hay quyền cấp tiếp. Xem quyền của toàn bộ ứng dụng trong mục Phase 2.2. Đăng nhập thử với mật khẩu nhập theo prompt:

```powershell
mysql --protocol=TCP --host=127.0.0.1 --port=3306 --user=learning_bridge_app --password --database=learning_bridge_dev --execute="SELECT 1;"
```

Thay tên schema và tài khoản trong lệnh theo `.env`. Nếu chưa có schema, làm theo hướng dẫn database bằng tài khoản quản trị phát triển. Báo cáo giai đoạn trước ghi nhận sáu bảng `users`, `schools`, `teacher_schools`, `resources`, `resource_versions` và `resource_reviews`. API chọn schema đó và không tự chạy schema hay seed. Pool tối đa năm kết nối, dùng UTF-8 và diễn giải ngày giờ theo UTC ở driver. Khi có truy vấn thời gian ở các giai đoạn sau, cần đặt múi giờ session MySQL về UTC theo thiết kế. [Hướng dẫn database](../database/README.md) · [Báo cáo xác minh](../database/docs/VERIFICATION_REPORT.md)

## Kiểm tra API health

Trước khi khởi động, hoàn tất cấu hình session và migration theo mục Phase 2.2 bên dưới.

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
- JSON giới hạn 32 KB. Khi frontend chạy khác origin, mở qua HTTP và đặt `CORS_ORIGINS=http://127.0.0.1:5500,http://localhost:5500` theo địa chỉ thực tế. Mặc định danh sách rỗng và CORS của health API không cấp quyền gửi credentials.
- Giữ `.env` ngoài Git và ngoài frontend. Khi thêm truy vấn có dữ liệu đầu vào, dùng `pool.execute('... WHERE id = ?', [id])`. Khi triển khai qua proxy, đặt `NODE_ENV=production`. Cấp quyền dựa trên dữ liệu xác thực phía server và giữ PDF riêng tư ngoài thư mục public.

## Lộ trình

| Giai đoạn | Phạm vi dự kiến |
| --- | --- |
| 2.2 Authentication & Authorization | Đã triển khai đăng ký, đăng nhập, session, RBAC và middleware phạm vi trường |
| 2.3 Government | Đã triển khai quản lý trường, pattern mã giáo viên và tài khoản quản trị trường. Duyệt đóng góp độc lập thuộc giai đoạn sau. |
| 2.4 Teacher | Đã triển khai liên kết trường, Resource, Draft Version, PDF riêng tư và gửi duyệt |
| 2.5 School | Hàng chờ duyệt, duyệt hoặc từ chối kèm lý do, dùng transaction để bảo toàn trạng thái |
| 2.6 Student | Tìm kiếm và lọc công khai, đọc phiên bản đã xuất bản, truy cập tệp an toàn và dùng liên kết chính thức |

Kiểm tra pattern mã giáo viên chỉ xác nhận định dạng. Một giáo viên có thể khai báo liên kết nhiều trường. Đình chỉ trường không tự gỡ tài nguyên hợp lệ. Sửa nội dung đã duyệt tạo phiên bản mới. Trường chỉ duyệt hồ sơ thuộc phạm vi của mình, còn Government duyệt đóng góp độc lập. Học sinh tìm tài nguyên công khai mà không cần đăng nhập. Chỉ lưu bản sao sách giáo khoa chính thức khi có quyền. [Quy tắc nghiệp vụ](../database/docs/BUSINESS_RULES.md) · [Thiết kế transaction](../database/docs/DATABASE_DESIGN.md)

## Phase 2.2 — Xác thực và phân quyền

**Xác thực** trả lời “Bạn là ai?” thông qua mật khẩu và session. **Phân quyền** trả lời “Bạn được phép làm gì?” dựa trên vai trò và phạm vi trường lấy từ MySQL.

| API | Hành vi |
| --- | --- |
| `POST /api/auth/register` | Nhận JSON gồm `full_name`, `email`, `password`. Trả `201` với hồ sơ Teacher, chưa đăng nhập. Bỏ qua `role` và `school_id` trong JSON. Email đã tồn tại trả `409`, dữ liệu không hợp lệ trả `400`. |
| `POST /api/auth/login` | Nhận JSON gồm `email`, `password`. Trả `200` với hồ sơ và cookie sau khi lưu session mới. Sai mật khẩu, email không tồn tại và tài khoản bị đình chỉ cùng trả `401`. |
| `GET /api/auth/me` | Đọc lại hồ sơ và trạng thái tài khoản từ MySQL. Trả `200` hoặc `401`. Nếu tài khoản bị đình chỉ hoặc bị xóa, session đang dùng bị hủy khi được kiểm tra. |
| `POST /api/auth/logout` | Hủy session trên MySQL và xóa cookie. Trả `204` kể cả khi session đã hết hạn. |

Hồ sơ trả về gồm `id`, `full_name`, `email`, `role`, `status`, `school_id`. API biểu diễn ID bằng chuỗi để giữ đủ độ chính xác của `BIGINT UNSIGNED`. Email được bỏ khoảng trắng hai đầu và chuyển toàn bộ sang chữ thường. Đăng ký chấp nhận địa chỉ ASCII dạng dot-atom với tên miền DNS, giữ nguyên dấu chấm và phần `+`. Mật khẩu đăng ký có ít nhất 12 ký tự Unicode và tối đa 1024 byte UTF-8, giữ nguyên nội dung người dùng nhập. Argon2id chạy bất đồng bộ với 19 MiB bộ nhớ, 2 lượt và 1 luồng. Thư viện tạo salt cho từng mật khẩu. Hash mẫu trong seed không dùng để đăng nhập.

### Cấu hình và migration

Trong `backend/`, thêm các biến Phase 2.2 từ `.env.example` vào `.env` đang dùng. Sinh secret mới bằng lệnh bên dưới và dán vào `SESSION_SECRET` bằng trình soạn thảo cục bộ.

```powershell
node -p "require('node:crypto').randomBytes(32).toString('base64url')"
notepad .env
```

- `SESSION_SECRET` là 32 byte ngẫu nhiên mã hóa base64url. Dùng cùng giá trị trên các instance phục vụ cùng ứng dụng. Thay secret sẽ làm cookie hiện có mất hiệu lực.
- `SESSION_COOKIE_NAME` mặc định `learning_bridge.sid`. `SESSION_MAX_AGE_MS` mặc định 30 phút không hoạt động, chấp nhận từ 1 phút đến 8 giờ. Request có session hợp lệ gia hạn thời gian này.
- `AUTH_ORIGINS` là danh sách origin chính xác, phân cách bằng dấu phẩy. Cấu hình cả origin của ứng dụng khi cùng origin và origin cụ thể của frontend khi chạy riêng. Giá trị production phải dùng HTTPS. `CORS_ORIGINS` dùng cho API ngoài các router session như health và không bật credentials.
- `TRUST_PROXY=off` mặc định. Chỉ đặt `TRUST_PROXY=loopback` khi reverse proxy HTTPS kết nối từ loopback, ghi đè `X-Forwarded-Proto` và `X-Forwarded-For`, và cổng Node chỉ cho proxy truy cập. Production từ chối auth qua HTTP.

Chạy migration thủ công một lần bằng tài khoản triển khai MySQL có quyền DDL. Ví dụ dưới đây chạy từ thư mục gốc repo, thay tên schema và tài khoản theo môi trường.

```powershell
mysql --protocol=TCP --host=127.0.0.1 --user=dev_user --password --database=learning_bridge_dev --execute="source backend/migrations/001_auth_sessions.sql"
```

Bảng hạ tầng `auth_sessions` gồm ID session, thời điểm hết hạn và dữ liệu JSON. Migration giữ nguyên sáu bảng nghiệp vụ. Pool dùng chung cho tài khoản, trường và session. Tài khoản ứng dụng cần `SELECT, INSERT` trên `users`, `SELECT` trên `schools` khi dùng middleware phạm vi trường, và `SELECT, INSERT, UPDATE, DELETE` trên `auth_sessions`. Dùng tài khoản riêng cho migration. Bản ghi hết hạn bị từ chối ngay cả khi chưa được tác vụ dọn định kỳ xóa.

### Cookie, CSRF và giới hạn request

`express-session` tạo và ký session ID, đổi ID sau mỗi lần đăng nhập thành công. Adapter MySQL dùng SQL tham số hóa và chỉ lưu ID người dùng cùng metadata cookie. Cookie dùng `HttpOnly`, `SameSite=Lax`, đường dẫn `/api` và `Secure` trong production. Các POST auth yêu cầu header `Origin` thuộc `AUTH_ORIGINS`, kể cả khi gọi từ Postman hoặc PowerShell. Trình duyệt gửi Origin tự động. Cấu hình frontend riêng origin nhưng cùng site, chẳng hạn cùng host `127.0.0.1` trên hai cổng, và dùng `credentials: 'include'`. Cơ chế kiểm tra Origin bảo vệ POST khi chạy cùng site. Giữ các origin được tin cậy dưới quyền kiểm soát của ứng dụng.

Login cho phép 10 request/IP và đăng ký cho phép 5 request/IP mỗi 15 phút. Bộ đếm hiện ở bộ nhớ của một tiến trình. Khi chạy nhiều instance, dùng bộ đếm chia sẻ hoặc giới hạn tại reverse proxy. Session vẫn lưu trong MySQL. Tránh bật log debug của thư viện session ở production.

### Middleware tái sử dụng

- `requireAuth` đọc session, nạp lại người dùng đang hoạt động và gắn hồ sơ đã lọc vào `req.user`.
- `requireRole(...roles)` kiểm tra vai trò đọc từ MySQL sau `requireAuth`. Quyền School Admin và Government được chỉ định riêng.
- `requireSchoolScope({ getTargetSchoolId, findSchoolById })` lấy phạm vi đích từ bản ghi phía server, đối chiếu trường của School Admin và yêu cầu trường đang hoạt động. Phase 2.5 cần kiểm tra lại trạng thái trong transaction ghi quyết định duyệt.
- Các route thay đổi trạng thái dùng cookie ở giai đoạn sau cần gắn lại `requireTrustedOrigin`. Teacher có thể đăng ký và đăng nhập độc lập với trường. So khớp pattern mã giáo viên chỉ kiểm tra định dạng. Student truy cập tài nguyên công khai không cần tài khoản.

### Thử API và chạy kiểm thử

Khởi chạy `npm.cmd run dev` trong `backend/`. Trong PowerShell khác, chạy ví dụ sau với origin được cho phép và địa chỉ email thử nghiệm chưa tồn tại.

```powershell
$base = 'http://127.0.0.1:3000/api/auth'
$headers = @{ Origin = 'http://127.0.0.1:3000' }
$secret = Read-Host 'Mật khẩu tài khoản thử nghiệm' -AsSecureString
$body = @{
  full_name = 'Nguyen Van A'
  email = 'teacher@example.test'
  password = [Net.NetworkCredential]::new('', $secret).Password
} | ConvertTo-Json -Compress
try {
  Invoke-RestMethod "$base/register" -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body
  Invoke-RestMethod "$base/login" -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body -SessionVariable learningBridgeSession
  Invoke-RestMethod "$base/me" -WebSession $learningBridgeSession
  Invoke-RestMethod "$base/logout" -Method Post -Headers $headers -WebSession $learningBridgeSession
} finally {
  Remove-Variable body,secret -ErrorAction SilentlyContinue
}
```

`npm.cmd test` chạy HTTP với repository và session store giả lập, đồng thời dùng Argon2id thật. `npm.cmd run test:db` kiểm tra kết nối MySQL thật. Để chạy thêm kiểm thử ghi dữ liệu auth, chỉ dùng schema riêng `learning_bridge_auth_test` trên `127.0.0.1` với business schema và migration đã nạp. Tài khoản của bộ test còn cần `UPDATE` trên `users` để thử trạng thái suspended. Bộ test tạo dữ liệu ngẫu nhiên và để lại hàng trong schema test.

```powershell
$env:RUN_MYSQL_AUTH_TEST = '1'
npm.cmd run test:db
Remove-Item Env:RUN_MYSQL_AUTH_TEST
```

### Tạo tài khoản Government đầu tiên

Thực hiện trên máy phát triển bởi người quản trị được ủy quyền. Kiểm tra `.env` đang trỏ tới schema mong muốn. CLI dùng pool đã cấu hình và cần quyền `INSERT` trên `users`. Script băm mật khẩu trước khi ghi, và từ chối khi email đã được dùng. Mật khẩu nhập bằng prompt ẩn và chuyển qua stdin, tránh tham số dòng lệnh.

```powershell
$governmentPassword = Read-Host 'Mật khẩu Government mới' -AsSecureString
$previousEncoding = $OutputEncoding
try {
  $OutputEncoding = [Text.UTF8Encoding]::new($false)
  [Net.NetworkCredential]::new('', $governmentPassword).Password |
    node scripts/bootstrap-government.js 'government@example.test' 'Government Admin'
} finally {
  $OutputEncoding = $previousEncoding
  Remove-Variable governmentPassword,previousEncoding -ErrorAction SilentlyContinue
}
```

Backend chưa có xác minh email, đặt lại mật khẩu hoặc MFA. Government có thể cấp School Admin qua API Phase 2.3.

## Phase 2.3 — Government Management

Government dùng session đang có để tạo trường, tìm kiếm có phân trang, đổi tên, cập nhật trạng thái và cấu hình Teacher ID Pattern. Government cũng cấp, xem và đổi trạng thái School Administrator. Các thao tác thay đổi yêu cầu `Origin` thuộc `AUTH_ORIGINS`. API trả ID dạng chuỗi và dùng schema hiện tại.

Ngoài quyền Phase 2.2, tài khoản ứng dụng cần `INSERT` và `UPDATE (school_name, teacher_id_pattern, status)` trên `schools`, cùng `UPDATE (status)` trên `users`. Quyền `SELECT` trên `schools` và `users` được dùng để đọc chi tiết và kiểm tra phạm vi. Sáu bảng nghiệp vụ và migration session hiện có vẫn dùng nguyên trạng. [Government API và ví dụ PowerShell](docs/GOVERNMENT_API.md)

## Phase 2.4 — Teacher Management

Teacher dùng session hiện có để khai báo nhiều trường, tạo Resource độc lập hoặc theo trường, sửa Draft Version, upload PDF riêng tư, gửi duyệt và đọc Review History. Server giữ bản đã xuất bản khi có nội dung mới. Cấu hình `TEACHER_PDF_MAX_BYTES` theo `.env.example`. Sao lưu riêng thư mục `backend/private-uploads/` và giữ ngoài mọi static root.

Phase này giữ nguyên sáu bảng nghiệp vụ và migration session. Ngoài quyền Phase 2.3, tài khoản ứng dụng cần `SELECT, INSERT` trên `teacher_schools`, `resources`, `resource_versions` và `resource_reviews`. Cấp `UPDATE (teacher_code, status, pattern_checked_at)` trên `teacher_schools` và quyền cập nhật các cột metadata, `file_path`, `edit_state` trên `resource_versions`. MySQL cần thêm một quyền UPDATE cho locking read `FOR UPDATE` trên `resources`, ví dụ `UPDATE (created_at)`. Phase này không cần quyền ghi quyết định review hay cột xuất bản. [Teacher API và hướng dẫn kiểm thử](docs/TEACHER_API.md)
