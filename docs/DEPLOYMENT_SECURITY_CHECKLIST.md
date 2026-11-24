# Deployment Security Checklist — Phase 3.2

- [ ] Dùng HTTPS tại reverse proxy và cấu hình Node production. Chỉ tin proxy loopback đã được kiểm soát và xóa/ghi đè forwarded headers từ client.
- [ ] Xác nhận cookie HttpOnly, Secure, SameSite=Lax và expiry thực tế qua proxy đích. Dùng session store MySQL và secret ngẫu nhiên riêng từng môi trường.
- [ ] Đặt AUTH_ORIGINS theo origin HTTPS chính xác. Bật CORS cho origin cần thiết và giữ Origin guard cho requests thay đổi trạng thái.
- [ ] Tạo DB user quyền tối thiểu. Bổ sung UPDATE cho hành chính trên resources gồm administrative_status, withdrawn_at, withdrawn_by, withdrawal_reason, reinstated_at, reinstated_by. Giữ quyền FK/DDL cho DBA. Hạn chế truy cập DB qua firewall và kiểm tra TLS theo kiến trúc triển khai.
- [ ] Dừng writers, backup, chạy migration 002 và kiểm tra legacy_hold trước khi khởi động app mới. Dùng script/test schema riêng cho xác minh.
- [ ] Giữ kho PDF ngoài static root, áp ACL cho app, tránh symlink/junction và cấp mount có tính bền vững. Kiểm tra hạn mức và chính sách quét PDF trước khi mở rộng đối tượng tải lên.
- [ ] Kiểm tra log lỗi không chứa password, cookie, hash, đường dẫn PDF hoặc nội dung lý do rút. Đặt retention và giám sát HTTP 401/403/409/429/503 phù hợp.
- [ ] Chạy backup và restore drill cho MySQL cùng thư mục PDF. Kiểm tra withdrawal/reinstatement sau khôi phục. Không suy ra disaster recovery từ kiểm thử chức năng.
- [ ] Xác nhận rate limit ở proxy nếu triển khai nhiều tiến trình. Kiểm thử production-like trên domain HTTPS trước khi mở truy cập thật.

[Migration và data integrity](DATA_INTEGRITY_REPORT.md)
