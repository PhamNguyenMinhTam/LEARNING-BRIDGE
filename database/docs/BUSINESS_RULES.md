# Quy tắc nghiệp vụ Learning Bridge

Đề bài mô tả các hành vi và ràng buộc, nhưng repo và tài liệu được cung cấp chưa có danh sách BR-01 đến BR-48 nguyên văn. Bảng dưới ánh xạ 48 mục từ các yêu cầu đã nêu để triển khai và kiểm thử. Số hiệu cần đối chiếu khi có bản phê duyệt chính thức. Cột thực thi cho biết lớp chịu trách nhiệm.

## Government

| Mã tạm | Thực thi | Quy tắc |
|---|---|---|
| BR-01 | Backend | Government tạo School sau khi xác minh đăng ký ngoại tuyến. |
| BR-02 | Backend | Government cấu hình teacher ID pattern theo School. |
| BR-03 | MySQL + Backend | Government cấp tài khoản School Admin và gắn tài khoản với một School. |
| BR-04 | Backend | Government quản lý trạng thái kích hoạt hoặc đình chỉ School. |
| BR-05 | Backend | Government review các tài nguyên độc lập có scope government. |

## Teacher

| Mã tạm | Thực thi | Quy tắc |
|---|---|---|
| BR-06 | Backend | Teacher có thể đăng ký tài khoản. |
| BR-07 | Backend | Teacher đăng nhập qua lớp xác thực. |
| BR-08 | MySQL + Backend | Teacher có thể khai báo liên kết với nhiều School. |
| BR-09 | MySQL | Một cặp Teacher–School có tối đa một record liên kết. |
| BR-10 | Backend | Teacher có thể đóng góp độc lập mà không cần association. |
| BR-11 | Backend | Đối chiếu teacher code với pattern do Government cấu hình cho School. |
| BR-12 | Backend | Pattern hợp lệ chỉ xác nhận định dạng. Danh tính và tư cách thuộc trường cần bằng chứng riêng. |
| BR-13 | Backend | School-scoped submission yêu cầu association active. |
| BR-14 | Backend + Transaction | Dùng pattern hiện hành khi submit, kể cả khi từng đối chiếu thành công. |
| BR-15 | MySQL + Backend | Teacher tạo và sở hữu resource của mình. |
| BR-16 | MySQL + Backend | Teacher tạo version nháp để chuẩn bị nội dung. |
| BR-17 | Backend + Transaction | Teacher gửi version nháp để review theo scope. |
| BR-18 | Backend | Teacher xem kết quả kiểm duyệt của resource mình sở hữu. |
| BR-19 | Backend + Transaction | Sau approval, chỉnh sửa nội dung bằng version mới. |
| BR-20 | Backend + Transaction | Sau rejection, chỉnh sửa nội dung bằng version mới. |

## School

| Mã tạm | Thực thi | Quy tắc |
|---|---|---|
| BR-21 | Backend | School Admin xem hàng đợi school-scoped pending của trường mình. |
| BR-22 | Backend + Transaction | School Admin có thể duyệt submission thuộc trường mình. |
| BR-23 | Backend + Transaction | School Admin có thể từ chối submission thuộc trường mình. |
| BR-24 | MySQL | Rejection yêu cầu ghi chú có nội dung. |
| BR-25 | Backend | School Admin chỉ review các submission của trường trực thuộc. |
| BR-26 | Backend + Transaction | School bị suspended dừng thực hiện review mới. |
| BR-27 | Backend | Suspension giữ các publication còn quyền phân phối hợp lệ. |

## Student

| Mã tạm | Thực thi | Quy tắc |
|---|---|---|
| BR-28 | Backend | Student tìm kiếm resource công khai mà không cần đăng nhập. |
| BR-29 | Backend | Student xem metadata của version hiện đang công khai. |
| BR-30 | Backend | Student chỉ tải hoặc mở nội dung công khai được phép phân phối. |
| BR-31 | Backend | Public routes loại trừ version draft, pending, rejected hoặc restricted. |

## Quy tắc liên hệ thống

| Mã tạm | Thực thi | Quy tắc |
|---|---|---|
| BR-32 | MySQL | School code duy nhất theo collation được chọn. |
| BR-33 | MySQL + Backend | Email duy nhất sau chuẩn hóa. |
| BR-34 | Backend | Chỉ lưu password hash cho tài khoản sử dụng thật. |
| BR-35 | MySQL | School Admin phải có school_id, Teacher và Government phải để NULL. |
| BR-36 | MySQL | Resource có đúng một owner và school ID khớp quy tắc theo scope. |
| BR-37 | MySQL + Transaction | Publication và review có trạng thái riêng. |

## Quy tắc bổ sung BR-38 đến BR-48

| Mã tạm | Thực thi | Quy tắc |
|---|---|---|
| BR-38 | MySQL | Mỗi resource có tối đa một version được chọn xuất bản và version thuộc cùng resource. |
| BR-39 | Backend + Transaction | Review scope cố định sau lần gửi đầu tiên. |
| BR-40 | MySQL | Version number dương và duy nhất trong resource. |
| BR-41 | Backend + Transaction | Version submitted giữ nguyên nội dung. |
| BR-42 | MySQL | PDF yêu cầu file_path, external_link yêu cầu source_url. |
| BR-43 | MySQL + Backend | Public access yêu cầu căn cứ quyền hợp lệ. Giá trị khai báo cần được xem xét riêng. |
| BR-44 | MySQL + Transaction | Mỗi submitted version có đúng một review. UNIQUE bảo đảm tối đa một, transaction bảo đảm tạo đủ. |
| BR-45 | MySQL | Pending không có reviewer hoặc reviewed_at. Quyết định cuối có cả hai. |
| BR-46 | Backend + Transaction | Quyết định cuối và lịch sử review được giữ nguyên. |
| BR-47 | Transaction | Mỗi resource có tối đa một pending submission. |
| BR-48 | Backend + Transaction | Cập nhật publication trong cùng transaction với kiểm tra eligibility và quyết định khi thao tác kết hợp. |

## Chính sách cụ thể của bản triển khai

- Chuẩn hóa email và so sánh mã trường theo chính sách trong [từ điển dữ liệu](DATA_DICTIONARY.md).
- Resource `hidden` không giữ con trỏ xuất bản. Khi rút xuất bản, các version và kết quả review vẫn tồn tại.
- Danh mục `rights_basis` dùng năm giá trị được đề bài đề xuất. Schema giữ tên trường và mã giáo viên dạng chuỗi. Giá trị `pattern_checked_at` có thể NULL cho association chưa đối chiếu.
- Backend cần xác định chính sách ai được xuất bản hoặc rút xuất bản. Schema hiện chỉ lưu owner, phạm vi duyệt và trạng thái. Căn cứ hết hiệu lực hoặc yêu cầu gỡ nội dung cần được xử lý qua luồng rút xuất bản và kiểm soát truy cập.

## Integration tests khi có Backend

| Ca | Kết quả cần quan sát |
|---|---|
| School A review submission của School B | Từ chối quyền, giữ nguyên review và publication. |
| Teacher gửi yêu cầu sửa trực tiếp version submitted | Từ chối cập nhật, cho phép tạo draft mới nếu có quyền. |
| Review với School suspended | Từ chối quyết định mới, giữ nguyên publication còn quyền hợp lệ. |
| Hai request đồng thời gửi hai version của một resource | Một transaction tạo pending, transaction còn lại báo xung đột. |
| Hai reviewer cùng quyết định một pending review | Chỉ một quyết định commit, reviewer thứ hai nhận báo xung đột. |
| Student truy cập URL tệp draft, pending, rejected hoặc restricted | Không nhận nội dung hoặc quyền tải, kể cả khi biết đường dẫn. |
| Mã Teacher không khớp pattern hiện hành khi gửi theo School | Từ chối submit, version vẫn draft và không sinh review. |
| Đổi scope sau lần gửi đầu hoặc publish version chưa approved | Từ chối thao tác và giữ nguyên dữ liệu. |
| Rút xuất bản rồi dùng lại URL tải đã lưu | Đường tải công khai dừng cấp quyền, quyền đã cấp được xử lý theo chính sách lưu trữ. |
