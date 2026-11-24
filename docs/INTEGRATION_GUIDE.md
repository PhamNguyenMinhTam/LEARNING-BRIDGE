# Learning Bridge — Hướng dẫn tích hợp Phase 2.7

Express phục vụ HTML, CSS, JavaScript và API cùng origin. Frontend giữ bốn thư mục `teacher/`, `school/`, `gorvernment/`, `student/` và dùng Fetch API qua `frontend-shared/api.js`. MySQL lưu session và dữ liệu nghiệp vụ. Express chỉ mount các thư mục giao diện và script dùng chung. Kho PDF riêng và cấu hình Backend nằm ngoài static roots.

## Thiết lập cục bộ

Yêu cầu Node.js 24 LTS, npm và MySQL 8.4. Dùng PowerShell trên Windows. Từ repo, chuẩn bị database dev theo hướng dẫn database. Dùng DBA để nạp `database/schema.sql` và `backend/migrations/001_auth_sessions.sql` và `backend/migrations/002_resource_withdrawal.sql` vào schema trống. Seed SQL là tùy chọn cho demo. Tài khoản trong seed có hash placeholder. Tạo Government thật bằng bootstrap CLI với mật khẩu cục bộ riêng. Tài khoản Backend cần quyền theo README. [MySQL và schema](../database/README.md) · [Backend](../backend/README.md)

```powershell
Set-Location backend
npm.cmd ci
Copy-Item .env.example .env
node -p "require('node:crypto').randomBytes(32).toString('base64url')"
notepad .env
npm.cmd run dev
```

Đặt `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` và `SESSION_SECRET`. Dán giá trị sinh ở trên vào `SESSION_SECRET` trong .env. Mở `http://127.0.0.1:3000/student/` cho khách, `/teacher/auth/register.html` cho Teacher mới, `/school/login.html` cho School Admin và `/gorvernment/auth/login.html` cho Government. Dùng đúng origin trong `AUTH_ORIGINS`. `localhost` và `127.0.0.1` là hai origin khác nhau. Backend sản xuất yêu cầu HTTPS và reverse proxy cấu hình theo README.

## Giao diện và API

| Giao diện | Thao tác | API và phản hồi |
| --- | --- | --- |
| Teacher đăng ký/đăng nhập, School và Government đăng nhập | Dùng email, kiểm tra session và chuyển theo role | `POST /api/auth/register` → 201, `POST /api/auth/login` → 200, `GET /api/auth/me` → hồ sơ. `POST /api/auth/logout` → 204. |
| Teacher Portal | Hồ sơ, trường có thể chọn, khai báo và đổi trạng thái liên kết | `GET /api/teacher/profile`, `GET /api/teacher/schools/available`, GET/POST `/api/teacher/schools`, PATCH `/api/teacher/schools/:id/status` |
| Teacher Portal | Resource độc lập hoặc theo trường, chỉnh nháp, Version và review notes | GET/POST `/api/teacher/resources`, GET `/api/teacher/resources/:id` và `/reviews`, POST `/api/teacher/resources/:id/versions`, PATCH `/api/teacher/versions/:id` |
| Teacher Portal | Tải PDF hoặc dùng URL HTTPS, gửi duyệt | POST `/api/teacher/versions/:id/upload` multipart, POST `/api/teacher/versions/:id/submit` → 201 Pending |
| School Dashboard | Xác định trường từ tài khoản, hàng chờ, lịch sử, chi tiết, PDF, duyệt/từ chối | GET `/api/school/profile`, GET `/api/school/reviews/pending`, `/history`, `/:id`, `/:id/preview`; POST `/:id/approve` hoặc `/:id/reject` |
| Government Dashboard | Tìm/tạo trường, sửa tên, trạng thái, Teacher ID Pattern, cấp và quản lý School Admin | GET/POST `/api/government/schools`, GET/PATCH `/api/government/schools/:id`, PATCH `/status` và `/teacher-id-pattern`; GET/POST `/admins` theo trường và PATCH `/api/government/admins/:id/status` |
| Government Dashboard | Duyệt tài liệu độc lập, đọc lịch sử và rút xuất bản | `/api/government/reviews` cùng contract School Review cho phạm vi Government; POST `/api/government/resources/:id/withdraw` với lý do |
| Student Library | Tìm không đăng nhập, lọc, sắp xếp, phân trang, xem chi tiết, PDF và URL bên thứ ba | GET `/api/public/filters`, GET `/api/public/resources`, `/:id`, `/:id/download`, `/:id/preview`, `/:id/external-link` |

Teacher ID là kiểm tra định dạng. Khi tạo PDF, chọn loại tài liệu biên soạn và khai báo quyền phân phối, tạo bản nháp rồi tải PDF lên. Published Version giữ nguyên trong lúc Version mới Pending hoặc Rejected. School Admin bị đình chỉ tài khoản sẽ mất quyền session. School bị đình chỉ vẫn có lịch sử nhưng hàng chờ và quyết định mới bị khóa. Government chỉ duyệt đóng góp độc lập. Student đọc phiên bản đang Published theo API.

## Session, quyền và lỗi

Fetch gửi cookie HttpOnly cùng origin trên các trang xác thực. Browser gửi `Origin` cho POST/PATCH, Backend đối chiếu `AUTH_ORIGINS`. FormData dùng boundary do browser tạo. Public JSON gọi Fetch với credentials omit. Route guard gọi `/api/auth/me` trước khi mở thao tác và chuyển về login khi hết phiên. Backend tiếp tục kiểm tra role, scope, owner và trạng thái hiện hành độc lập với UI.

Frontend hiển thị loading, kết quả trống và lỗi tiếng Việt. API 401 dẫn tới đăng nhập lại trên trang được bảo vệ, 403 báo quyền, 409 refresh hàng chờ và hiện xung đột, còn HTTP 5xx dùng thông báo chung. Thao tác ghi bị vô hiệu trong lúc chờ server. Dữ liệu tải từ API đưa vào DOM qua textContent hoặc tạo node. Link bên thứ ba phải là HTTPS và dùng `noopener noreferrer`.

## Kiểm thử

Chạy `npm.cmd test` trong backend. Bộ MySQL chạy với `npm.cmd run test:db` theo hướng dẫn từng phase. Playwright cần Chrome cài sẵn hoặc đặt `E2E_BROWSER_CHANNEL=msedge`. Nạp schema và hai migration vào schema loopback cô lập tên `learning_bridge_e2e_test` hoặc `learning_bridge_auth_test`. Dùng tài khoản test có quyền cho toàn bộ API và quyền ghi fixtures. Các test tạo tài khoản hư cấu và dữ liệu trong schema test. Chỉ định .env bằng biến môi trường trỏ về database test. Không chạy e2e với dữ liệu dùng chung hoặc production.

```powershell
$env:RUN_BROWSER_E2E = '1'
$env:E2E_UPLOAD_DIRECTORY = Join-Path $env:TEMP ('lb-e2e-uploads-' + [guid]::NewGuid())
npm.cmd run test:e2e
Remove-Item Env:RUN_BROWSER_E2E,Env:E2E_UPLOAD_DIRECTORY
```

Playwright khởi động Express riêng ở cổng 3107 mặc định, dùng `E2E_PORT` nếu cổng bận. Tệp thử nghiệm được ghi vào thư mục riêng trong Temp. Khi MySQL không chạy hoặc cấu hình nhầm, kiểm tra `GET /api/health/db` trong development, DSN và migration session. Khi trang báo Origin không hợp lệ, mở trang bằng đúng host, scheme, port và không mở file HTML qua `file://`.

## Giới hạn

Withdrawal giữ con trỏ cũ, lý do gần nhất và trạng thái trong DB từ Phase 3.2. Bản ghi legacy không rõ nguồn gốc tiếp tục giữ ẩn. PDF dùng kiểm tra cấu trúc cơ bản và kho riêng. Hiển thị inline phụ thuộc browser và CSP. Student chưa có tài khoản, Government chưa lưu nhật ký withdrawal bền vững và mật khẩu School Admin mới được chuyển qua kênh bảo mật ngoài ứng dụng.
