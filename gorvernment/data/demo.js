"use strict";

const institutionTypes = ["Tiểu học", "Trung học cơ sở", "Trung học phổ thông", "Đại học", "Cao đẳng", "Cơ sở giáo dục khác"];
const resourceTypes = ["Giáo án", "Bài tập", "Tài liệu tham khảo", "Bài trình chiếu"];

const state = {
  schools: [
    ["MG01", "Tiểu học Sao Mực", 0, "active"],
    ["MG02", "THCS Mây Cẩm Thạch", 1, "active"],
    ["MG03", "THPT Lá Hổ Phách", 2, "active"],
    ["MG04", "Đại học Vòm Giấy", 3, "inactive"],
    ["MG05", "Cao đẳng Sông Kính", 4, "active"],
    ["MG06", "Trung tâm Hạt Gió", 5, "inactive"],
    ["MG07", "Tiểu học Búp Lam", 0, "active"],
    ["MG08", "THCS Đồi Bút Chì", 1, "active"]
  ].map(([code, name, type, status], index) => ({
    code, name, type: institutionTypes[type], status,
    email: index % 2 ? "" : `lienhe-${code.toLowerCase()}@example.invalid`,
    phone: "", date: `2026-10-${10 + index}`
  })),
  rules: {
    MG01: { type: "numeric", prefix: "", digits: "8", separator: "", suffix: "", example: "26560053", description: "Mã gồm tám chữ số." },
    MG02: { type: "prefix", prefix: "GV", digits: "8", separator: "", suffix: "", example: "GV20260053", description: "Tiền tố GV và tám chữ số." },
    MG03: { type: "custom", prefix: "T", digits: "4", separator: "-", suffix: "3", example: "T2026-015", description: "Hai nhóm chữ số phân cách bằng dấu gạch ngang." },
    MG05: { type: "alphanumeric", prefix: "CD", digits: "", separator: "", suffix: "", example: "CD26A15", description: "Tiền tố CD, theo sau là chữ cái hoặc chữ số." }
  },
  accounts: ["MG01", "MG02", "MG03", "MG04", "MG05", "MG07"].map((school, index) => ({
    school, username: `quantri_${school.toLowerCase()}`, status: index === 3 ? "inactive" : "active",
    date: `2026-10-${20 + index}`
  })),
  resources: [
    ["Phân số trên trục số", "Toán", 0, "pending"],
    ["Bài tập tỷ lệ thức", "Toán", 1, "pending"],
    ["Bản đồ tư duy về tế bào", "Sinh học", 3, "approved"],
    ["Từ vựng về thời tiết", "Tiếng Anh", 1, "pending"],
    ["Ánh sáng và bóng đổ", "Vật lý", 0, "pending"],
    ["Đọc hiểu truyện ngắn", "Ngữ văn", 1, "rejected"],
    ["Các bước đọc bản đồ", "Địa lý", 2, "approved"],
    ["Cân bằng phương trình", "Hóa học", 1, "pending"],
    ["Hình học của tổ ong", "Toán", 3, "approved"],
    ["Vòng tuần hoàn của nước", "Khoa học", 0, "pending"],
    ["Viết đoạn văn miêu tả", "Ngữ văn", 0, "approved"],
    ["Nhịp điệu trong âm nhạc", "Âm nhạc", 3, "pending"],
    ["Dữ liệu và biểu đồ", "Tin học", 2, "approved"],
    ["Ôn tập năng lượng", "Vật lý", 1, "rejected"],
    ["Sắc độ trong tranh", "Mỹ thuật", 2, "pending"]
  ].map(([title, subject, type, status], index) => ({
    id: index + 1, title, subject, type: resourceTypes[type], status,
    contributor: ["An Bút Lam", "Nghiên Sao Giấy", "Vân Mực Tím", "Lâm Đồi Chữ"][index % 4],
    date: `2026-11-${10 + Math.floor(index / 2)}`,
    description: `Nội dung minh họa cho chủ đề “${title}”.`,
    topics: [subject, title],
    source: "Thông tin nguồn do người đóng góp khai báo trong mẫu.",
    rights: "Thông tin quyền sử dụng trong bản demo cần được xem xét thủ công.",
    note: status === "rejected" ? "Cần bổ sung thông tin nguồn và quyền sử dụng." : "",
    reviewed: status === "pending" ? "" : "2026-11-20"
  }))
};