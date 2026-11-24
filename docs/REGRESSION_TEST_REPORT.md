# Regression Test Report — Phase 3.1

| Nhóm | Trước sửa | Sau sửa |
| --- | --- | --- |
| Unit và HTTP API nền | 33/33 | 33/33 |
| Integration MySQL/transport | 6/6 | 7/7 |
| SQL positive lifecycle và negative constraints | 28/28 | 28/28 |
| Playwright với MySQL thật | 2/2 | 2/2, bổ sung bước hai School Admin approve/reject cạnh tranh |
| Playwright với fault injection | 0/3 | 3/3 |

Ba ca tái hiện ban đầu thất bại đúng hành vi lỗi: một response đến muộn ghi đè Review đang chọn, một phản hồi JSON hỏng hiện lỗi kỹ thuật, một request không phản hồi giữ màn hình loading. Bộ fault injection dùng phản hồi kiểm soát trong browser và không được tính là E2E có MySQL. Ca outage mới dùng HTTP thật và mysql2 kết nối tới TCP loopback chủ động ngắt kết nối.

Kiểm tra cú pháp JavaScript ở Frontend và Backend đã chạy. Trong nhóm định lượng cuối cùng có **73 đạt, 0 thất bại, 0 bị chặn**. Ba nhóm ngoài phạm vi chạy là render PDF đa trình duyệt, file symlink trên Windows, và kiểm tra trên production. Kiểm tra junction, MIME, download bytes và no-store đã chạy trong các suite tương ứng. Không còn failure trong các suite đã chạy. [Chi tiết lỗi](BUG_REPORT.md)
