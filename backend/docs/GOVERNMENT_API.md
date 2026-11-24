# Government Management APIs — Phase 2.3

Government quản lý hồ sơ trường đã qua quy trình hành chính ngoại tuyến và cấp tài khoản School Administrator. Router dưới `/api/government` dùng chung session cookie, `requireAuth` và `requireRole('government')`. Controller xử lý HTTP, service kiểm tra đầu vào và quy tắc nghiệp vụ, repository truy vấn MySQL bằng tham số. Government thực hiện quản lý trường trong phase này. Quyền duyệt tài nguyên độc lập sẽ được xử lý ở phase sau.

## Endpoints

| Phương thức và đường dẫn dưới `/api/government` | Body hoặc query | Kết quả |
| --- | --- | --- |
| `GET /schools` | `search`, `status`, `page`, `limit` | `200`, danh sách trường có phân trang |
| `GET /schools/:id` | — | `200`, chi tiết trường có `teacher_id_pattern` và `created_at` |
| `POST /schools` | `school_code`, `school_name`, `teacher_id_pattern`, `status` tùy chọn | `201`, trường mới, mặc định `active` |
| `PATCH /schools/:id` | `school_name` | `200`, trường sau cập nhật |
| `PATCH /schools/:id/status` | `status` | `200`, trường sau cập nhật |
| `PATCH /schools/:id/teacher-id-pattern` | `teacher_id_pattern` | `200`, trường sau cập nhật |
| `GET /schools/:id/admins` | `page`, `limit` | `200`, danh sách admin của trường có phân trang |
| `POST /schools/:id/admins` | `full_name`, `email`, `password` | `201`, hồ sơ School Administrator mới |
| `PATCH /admins/:id/status` | `status` | `200`, hồ sơ School Administrator sau cập nhật |

ID là chuỗi số nguyên dương tương thích `BIGINT UNSIGNED`. Phân trang bắt đầu tại 1, mặc định 20 dòng, tối đa 100 dòng mỗi trang. `page` tối đa 1.000.000. Danh sách sắp xếp theo `id` tăng dần. `search` tìm chuỗi con theo mã hoặc tên trường. Ký tự `%` và `_` được tìm như văn bản. Mã trường từ 1 đến 30 ký tự, bắt đầu bằng chữ ASCII hoặc chữ số. Các ký tự sau có thể gồm thêm `_` và `-`. Mã giữ nguyên sau khi tạo và MySQL kiểm tra trùng theo collation hiện tại, không phân biệt hoa thường.

Ví dụ phản hồi từ `GET /schools?search=SCH001&status=active&limit=20`:

```json
{
  "data": [{ "id": "1", "school_code": "SCH001", "school_name": "Trường A", "status": "active" }],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

Các phản hồi admin có `id`, `full_name`, `email`, `role`, `school_id`, `status` và `created_at`. Body chứa trường ngoài danh sách được phép trả `400`. Ví dụ lỗi khi tạo trường trùng mã:

```json
{ "error": { "code": "SCHOOL_CODE_IN_USE", "message": "School code already registered" } }
```

Các mã HTTP thường gặp gồm `400` đầu vào sai, `401` thiếu session có tài khoản active, `403` thiếu quyền hoặc Origin không hợp lệ, `404` trường hoặc School Admin không tồn tại, `409` trùng mã/email hoặc cấp tài khoản cho trường suspended, `429` vượt giới hạn cấp tài khoản và `500` lỗi bất ngờ với thông báo đã lọc.

## Trạng thái và phạm vi trường

Government có thể chuyển giữa `active` và `suspended`. Gửi lại trạng thái hiện tại trả cùng kết quả. Đình chỉ trường chỉ cập nhật `schools.status`. Tài khoản admin của trường, liên kết Teacher–School, tài nguyên, lịch sử review và con trỏ phiên bản đã xuất bản được giữ nguyên. Admin có thể vẫn đăng nhập nếu tài khoản active. `requireSchoolScope` đọc trạng thái trường hiện tại để chặn thao tác cần trường active, kể cả với session đang tồn tại. Luồng duyệt ở phase sau cần kiểm tra lại dưới khóa trong transaction ghi quyết định.

Quan hệ `users.school_id → schools.id` cho phép một trường có nhiều School Administrator. Mỗi admin thuộc đúng một trường trong MVP. `teacher_schools` cho phép một Teacher khai báo nhiều trường. API cấp admin khóa dòng trường khi kiểm tra trạng thái và ghi tài khoản, để thao tác này được tuần tự hóa với cập nhật trạng thái trường. Khi tài khoản School Admin bị đình chỉ, middleware Phase 2.2 từ chối session của tài khoản trong lần kiểm tra tiếp theo.

## Teacher ID Pattern

Pattern dài tối đa 255 ký tự và bắt buộc có `^` ở đầu, `$` ở cuối. Bên trong hỗ trợ ký tự `A–Z`, `a–z`, `0–9`, `_`, `-` và các nhóm cố định `[A-Z]`, `[a-z]`, `[0-9]`, `[A-Za-z]`, `[A-Z0-9]`, `[a-z0-9]`, `[A-Za-z0-9]`. Mỗi ký tự hoặc nhóm có thể kèm `{n}` để lặp đúng `n` lần. Tổng độ dài mã là 1–100 ký tự. So khớp JavaScript phân biệt hoa thường và kiểm tra toàn bộ chuỗi. Pattern được kiểm tra với mã mẫu hợp lệ và mẫu sai trước khi lưu. Nhóm mở ngoặc, nhánh, escape, wildcard và lặp biến độ dài bị từ chối để tránh backtracking phức tạp.

Ví dụ `^GV[0-9]{5}$` chấp nhận `GV01001`. `^[A-Z]{2}[0-9]{4}$` chấp nhận `AB0090`. Hệ thống chỉ kiểm tra hình thức chuỗi. Bất kỳ ai biết định dạng đều có thể tạo chuỗi khớp, nên kết quả không chứng minh danh tính hay việc người đó thuộc trường. Đổi pattern không xóa các liên kết cũ hoặc gắn nhãn xác minh. Luồng Teacher ở phase sau phải dùng pattern hiện tại khi khai báo hoặc gửi tài nguyên. Mã không khớp sẽ chặn lần gửi mới và giữ lịch sử review.

## Cấp tài khoản và thử bằng PowerShell

Đăng nhập bằng tài khoản Government active theo hướng dẫn backend. Các lệnh sau dùng origin đã khai báo trong `AUTH_ORIGINS`. Giá trị mật khẩu đi qua JSON chạy cục bộ, và production yêu cầu HTTPS. [Hướng dẫn Backend](../README.md)

```powershell
$base = 'http://127.0.0.1:3000/api'
$headers = @{ Origin = 'http://127.0.0.1:3000' }
$govPassword = Read-Host 'Mật khẩu Government' -AsSecureString
try {
  $login = @{ email = 'government@example.test'; password = [Net.NetworkCredential]::new('', $govPassword).Password } | ConvertTo-Json -Compress
  Invoke-RestMethod "$base/auth/login" -Method Post -Headers $headers -ContentType 'application/json' -Body $login -SessionVariable govSession
} finally {
  Remove-Variable login,govPassword -ErrorAction SilentlyContinue
}
$school = Invoke-RestMethod "$base/government/schools" -Method Post -WebSession $govSession -Headers $headers -ContentType 'application/json' -Body '{"school_code":"SCH001","school_name":"School A","teacher_id_pattern":"^GV[0-9]{5}$","status":"active"}'
Invoke-RestMethod "$base/government/schools/$($school.id)" -WebSession $govSession
$adminPassword = Read-Host 'Mật khẩu ban đầu riêng cho admin' -AsSecureString
try {
  $body = @{ full_name = 'School Admin A'; email = 'admin-a@example.test'; password = [Net.NetworkCredential]::new('', $adminPassword).Password } | ConvertTo-Json -Compress
  Invoke-RestMethod "$base/government/schools/$($school.id)/admins" -Method Post -WebSession $govSession -Headers $headers -ContentType 'application/json' -Body $body
} finally {
  Remove-Variable body,adminPassword -ErrorAction SilentlyContinue
}
```

Chọn mật khẩu ban đầu mạnh và riêng cho mỗi tài khoản. Chuyển mật khẩu qua kênh bảo mật ngoài hệ thống. API yêu cầu ít nhất 12 ký tự và áp dụng quy tắc Argon2id cùng chuẩn hóa email như Phase 2.2. Role và trường lấy từ route và bản ghi của server. Mật khẩu và hash không có trong phản hồi cấp tài khoản. Phase này chưa có email mời, đổi mật khẩu hoặc bắt buộc đổi mật khẩu sau đăng nhập lần đầu.

Các POST/PATCH yêu cầu `Origin` chính xác. Frontend Government có thể tích hợp sau bằng `fetch` với `credentials: 'include'` qua HTTPS, trên cùng site và origin được cấu hình trong `AUTH_ORIGINS`. Bộ đếm cấp admin giới hạn 10 request/IP mỗi 15 phút và hiện nằm trong từng tiến trình. Hạ tầng nhiều instance cần giới hạn chia sẻ hoặc giới hạn ở gateway.

## Kiểm thử

Chạy `npm.cmd test` trong `backend/` để chạy kiểm thử pattern, HTTP với dữ liệu giả lập và bộ hồi quy Auth. Để chạy MySQL thật, dùng schema cô lập trên `127.0.0.1` tên `learning_bridge_government_test` hoặc `learning_bridge_auth_test`. Nạp `database/schema.sql`, `database/seed.sql` và migration `backend/migrations/001_auth_sessions.sql` vào schema riêng. Ngoài quyền ứng dụng đã nêu trong README, cấp tài khoản test quyền `SELECT` trên `teacher_schools`, `resources`, `resource_versions` và `resource_reviews` để kiểm tra lịch sử. Test ghi dữ liệu mẫu vào schema riêng.

```powershell
$env:RUN_MYSQL_GOVERNMENT_TEST = '1'
npm.cmd run test:db
Remove-Item Env:RUN_MYSQL_GOVERNMENT_TEST
```

Phase 2.4 tiếp tục với Teacher–School associations, tài nguyên, phiên bản nháp và gửi duyệt.
