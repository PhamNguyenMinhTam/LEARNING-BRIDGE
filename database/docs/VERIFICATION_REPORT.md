# Báo cáo xác minh Learning Bridge Database v1.0

- **Ngày kiểm tra** 22/11/2026
- **Nhánh** `main`
- **Môi trường** MySQL Community Server 8.4.9 và MySQL CLI trên Windows. Instance kiểm thử dùng thư mục dữ liệu riêng, tắt TCP và kết nối cục bộ qua shared memory. Schema kiểm thử được tạo mới. Instance được dừng sau khi chạy.

**Kết luận** PASS cho schema, seed và kiểm thử SQL sau khi sửa hai lỗi. Kiểm thử tích hợp Backend và đối chiếu số hiệu với bản phê duyệt Business Rules còn NOT TESTED.

## Phạm vi và kết quả

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Blueprint sáu bảng | PASS | `schools`, `users`, `teacher_schools`, `resources`, `resource_versions`, `resource_reviews`. Đối chiếu cột, kiểu dữ liệu, NULL/default và quan hệ với đặc tả v1.0, ERD và Data Dictionary. Cả sáu bảng trên server dùng InnoDB và collation mặc định `utf8mb4_0900_ai_ci`. |
| Business Rules trong repo | PASS | Đã rà đủ 48 mục trong [Business Rules](BUSINESS_RULES.md) theo lớp chịu trách nhiệm (MySQL, Backend, transaction). |
| Số hiệu BR-01–BR-48 trong bản phê duyệt gốc | NOT TESTED | File trong repo ghi rõ đây là bảng ánh xạ tạm từ đặc tả. Cần bản gốc để xác nhận số hiệu và câu chữ. |
| PK, FK, UNIQUE, CHECK, index | PASS | Metadata của server ghi nhận 6 primary keys, 9 foreign keys, 6 UNIQUE ngoài PK, 12 CHECK đang thực thi và 20 index tính cả PK/UNIQUE. SQL tests kiểm tra lỗi trùng, dữ liệu không hợp lệ và tham chiếu sai. |
| Resource–Version | PASS | FK ghép `resources(id, published_version_id) → resource_versions(resource_id, id)` đúng thứ tự cột. SQL từ chối version của resource khác, version number bằng 0, số version trùng và tổ hợp trạng thái/con trỏ sai. |
| Index theo truy vấn | PASS | Kiểm tra thứ tự cột cho email, mã trường, association hai chiều, owner, school scope, publication status, version, reviewer và review queue. Hai index hỗ trợ FK ghép được giữ để bảo đảm đúng thứ tự cột. Hiệu năng với dữ liệu lớn chưa được benchmark. |
| Nạp seed vào schema trống | PASS | Fixture gồm 2 trường, 6 tài khoản, 3 association, 4 resource, 6 version và 4 review. Có review pending, approved, rejected và resource đang xuất bản version cũ trong khi version mới pending. |
| Nạp lại seed trên cùng schema | FAIL trước sửa → PASS | Lần chạy thứ hai từng trả lỗi 1062. Sau sửa, so sánh dump dữ liệu xác nhận cùng fixture giữ nguyên toàn bộ dòng. Nạp lại sau khi đổi một review và thêm trường vẫn giữ nguyên các thay đổi. |
| Seed trên schema có dữ liệu khác | PASS | Tạo schema phát triển thứ hai với một trường khác trùng ID. Seed trả lỗi 1644/SQLSTATE 45000 và dump dữ liệu trước/sau giống nhau. |
| Mã trường chứa xuống dòng ở cuối | FAIL trước sửa → PASS | MySQL từng chấp nhận mã có byte cuối `0A`. Sau sửa, mã rỗng và mã kết thúc bằng newline đều bị CHECK từ chối với lỗi 3819. |
| `tests/validation.sql` | PASS | Chạy hai lượt. Mỗi lượt đi hết vòng đời tạo hồ sơ, gửi, duyệt, từ chối, xuất bản và rút xuất bản mà vẫn giữ lịch sử. |
| `tests/negative_tests.sql` | PASS | 27/27 ca ở mỗi lượt, khớp mã lỗi dự kiến. Dump dữ liệu sau hai lượt giống trước khi chạy test. |
| Phân quyền School, eligibility xuất bản, concurrency tại Backend | NOT TESTED | Chưa có luồng Backend để chạy integration tests theo vai trò, thử hai request đồng thời hoặc xác nhận chính sách cấp quyền tải. |
| MySQL Workbench | NOT TESTED | Đã rà hướng dẫn sử dụng. Các script được chạy thực tế qua MySQL CLI. |

## Lỗi và cách khắc phục

1. **Seed chạy lại gặp khóa trùng.** Seed mới nạp trong transaction khi sáu bảng trống. Khi tìm thấy đầy đủ khóa nhận diện fixture, script kết thúc thành công với thông báo bỏ qua và giữ dữ liệu hiện có. Schema đã có dữ liệu nhưng thiếu khóa nhận diện bị từ chối. Chạy seed trong schema phát triển riêng và tuần tự. Muốn khôi phục giá trị mẫu ban đầu, tạo schema mới.
2. **Mã trường kết thúc bằng newline vượt qua regex có neo cuối chuỗi.** CHECK hiện yêu cầu độ dài dương và loại mọi ký tự thuộc lớp whitespace. Hai ca hồi quy đã được thêm vào negative tests. Nếu đã khởi tạo schema từ commit cũ và cần giữ dữ liệu, tìm và chỉnh các mã vi phạm trước khi áp dụng CHECK mới. Với schema test có thể bỏ, tạo lại từ `schema.sql`.

## Ranh giới thực thi

- **MySQL** bảo đảm PK, FK, UNIQUE, NOT NULL, quan hệ version với resource và các CHECK nội bộ dòng. Ví dụ, một version có tối đa một review, nhà trường bắt buộc có mặt với scope `school`, review cuối cần reviewer và thời gian, rejection cần lý do, và access `public` yêu cầu căn cứ quyền khác `unknown`.
- **Backend** xác thực vai trò, owner và phạm vi School, chặn review từ trường khác hoặc trường suspended, đối chiếu teacher ID với pattern hiện hành và giữ ý nghĩa của kết quả ở mức kiểm tra định dạng. Backend còn phải đánh giá quyền phân phối hiện hành và chỉ phục vụ đúng version đã duyệt, đang xuất bản, có access public và quyền truy cập hợp lệ. Trạng thái suspended của trường tự nó không thay đổi con trỏ xuất bản.
- **Backend và transaction** phải khóa dòng resource bằng `SELECT ... FOR UPDATE`, đọc lại trạng thái sau khóa, giới hạn một pending trên mỗi resource và dùng `UPDATE ... WHERE decision = 'pending'` để tránh ghi đè quyết định. Transaction kiểm tra điều kiện xuất bản trước khi cập nhật con trỏ, đồng thời bảo vệ sự bất biến của version submitted và scope sau lần gửi đầu. Kiểm thử SQL hiện chứng minh các ràng buộc dữ liệu và luồng tuần tự. Cần kiểm thử tích hợp với hai request để xác nhận giao thức khóa được mọi đường ghi tuân thủ.

## Chạy lại

Tạo schema test trống, chạy `schema.sql`, chạy `seed.sql` hai lần rồi gọi cả hai tệp test hai lượt. Lần seed thứ hai phải báo fixture đã tồn tại. Xác minh khóa và index trong `information_schema`. Quy trình chi tiết có trong [hướng dẫn database](../README.md). Các tình huống Backend còn lại có trong [Business Rules](BUSINESS_RULES.md) và [thiết kế transaction](DATABASE_DESIGN.md).
