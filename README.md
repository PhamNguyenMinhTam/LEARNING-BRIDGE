# Learning Bridge — Educational Resource Access Platform

**Learning Bridge** là dự án phát triển ứng dụng web hỗ trợ giáo viên, học sinh và nhà trường trong việc tìm kiếm, chia sẻ, quản lý và tiếp cận các tài nguyên học tập.

Dự án được xây dựng trong khuôn khổ giải quyết bài toán thiếu sách giáo khoa và tài liệu học tập thông qua một nền tảng trực tuyến đơn giản, dễ sử dụng và phù hợp với điều kiện thực tế.

Thay vì xây dựng một hệ thống thay thế hoàn toàn sách giáo khoa hoặc các nền tảng giáo dục hiện có, Learning Bridge tập trung phát triển một **giải pháp hỗ trợ mang tính tạm thời**, giúp học sinh duy trì việc học trong những giai đoạn chưa có đủ tài liệu cần thiết.

---

## Chạy MVP cục bộ

Express phục vụ bốn giao diện HTML/CSS/Vanilla JS và API trên cùng origin. Sau khi nạp MySQL schema và session migration, cấu hình `backend/.env`, chạy `npm.cmd ci` rồi `npm.cmd run dev` trong `backend/`.

- Student công khai ở `/student/`.
- Teacher đăng ký hoặc đăng nhập ở `/teacher/auth/register.html` và `/teacher/auth/login.html`.
- School Admin đăng nhập ở `/school/login.html`.
- Government đăng nhập ở `/gorvernment/auth/login.html`.

[Hướng dẫn tích hợp và cấu hình](docs/INTEGRATION_GUIDE.md) · [Báo cáo kiểm thử E2E](docs/END_TO_END_TEST_REPORT.md)

## 1. Problem Statement

### Bối cảnh

Sách giáo khoa và tài liệu học tập đóng vai trò quan trọng trong quá trình giảng dạy và học tập. Tuy nhiên, trong một số trường hợp, học sinh có thể gặp khó khăn khi tiếp cận đầy đủ tài liệu do:

- Thiếu sách giáo khoa tại thời điểm bắt đầu năm học.
- Sách chưa được phân phối hoặc cung cấp kịp thời.
- Học sinh chưa có điều kiện sở hữu tài liệu học tập cần thiết.
- Nguồn tài nguyên học tập trực tuyến phân tán trên nhiều website.
- Giáo viên gặp khó khăn trong việc tổng hợp và chia sẻ tài nguyên phù hợp đến học sinh.

Những vấn đề này có thể làm gián đoạn quá trình học tập và tạo ra sự chênh lệch trong khả năng tiếp cận tài nguyên giữa các học sinh.

### Bài toán đặt ra

**Làm thế nào để xây dựng một nền tảng web đơn giản, giúp học sinh tiếp cận tài nguyên học tập phù hợp khi thiếu sách, đồng thời bảo đảm quyền sở hữu trí tuệ và không phụ thuộc vào một hệ thống phức tạp?**

Dự án tập trung giải quyết ba yêu cầu:

1. **Accessibility & Usability:** Học sinh và giáo viên có thể sử dụng nền tảng dễ dàng.
2. **Intellectual Property Protection:** Tài nguyên được chia sẻ phải tôn trọng bản quyền và nguồn sở hữu.
3. **Temporary & Practical Solution:** Giải pháp có thể triển khai ở quy mô nhỏ, đóng vai trò hỗ trợ trong thời gian thiếu tài liệu.

---

## 2. Project Objectives

Learning Bridge hướng đến các mục tiêu chính:

- Xây dựng một ứng dụng web thống nhất cho giáo viên, học sinh và nhà trường.
- Hỗ trợ học sinh tìm kiếm sách giáo khoa chính thức và các nguồn học tập bên ngoài.
- Cho phép giáo viên đóng góp tài nguyên học tập hoặc liên kết đến những nguồn phù hợp.
- Tổ chức tài nguyên theo lớp, môn học, chủ đề và các thông tin liên quan.
- Hỗ trợ nhà trường quản lý, kiểm tra và xác minh tài nguyên khi cần thiết.
- Áp dụng cơ chế phân quyền theo vai trò người dùng.
- Hạn chế việc sao chép, lưu trữ và phân phối nội dung có bản quyền khi chưa được phép.

Dự án ưu tiên tính khả thi, trải nghiệm người dùng và khả năng mở rộng từng bước thay vì xây dựng một hệ thống giáo dục quy mô lớn ngay từ đầu.

---

## 3. Proposed Solution

Learning Bridge được thiết kế như một **Role-Based Educational Resource Platform**, trong đó người dùng truy cập cùng một ứng dụng web nhưng sử dụng các giao diện và chức năng khác nhau tùy theo vai trò.

Hệ thống dự kiến gồm ba nhóm người dùng:

### Teacher — Giáo viên

Giáo viên đóng vai trò đóng góp, chuẩn bị và chia sẻ tài nguyên học tập.

Các chức năng dự kiến:

- Tạo và đăng tải tài nguyên học tập được phép chia sẻ.
- Thêm liên kết đến các nguồn học tập bên ngoài.
- Bổ sung thông tin mô tả, môn học, lớp học và từ khóa.
- Xem lại tài nguyên trước khi xuất bản.
- Thiết lập quyền truy cập phù hợp.
- Quản lý các tài nguyên đã chia sẻ.

Quy trình:

**Create → Prepare → Review → Publish**

### Student — Học sinh

Học sinh là nhóm người dùng chính mà Learning Bridge hướng đến hỗ trợ.

Các chức năng dự kiến:

- Truy cập liên kết sách giáo khoa từ nguồn chính thức.
- Tìm kiếm các nguồn tài nguyên học tập bên ngoài.
- Tìm kiếm tài liệu do giáo viên chia sẻ.
- Lọc tài nguyên theo lớp, môn học và chủ đề.
- Xem thông tin về nguồn và tác giả của tài nguyên.
- Truy cập hoặc tải tài liệu khi được cấp quyền.

Quy trình:

**Find → Access → Learn**

### School / Administrator — Nhà trường / Quản trị viên

Nhà trường đóng vai trò quản lý và giám sát việc sử dụng nền tảng.

Các chức năng dự kiến:

- Quản lý tài khoản và vai trò người dùng.
- Quản lý lớp học và các thông tin liên quan.
- Kiểm tra hoặc xác minh tài nguyên khi cần thiết.
- Quản lý quyền truy cập.
- Theo dõi trạng thái tài nguyên và hoạt động hệ thống.
- Hỗ trợ bảo đảm việc sử dụng tài nguyên phù hợp.

Quy trình:

**Govern → Verify → Manage**

---

## 4. Core Features

### 4.1. Role-Based Access Control

Hệ thống dự kiến áp dụng cơ chế phân quyền theo vai trò (RBAC).

Người dùng chọn vai trò trong quá trình đăng ký. Khi đăng nhập, hệ thống xác thực tài khoản và xác định quyền truy cập dựa trên vai trò đã được lưu.

| Role | Main Responsibility |
|---|---|
| Teacher | Create, manage and publish learning resources |
| Student | Search and access appropriate learning resources |
| School / Admin | Manage users, verify resources and control permissions |

### 4.2. Learning Resource Management

Tài nguyên học tập được tổ chức theo các thông tin mô tả như:

- Tên tài nguyên
- Môn học
- Khối lớp
- Chủ đề
- Loại tài nguyên
- Nguồn hoặc tác giả
- Liên kết truy cập
- Quyền truy cập

Tài nguyên có thể thuộc hai hình thức chính:

**Learning Resource File:** Tệp được phép đăng tải và chia sẻ trên nền tảng.

**External Resource Link:** Liên kết dẫn đến tài nguyên được lưu trữ tại website gốc.

### 4.3. Resource Discovery

Học sinh có thể khám phá tài nguyên thông qua ba phương thức:

**A. Official Textbooks**

Truy cập sách giáo khoa thông qua các nguồn cung cấp chính thức.

**B. External Learning Resources**

Tìm kiếm tài nguyên từ những nguồn bên ngoài, được phân loại và mô tả để hỗ trợ quá trình lựa chọn.

**C. Teacher-Published Resources**

Tìm kiếm tài liệu do giáo viên chia sẻ và truy cập theo quyền được cấp.

### 4.4. Resource Review and Verification

Tùy thuộc vào loại tài nguyên và chính sách của hệ thống, tài nguyên có thể cần được kiểm tra trước khi xuất bản.

Quy trình xác minh có thể bao gồm:

- Kiểm tra nguồn tài nguyên.
- Xác định tác giả hoặc đơn vị sở hữu.
- Kiểm tra liên kết gốc.
- Đánh giá quyền chia sẻ.
- Yêu cầu chỉnh sửa nếu thông tin chưa phù hợp.

---

## 5. Intellectual Property Considerations

Bảo vệ quyền sở hữu trí tuệ là một trong những nguyên tắc quan trọng của Learning Bridge.

Dự án không hướng đến việc tạo ra một kho lưu trữ các bản sao sách giáo khoa thương mại khi chưa có quyền phân phối.

Thay vào đó, hệ thống ưu tiên:

- Liên kết đến các nguồn sách giáo khoa chính thức.
- Duy trì thông tin tác giả và nguồn xuất bản.
- Sử dụng liên kết ngoài đối với tài nguyên được lưu trữ tại website khác.
- Chỉ cho phép đăng tải tài liệu khi có quyền chia sẻ phù hợp.
- Hỗ trợ kiểm tra và xử lý tài nguyên có dấu hiệu vi phạm.

**Nguyên tắc cốt lõi:** Learning Bridge hỗ trợ người học tìm đến nguồn tài nguyên hợp pháp thay vì sao chép và phân phối lại nội dung không được cấp phép.

---

## 6. System Workflow

Luồng hoạt động tổng quát được thiết kế như sau:

**Step 1 — Access & Authentication**

Người dùng truy cập ứng dụng, tạo tài khoản hoặc đăng nhập.

**Step 2 — Role Identification**

Hệ thống xác định vai trò và điều hướng người dùng đến giao diện tương ứng.

**Step 3 — Resource Contribution**

Giáo viên tạo tài nguyên, bổ sung metadata và chuẩn bị xuất bản.

**Step 4 — Optional Verification**

Nhà trường hoặc quản trị viên kiểm tra tài nguyên khi cần thiết.

**Step 5 — Resource Publication**

Hệ thống quản lý việc xuất bản, quyền truy cập và danh mục tài nguyên.

**Step 6 — Resource Discovery**

Học sinh tìm kiếm tài nguyên theo nhu cầu học tập.

**Step 7 — Learning Access**

Học sinh mở nguồn chính thức, truy cập website bên ngoài hoặc sử dụng tài liệu được phép chia sẻ.

---

## 7. Project Structure

Cấu trúc thư mục khởi tạo dự kiến:

```text
LEARNING-BRIDGE-WEBSITE/
│
├── teacher/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── student/
│   └── .gitkeep
│
├── school/
│   └── .gitkeep
│
└── README.md
```

Mỗi thư mục đại diện cho một nhóm người dùng chính.

Cấu trúc này là nền tảng ban đầu và có thể được điều chỉnh khi dự án phát triển thêm các chức năng chung như xác thực, điều hướng và quản lý tài nguyên.

---

## 8. Technology Stack

Công nghệ dự kiến trong giai đoạn phát triển ban đầu:

| Technology | Purpose |
|---|---|
| HTML5 | Xây dựng cấu trúc giao diện |
| CSS3 | Thiết kế giao diện và responsive layout |
| JavaScript | Xử lý tương tác và logic phía client |
| Git & GitHub | Quản lý phiên bản và mã nguồn |
| External APIs | Tích hợp khi thực sự cần thiết |

Dự án ưu tiên các công nghệ web cơ bản, dễ tiếp cận và phù hợp với phạm vi đồ án cuối kỳ.

Các giải pháp backend, lưu trữ dữ liệu, xác thực và tích hợp AI sẽ được xem xét trong những giai đoạn tiếp theo dựa trên mức độ cần thiết.

---

## 9. Development Roadmap

### Phase 1 — Project Initialization

- [ ] Khởi tạo repository.
- [ ] Xây dựng cấu trúc folder cho ba vai trò.
- [ ] Tạo skeleton giao diện Teacher Portal.
- [ ] Xác định phạm vi chức năng cho phiên bản đầu tiên.

### Phase 2 — Frontend Development

- [ ] Thiết kế giao diện Teacher Portal.
- [ ] Thiết kế giao diện Student Portal.
- [ ] Thiết kế giao diện School / Administrator Portal.
- [ ] Xây dựng giao diện responsive.
- [ ] Hoàn thiện điều hướng giữa các trang.

### Phase 3 — Core Functionality

- [ ] Xây dựng các chức năng quản lý tài nguyên.
- [ ] Tạo biểu mẫu đóng góp tài nguyên.
- [ ] Xây dựng tìm kiếm và bộ lọc.
- [ ] Triển khai xác thực và phân quyền cơ bản.
- [ ] Tích hợp nguồn tài nguyên bên ngoài.

### Phase 4 — Integration & Testing

- [ ] Kiểm tra luồng hoạt động của từng vai trò.
- [ ] Kiểm tra quyền truy cập tài nguyên.
- [ ] Kiểm tra khả năng sử dụng trên các thiết bị.
- [ ] Kiểm tra thông tin nguồn và quyền chia sẻ.
- [ ] Sửa lỗi và hoàn thiện phiên bản demo.

---

## 10. Project Scope & Limitations

Learning Bridge là đồ án học thuật có phạm vi triển khai giới hạn.

Dự án không nhằm:

- Thay thế hệ thống phân phối sách giáo khoa chính thức.
- Trở thành nền tảng quản lý học tập hoàn chỉnh (LMS).
- Cung cấp miễn phí các tài liệu thương mại khi chưa có quyền sử dụng.
- Xây dựng hệ thống quản trị giáo dục quy mô lớn.

Trọng tâm là tạo ra một công cụ hỗ trợ đơn giản để học sinh có thể tiếp tục tiếp cận tài nguyên học tập trong thời gian thiếu sách.

---

## 11. Expected Outcomes

Khi hoàn thiện phiên bản demo, dự án kỳ vọng:

- Có một ứng dụng web với giao diện phù hợp cho ba nhóm người dùng.
- Giáo viên có thể đóng góp và quản lý tài nguyên học tập.
- Học sinh có thể tìm kiếm và truy cập các tài nguyên phù hợp.
- Nhà trường có thể thực hiện các thao tác quản lý và kiểm tra cơ bản.
- Các tài nguyên được tổ chức rõ ràng và có thông tin nguồn.
- Thiết kế thể hiện được ba nguyên tắc: dễ sử dụng, tôn trọng bản quyền và hỗ trợ tạm thời.

---

## 12. Project Status

**Status: MVP Integration**

Dự án hiện ở giai đoạn xây dựng cấu trúc ban đầu. Những chức năng được mô tả trong tài liệu là thiết kế và định hướng phát triển, chưa mặc định là đã được triển khai.

Các thành phần sẽ tiếp tục được cập nhật trong quá trình thực hiện đồ án.

---

## 13. Repository

**GitHub:** https://github.com/PhamNguyenMinhTam/LEARNING-BRIDGE

**Project Type:** Web Programming — Final Project

**Project Name:** Learning Bridge

**Focus:** Educational Resource Accessibility, Role-Based Web Application, Intellectual Property Awareness

---

*Learning Bridge — Connecting students to appropriate learning resources.*
