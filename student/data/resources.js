const resourceGroups = {
  domain: {
    cs: "Khoa học máy tính", math: "Toán học", engineering: "Kỹ thuật",
    economics: "Kinh tế", science: "Khoa học tự nhiên", languages: "Ngôn ngữ",
    social: "Khoa học xã hội"
  },
  level: {
    school: "Phổ thông", higher: "Đại học và cao đẳng",
    research: "Nghiên cứu", self: "Tự học"
  },
  type: {
    textbook: "Giáo trình", reference: "Sách tham khảo", lecture: "Bài giảng",
    slides: "Slide", exercises: "Bài tập", exam: "Tài liệu ôn thi",
    paper: "Bài báo nghiên cứu", guide: "Hướng dẫn"
  },
  language: { vi: "Tiếng Việt", en: "Tiếng Anh", other: "Ngôn ngữ khác" },
  access: {
    read: "Đọc miễn phí", download: "Cho phép tải xuống",
    original: "Xem tại nguồn gốc", restricted: "Hạn chế truy cập"
  }
};

function demoResource(id, title, description, options) {
  return {
    id, title, description,
    domains: [], educationLevels: [], topics: [], keywords: [],
    authors: [], contributor: null, courseName: null, courseCode: null,
    sourceName: "Danh mục minh họa Learning Bridge", sourceType: "Bản ghi mô phỏng",
    sourceUrl: null, isbn: null, doi: null, license: null,
    publicationStatus: "published", accessVisibility: "public",
    ...options
  };
}

const resources = [
  demoResource(1, "Toán 10 — Kết nối tri thức", "Tổng quan về mệnh đề, tập hợp và các chủ đề đại số lớp 10.", {
    domains: ["math"], educationLevels: ["school"], resourceType: "textbook", language: "vi", accessType: "original", publicationYear: 2022, topics: ["Đại số"], keywords: ["tập hợp", "mệnh đề"]
  }),
  demoResource(2, "Vật lý 10", "Ôn lại chuyển động, lực và định luật Newton qua các tình huống quen thuộc.", {
    domains: ["science"], educationLevels: ["school"], resourceType: "textbook", language: "vi", accessType: "original", publicationYear: 2022, topics: ["Cơ học"], keywords: ["động lực học"]
  }),
  demoResource(3, "Ngữ văn 11", "Gợi ý đọc hiểu văn bản và xây dựng lập luận trong bài nghị luận.", {
    domains: ["languages", "social"], educationLevels: ["school"], resourceType: "reference", language: "vi", accessType: "read", publicationYear: 2023, topics: ["Đọc hiểu"], keywords: ["nghị luận"]
  }),
  demoResource(4, "Bài tập Hàm số bậc hai", "Luyện xác định đỉnh parabol, lập bảng biến thiên và đọc đồ thị.", {
    domains: ["math"], educationLevels: ["school"], resourceType: "exercises", language: "vi", accessType: "download", publicationYear: 2024, topics: ["Hàm số bậc hai"], keywords: ["parabol"]
  }),
  demoResource(5, "Đề cương ôn tập học kỳ", "Hệ thống kiến thức và câu hỏi tự luyện cho học kỳ Toán 10.", {
    domains: ["math"], educationLevels: ["school"], resourceType: "exam", language: "vi", accessType: "read", publicationYear: 2025, topics: ["Toán 10"], keywords: ["kiểm tra"]
  }),
  demoResource(6, "Computer Architecture — MIPS", "Tìm hiểu tập lệnh MIPS, thanh ghi và cách tổ chức đường dữ liệu.", {
    domains: ["cs", "engineering"], educationLevels: ["higher"], resourceType: "lecture", language: "vi", accessType: "read", publicationYear: 2024, topics: ["Kiến trúc máy tính"], keywords: ["assembly", "datapath"], courseName: "Kiến trúc máy tính", courseCode: "CA201", authors: ["Nhóm biên soạn mô phỏng"], contributor: "Nhóm học liệu mô phỏng"
  }),
  demoResource(7, "Data Structures and Algorithms", "Tổng hợp cấu trúc cây, đồ thị và phương pháp phân tích độ phức tạp.", {
    domains: ["cs"], educationLevels: ["higher", "self"], resourceType: "textbook", language: "en", accessType: "read", publicationYear: 2023, topics: ["Algorithms"], keywords: ["graphs", "complexity"]
  }),
  demoResource(8, "Database Systems", "Bài giảng về mô hình quan hệ, chuẩn hóa và truy vấn SQL.", {
    domains: ["cs"], educationLevels: ["higher"], resourceType: "lecture", language: "vi", accessType: "read", publicationYear: 2025, topics: ["Cơ sở dữ liệu"], keywords: ["SQL", "normalization"], courseCode: "DB201"
  }),
  demoResource(9, "Introduction to Economics", "Khảo sát cung, cầu và cách thị trường phân bổ nguồn lực.", {
    domains: ["economics"], educationLevels: ["higher"], resourceType: "textbook", language: "en", accessType: "original", publicationYear: 2021, topics: ["Microeconomics"], keywords: ["supply", "demand"]
  }),
  demoResource(10, "Calculus", "Bài tập về giới hạn, đạo hàm và tích phân một biến.", {
    domains: ["math"], educationLevels: ["higher"], resourceType: "exercises", language: "en", accessType: "download", publicationYear: 2022, topics: ["Giải tích"], keywords: ["derivative", "integral"]
  }),
  demoResource(11, "Operating Systems", "Các khái niệm về tiến trình, lập lịch và quản lý bộ nhớ ảo.", {
    domains: ["cs"], educationLevels: ["higher"], resourceType: "slides", language: "en", accessType: "read", publicationYear: 2024, topics: ["Hệ điều hành"], keywords: ["scheduling", "virtual memory"]
  }),
  demoResource(12, "Programming Fundamentals", "Thực hành biến, vòng lặp và hàm với các bài toán nhỏ.", {
    domains: ["cs"], educationLevels: ["higher", "self"], resourceType: "lecture", language: "vi", accessType: "download", publicationYear: 2023, topics: ["Nhập môn lập trình"], keywords: ["control flow"]
  }),
  demoResource(13, "Artificial Intelligence", "Tổng quan các hướng tiếp cận tìm kiếm và biểu diễn tri thức.", {
    domains: ["cs"], educationLevels: ["research"], resourceType: "paper", language: "en", accessType: "original", publicationYear: 2025, topics: ["Trí tuệ nhân tạo"], keywords: ["heuristics", "knowledge representation"]
  }),
  demoResource(14, "Machine Learning", "Đề cương so sánh cách đánh giá các mô hình học có giám sát.", {
    domains: ["cs", "math"], educationLevels: ["research"], resourceType: "paper", language: "en", accessType: "original", publicationYear: 2024, topics: ["Supervised learning"], keywords: ["cross-validation"]
  }),
  demoResource(15, "Multi-Agent Systems", "Giới thiệu cơ chế phối hợp và ra quyết định trong hệ đa tác tử.", {
    domains: ["cs"], educationLevels: ["research"], resourceType: "paper", language: "en", accessType: "restricted", publicationYear: 2023, topics: ["Hệ đa tác tử"], keywords: ["coordination"]
  }),
  demoResource(16, "Computer Vision", "Khảo sát cách phân loại ảnh và đánh giá bài toán phát hiện vật thể.", {
    domains: ["cs", "engineering"], educationLevels: ["research"], resourceType: "paper", language: "en", accessType: "read", publicationYear: 2025, topics: ["Thị giác máy tính"], keywords: ["object detection"]
  }),
  demoResource(17, "Internet of Things", "Giới thiệu kiến trúc mạng cảm biến và trao đổi dữ liệu giữa thiết bị.", {
    domains: ["engineering", "cs"], educationLevels: ["research"], resourceType: "reference", language: "en", accessType: "original", publicationYear: 2020, topics: ["Mạng cảm biến"], keywords: ["IoT", "MQTT"]
  }),
  demoResource(18, "Python Programming", "Các ví dụ thực hành với danh sách, từ điển và thao tác chuỗi.", {
    domains: ["cs"], educationLevels: ["self"], resourceType: "guide", language: "vi", accessType: "read", publicationYear: 2025, topics: ["Python"], keywords: ["list", "dictionary"]
  }),
  demoResource(19, "PLC Programming", "Bài tập nhập môn về chu kỳ quét và sơ đồ thang cho bộ điều khiển.", {
    domains: ["engineering"], educationLevels: ["self"], resourceType: "guide", language: "en", accessType: "original", publicationYear: 2021, topics: ["Tự động hóa"], keywords: ["ladder logic"]
  }),
  demoResource(20, "Web Development", "Xây dựng trang web đầu tiên với HTML, CSS và JavaScript.", {
    domains: ["cs"], educationLevels: ["self"], resourceType: "guide", language: "vi", accessType: "download", publicationYear: 2024, topics: ["Frontend"], keywords: ["responsive", "DOM"]
  }),
  demoResource(21, "English Grammar", "Ôn các thì, mệnh đề quan hệ và cấu trúc câu thông dụng.", {
    domains: ["languages"], educationLevels: ["self", "school"], resourceType: "exercises", language: "en", accessType: "read", publicationYear: 2022, topics: ["Ngữ pháp"], keywords: ["tenses"]
  }),
  demoResource(22, "Data Analysis", "Thực hành làm sạch dữ liệu và diễn giải các thống kê mô tả.", {
    domains: ["math", "economics"], educationLevels: ["self"], resourceType: "guide", language: "vi", accessType: "read", publicationYear: 2025, topics: ["Thống kê"], keywords: ["data cleaning"]
  }),
  demoResource(23, "Git and GitHub", "Hướng dẫn quản lý phiên bản qua commit, nhánh và hợp nhất mã.", {
    domains: ["cs"], educationLevels: ["self"], resourceType: "guide", language: "vi", accessType: "read", publicationYear: 2024, topics: ["Quản lý phiên bản"], keywords: ["merge", "commit"]
  }),
  demoResource(24, "Français débutant", "Activités de lecture et de grammaire pour le niveau A1.", {
    domains: ["languages"], educationLevels: ["self"], resourceType: "exercises", language: "other", accessType: "download", publicationYear: 2023, topics: ["Français"], keywords: ["A1"]
  }),
  demoResource(25, "Bản nháp danh mục", "Bản ghi để kiểm tra trạng thái xuất bản.", {
    publicationStatus: "draft"
  }),
  demoResource(26, "Bản ghi nội bộ", "Bản ghi để kiểm tra phạm vi hiển thị.", {
    accessVisibility: "restricted"
  })
];
