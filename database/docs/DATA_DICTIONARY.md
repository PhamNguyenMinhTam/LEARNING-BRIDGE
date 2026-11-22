# Từ điển dữ liệu MySQL v1.0

Mọi bảng dùng InnoDB và `utf8mb4`. Collation mặc định là `utf8mb4_0900_ai_ci`. Email và giá trị `rights_basis` dùng `utf8mb4_0900_bin`. Mã trường dùng `utf8mb4_0900_as_ci`. Backend chuẩn hóa email bằng cách bỏ whitespace ở hai đầu và chuyển chữ thường toàn bộ địa chỉ trước khi ghi hoặc tra cứu. Nội bộ địa chỉ không được có whitespace. Chính sách này coi local part khác nhau chỉ ở hoa/thường là cùng tài khoản và giữ nguyên các dấu hoặc ký tự hợp lệ khác. `DATETIME` được ứng dụng diễn giải theo UTC.

`—` trong cột default nghĩa là DDL không khai báo DEFAULT. F1 là FK ghép `resources(id, published_version_id) → resource_versions(resource_id, id)`. U1, U2 và U3 lần lượt là các UNIQUE ghép `(teacher_id, school_id)`, `(resource_id, version_number)` và `(resource_id, id)`.

## `schools`

Hồ sơ trường do Government quản lý. Teacher dùng pattern của trường khi khai báo/gửi bài. School dùng trạng thái trong kiểm duyệt.

| Cột | Kiểu | Nullable | Khóa hoặc ràng buộc đặc thù | Default | Quy tắc |
|---|---|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | Không | PK | AUTO_INCREMENT | Định danh nội bộ. |
| `school_code` | `VARCHAR(30)` | Không | UNIQUE | — | Mã không có khoảng trắng. So sánh không phân biệt hoa/thường, phân biệt dấu. |
| `school_name` | `VARCHAR(200)` | Không | — | — | Tên có nội dung. |
| `teacher_id_pattern` | `VARCHAR(255)` | Không | — | — | Pattern có nội dung. Backend chịu trách nhiệm kiểm tra cú pháp và đối chiếu. |
| `status` | `ENUM(active, suspended)` | Không | — | active | Đình chỉ chặn review mới tại Backend. |
| `created_at` | `DATETIME` | Không | — | CURRENT_TIMESTAMP | Thời điểm tạo. |

## `users`

Tài khoản Teacher, School Admin và Government. Student truy cập công khai.

| Cột | Kiểu | Nullable | Khóa hoặc ràng buộc đặc thù | Default | Quy tắc |
|---|---|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | Không | PK | AUTO_INCREMENT | Định danh nội bộ. |
| `full_name` | `VARCHAR(150)` | Không | — | — | Tên có nội dung. |
| `email` | `VARCHAR(255)` | Không | UNIQUE | — | Email canonical, chữ thường, không chứa whitespace. Backend chuẩn hóa và kiểm tra cú pháp. |
| `password_hash` | `VARCHAR(255)` | Không | — | — | Backend ghi hash. DB kiểm tra có nội dung. |
| `role` | `ENUM(teacher, school_admin, government)` | Không | — | — | Vai trò dùng trong phân quyền. |
| `school_id` | `BIGINT UNSIGNED` | Có | FK → schools.id | NULL | Bắt buộc cho school_admin. Các vai trò còn lại phải để NULL. |
| `status` | `ENUM(active, suspended)` | Không | — | active | Backend kiểm tra trước khi cho phép tác vụ. |
| `created_at` | `DATETIME` | Không | — | CURRENT_TIMESTAMP | Thời điểm tạo. |

## `teacher_schools`

Liên kết tự khai báo của Teacher. School và Government dùng thông tin liên quan theo phạm vi được cấp quyền.

| Cột | Kiểu | Nullable | Khóa hoặc ràng buộc đặc thù | Default | Quy tắc |
|---|---|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | Không | PK | AUTO_INCREMENT | Định danh nội bộ. |
| `teacher_id` | `BIGINT UNSIGNED` | Không | FK → users.id, U1 (1/2) | — | Backend yêu cầu role teacher. |
| `school_id` | `BIGINT UNSIGNED` | Không | FK → schools.id, U1 (2/2) | — | Trường được Teacher khai báo. |
| `teacher_code` | `VARCHAR(100)` | Không | — | — | Mã có nội dung, giữ số 0 đầu. Backend đối chiếu pattern hiện hành. |
| `pattern_checked_at` | `DATETIME` | Có | — | NULL | Thời điểm đối chiếu pattern thành công, có thể chưa được ghi. |
| `status` | `ENUM(active, inactive)` | Không | — | active | Chỉ association active đủ điều kiện gửi theo trường. |
| `created_at` | `DATETIME` | Không | — | CURRENT_TIMESTAMP | Thời điểm tạo. |

## `resources`

Resource logic của Teacher, phạm vi School/Government và trạng thái hiển thị cho Student.

| Cột | Kiểu | Nullable | Khóa hoặc ràng buộc đặc thù | Default | Quy tắc |
|---|---|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | Không | PK, F1 (1/2) | AUTO_INCREMENT | Định danh và thành phần đầu FK xuất bản. |
| `owner_id` | `BIGINT UNSIGNED` | Không | FK → users.id | — | Backend kiểm tra role Teacher và quyền sở hữu. |
| `review_scope` | `ENUM(school, government)` | Không | — | — | Backend giữ cố định scope kể từ lượt gửi đầu. |
| `review_school_id` | `BIGINT UNSIGNED` | Có | FK → schools.id | NULL | Có giá trị với school, NULL với government. |
| `published_version_id` | `BIGINT UNSIGNED` | Có | F1 (2/2) | NULL | Version xuất bản hiện tại của cùng resource. |
| `publication_status` | `ENUM(hidden, published)` | Không | — | hidden | hidden yêu cầu con trỏ NULL. published yêu cầu có con trỏ. |
| `created_at` | `DATETIME` | Không | — | CURRENT_TIMESTAMP | Thời điểm tạo. |

## `resource_versions`

Snapshot nội dung do Teacher tạo, được School/Government review. Student đọc metadata và nội dung đủ điều kiện của version đang xuất bản.

| Cột | Kiểu | Nullable | Khóa hoặc ràng buộc đặc thù | Default | Quy tắc |
|---|---|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | Không | PK, U3 (2/2) | AUTO_INCREMENT | Định danh version. |
| `resource_id` | `BIGINT UNSIGNED` | Không | FK → resources.id, U2 (1/2), U3 (1/2) | — | Resource cha. |
| `version_number` | `INT UNSIGNED` | Không | U2 (2/2) | — | Số version dương, duy nhất trong cùng resource. |
| `title` | `VARCHAR(255)` | Không | — | — | Tiêu đề version. |
| `description` | `TEXT` | Không | — | — | Mô tả version. |
| `author_name` | `VARCHAR(200)` | Không | — | — | Tên tác giả để ghi nhận nguồn. |
| `category` | `VARCHAR(100)` | Không | — | — | Môn hoặc danh mục. |
| `education_level` | `VARCHAR(100)` | Không | — | — | Cấp hoặc khối học. |
| `resource_type` | `ENUM(pdf, external_link, authored_document)` | Không | — | — | Loại nội dung quyết định trường tệp/URL bắt buộc. |
| `file_path` | `VARCHAR(500)` | Có | — | NULL | Định danh tệp private. Bắt buộc với pdf, có thể dùng với authored_document. |
| `source_url` | `VARCHAR(2048)` | Có | — | NULL | Bắt buộc với external_link. Backend kiểm tra URL và scheme. |
| `rights_basis` | `VARCHAR(100)` | Không | CHECK danh mục | unknown | own_work, open_license, authorized_distribution, official_link hoặc unknown. |
| `access_level` | `ENUM(public, restricted)` | Không | — | restricted | public yêu cầu rights_basis khác unknown. Backend xác minh quyền phân phối. |
| `edit_state` | `ENUM(draft, submitted)` | Không | — | draft | Backend chỉ cho phép sửa trực tiếp draft. |
| `created_at` | `DATETIME` | Không | — | CURRENT_TIMESTAMP | Thời điểm tạo. |

## `resource_reviews`

Lượt gửi và kết quả của School hoặc Government. Teacher xem kết quả của mình. Truy vấn Student dùng decision để lọc version công khai.

| Cột | Kiểu | Nullable | Khóa hoặc ràng buộc đặc thù | Default | Quy tắc |
|---|---|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | Không | PK | AUTO_INCREMENT | Định danh nội bộ. |
| `version_id` | `BIGINT UNSIGNED` | Không | FK → resource_versions.id, UNIQUE | — | Tối đa một review cho một version. |
| `reviewer_id` | `BIGINT UNSIGNED` | Có | FK → users.id | NULL | NULL nếu pending. Bắt buộc với quyết định cuối. |
| `decision` | `ENUM(pending, approved, rejected)` | Không | — | pending | Backend chỉ chuyển từ pending sang một quyết định cuối. |
| `review_note` | `TEXT` | Có | — | NULL | Bắt buộc có ký tự ngoài whitespace khi rejected. |
| `submitted_at` | `DATETIME` | Không | — | CURRENT_TIMESTAMP | Thời điểm gửi. |
| `reviewed_at` | `DATETIME` | Có | — | NULL | NULL nếu pending. Quyết định cuối yêu cầu giá trị từ thời điểm gửi trở đi. |
