const mockResources = [
  ["Bài tập hàm số bậc hai", "An Mai", "Toán học", "Phiếu bài tập", ["Hàm số", "Đồ thị"], "Bài tập vẽ đồ thị và xác định đỉnh của parabol."],
  ["Định luật bảo toàn động lượng", "Bình Trúc", "Vật lý", "Bài giảng", ["Cơ học", "Va chạm"], "Giải thích cách áp dụng định luật bảo toàn động lượng trong hệ cô lập."],
  ["Làm quen với bảng tính", "Chi Lam", "Tin học", "Tài liệu hướng dẫn", ["Công thức", "Bảng tính"], "Hướng dẫn nhập dữ liệu và dùng các hàm tính tổng, trung bình."],
  ["Đọc hiểu văn bản nghị luận", "Dương Mộc", "Ngữ văn", "Phiếu bài tập", ["Luận điểm", "Dẫn chứng"], "Câu hỏi giúp học sinh xác định luận điểm và đánh giá dẫn chứng."],
  ["Cấu trúc dữ liệu hàng đợi", "Giang Vân", "Computer Science", "Bài giảng", ["FIFO", "Cấu trúc dữ liệu"], "Giới thiệu cơ chế vào trước ra trước và các ứng dụng cơ bản."],
  ["Thiết kế cầu dầm", "Hà Tùng", "Engineering", "Tài liệu hướng dẫn", ["Kết cấu", "Tải trọng"], "Bài thực hành dựng mô hình cầu dầm bằng vật liệu học tập."],
  ["Thí nghiệm về lực ma sát", "Bình Trúc", "Vật lý", "Tài liệu hướng dẫn", ["Ma sát", "Đo lực"], "Hướng dẫn so sánh lực ma sát trên các bề mặt khác nhau."],
  ["Phân tích nhân vật trong truyện ngắn", "Dương Mộc", "Ngữ văn", "Bài giảng", ["Nhân vật", "Truyện ngắn"], "Gợi ý phân tích nhân vật qua hành động, lời thoại và góc nhìn kể chuyện."],
  ["Xác suất có điều kiện", "An Mai", "Toán học", "Phiếu bài tập", ["Xác suất", "Sơ đồ cây"], "Bài tập tính xác suất từ sơ đồ cây và bảng tần số.", "approved", "Ví dụ phù hợp với mục tiêu bài học."],
  ["Thuật toán tìm kiếm nhị phân", "Giang Vân", "Computer Science", "Bài giảng", ["Thuật toán", "Tìm kiếm"], "Minh họa cách thu hẹp phạm vi tìm kiếm trên một dãy đã sắp xếp.", "approved", ""],
  ["Mạch điện nối tiếp và song song", "Hà Tùng", "Engineering", "Phiếu bài tập", ["Mạch điện", "Điện trở"], "Câu hỏi tính điện trở tương đương trong các sơ đồ mạch đơn giản.", "rejected", "Tài liệu thiếu thông tin nguồn tham khảo. Vui lòng bổ sung trước khi gửi lại."],
  ["Trình bày nội dung bằng biểu đồ", "Chi Lam", "Tin học", "Tài liệu hướng dẫn", ["Dữ liệu", "Biểu đồ"], "Hướng dẫn chọn loại biểu đồ phù hợp với bộ dữ liệu.", "rejected", "Vui lòng làm rõ quyền sử dụng hình minh họa."]
].map(([title, contributorName, subject, resourceType, topics, description, status = "pending", reviewNote = ""], index) => ({
  id: index + 1,
  title,
  description,
  contributorName,
  subject,
  resourceType,
  topics,
  submittedAt: "2026-11-" + String(18 - index).padStart(2, "0"),
  sourceName: "Học liệu minh họa của Demo School",
  rightsInformation: status === "rejected" ? "" : "Dùng để minh họa giao diện kiểm duyệt.",
  status,
  reviewNote,
  reviewedAt: status === "pending" ? "" : "2026-11-" + String(21 - index).padStart(2, "0")
}));
