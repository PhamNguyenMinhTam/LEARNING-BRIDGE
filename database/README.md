# Learning Bridge Database v1.0

Schema gồm sáu bảng MySQL 8.4 LTS, dùng InnoDB và UTF-8 (`utf8mb4`). Chạy các script trên một schema phát triển riêng, ví dụ `learning_bridge_dev`. Nếu máy chưa có MySQL Server, cài bản MySQL Community Server 8.4 LTS và khởi động server cục bộ trước. Dùng MySQL CLI đi kèm hoặc cài MySQL Workbench nếu muốn thao tác bằng giao diện. [Tài liệu cài đặt MySQL](https://dev.mysql.com/doc/refman/8.4/en/installing.html)

Tài khoản chạy script cần quyền tạo đối tượng và đọc/ghi trong schema phát triển, gồm quyền tạo, chạy và xóa procedure kiểm thử. Tài khoản ứng dụng tương lai nên dùng quyền tối thiểu riêng. Dùng strict SQL mode và giữ `foreign_key_checks = 1`, `check_constraint_checks = 1`. Dùng UTF-8 cho tệp và kết nối. Backend nên đặt session time zone về UTC và truyền/đọc các giá trị `DATETIME` theo UTC.

## MySQL CLI

Từ thư mục gốc repo, mở MySQL client. Thay `dev_user` bằng tài khoản MySQL cục bộ của bạn.

```sh
mysql --host=127.0.0.1 --user=dev_user --password --default-character-set=utf8mb4
```

Trong MySQL client, chạy lần lượt. `schema.sql` và `seed.sql` dành cho lần khởi tạo schema trống. Hai script test có thể chạy lại trên cùng schema đã seed.

```sql
CREATE DATABASE learning_bridge_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE learning_bridge_dev;
SELECT VERSION(), @@SESSION.sql_mode, @@SESSION.foreign_key_checks, @@SESSION.check_constraint_checks;

SOURCE database/schema.sql
SOURCE database/seed.sql
SOURCE database/tests/validation.sql
SOURCE database/tests/negative_tests.sql
```

Để tự động hóa với mã thoát, chạy từng script dưới dạng lệnh batch riêng và dừng khi có lỗi, ví dụ `mysql --host=127.0.0.1 --user=dev_user --password --default-character-set=utf8mb4 --database=learning_bridge_dev --execute="source database/tests/negative_tests.sql"`. Chạy từng bước theo thứ tự trên và kiểm tra kết quả trước khi tiếp tục. Test positive báo một dòng `PASS` cho vòng đời. Test negative báo 25 dòng `PASS` sau khi xác nhận mã lỗi dự kiến của từng tình huống. Các test rollback DML và xóa procedure tạm sau khi chạy thành công. Giá trị `AUTO_INCREMENT` có thể tăng sau rollback.

## MySQL Workbench

1. Tạo kết nối đến MySQL Server cục bộ bằng tài khoản phát triển. Mở SQL Editor và chạy `CREATE DATABASE` như trên.
2. Làm mới bảng **Schemas** và nhấp đúp `learning_bridge_dev` để chọn schema. Kiểm tra bằng `SELECT DATABASE();` trong session chạy script.
3. Dùng **File → Open SQL Script** để mở và chạy toàn bộ từng tệp theo thứ tự `schema.sql`, `seed.sql`, `tests/validation.sql`, `tests/negative_tests.sql`. Bật dừng khi gặp lỗi và dùng chế độ chạy cả script để Workbench xử lý `DELIMITER` trong hai tệp test.
4. Xem **Action Output** và các result grid để xác nhận mọi dòng `PASS`. [MySQL Workbench SQL Editor](https://dev.mysql.com/doc/workbench/en/wb-sql-editor.html)

## Kiểm tra và reset

```sql
SHOW TABLES;
SHOW CREATE TABLE resources;
SHOW CREATE TABLE resource_versions;
SHOW INDEX FROM resource_reviews;
SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION;
```

Sau seed, kết quả mong đợi là 2 trường, 6 tài khoản, 3 liên kết Teacher–School, 4 resource, 6 version và 4 review. Các email dùng miền `example.invalid` và `password_hash` chỉ chứa placeholder không dùng để đăng nhập. Đường dẫn tài liệu và URL seed là dữ liệu minh họa.

Để reset, ưu tiên khởi tạo schema phát triển mới. Nếu muốn dùng lại tên cũ, xác nhận kết nối đang trỏ đến máy cục bộ, sao lưu dữ liệu cần giữ rồi thực hiện lệnh dưới đây **chỉ khi chắc chắn schema này có thể xóa toàn bộ**. Chạy lại quy trình khởi tạo sau khi xóa.

```sql
DROP DATABASE learning_bridge_dev;
```

## Phạm vi MVP

Schema bảo đảm khóa, liên kết và các điều kiện nội bộ từng dòng. Quyền theo vai trò, kiểm tra pattern hiện hành, tính bất biến của dữ liệu đã gửi, bảo vệ tệp và tính hợp lệ của quyền phân phối được xử lý tại Backend. Các workflow ghi cần dùng transaction như trong thiết kế. Bước tiếp theo là xây lớp truy cập dữ liệu theo quy tắc khóa, cấu hình tài khoản DB quyền tối thiểu và viết integration test phân quyền, đồng thời và quyền truy cập tệp.

- [Thiết kế, ERD và quy trình transaction](docs/DATABASE_DESIGN.md)
- [Từ điển dữ liệu](docs/DATA_DICTIONARY.md)
- [Quy tắc nghiệp vụ và ca kiểm thử Backend](docs/BUSINESS_RULES.md)
