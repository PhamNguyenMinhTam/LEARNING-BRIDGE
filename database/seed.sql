-- Import once into a fresh development schema. All identities and artifacts are fictional.
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO schools (id, school_code, school_name, teacher_id_pattern) VALUES
    (1, 'LB-MG01', 'Trường Sao Mực', '^[0-9]{8}$'),
    (2, 'LB-MG02', 'Trường Mây Giấy', '^GV[0-9]{8}$');

INSERT INTO users (id, full_name, email, password_hash, role, school_id) VALUES
    (1, 'Lam Vòm Mực', 'government@example.invalid', 'demo-placeholder', 'government', NULL),
    (2, 'Nâu Dấu Chấm', 'school-a@example.invalid', 'demo-placeholder', 'school_admin', 1),
    (3, 'Tím Nét Phấn', 'school-b@example.invalid', 'demo-placeholder', 'school_admin', 2),
    (4, 'An Lá Giấy', 'teacher-a@example.invalid', 'demo-placeholder', 'teacher', NULL),
    (5, 'Vân Bút Lam', 'teacher-b@example.invalid', 'demo-placeholder', 'teacher', NULL),
    (6, 'Nghiên Sao Bạc', 'teacher-c@example.invalid', 'demo-placeholder', 'teacher', NULL);

INSERT INTO teacher_schools (teacher_id, school_id, teacher_code, pattern_checked_at) VALUES
    (4, 1, '26560053', '2026-10-01 07:00:00'),
    (4, 2, 'GV20260053', '2026-10-01 07:00:00'),
    (5, 2, 'GV20260054', '2026-10-01 07:00:00');

INSERT INTO resources (id, owner_id, review_scope, review_school_id, created_at) VALUES
    (1, 4, 'school', 1, '2026-10-01 08:00:00'),
    (2, 5, 'school', 2, '2026-10-01 08:00:00'),
    (3, 6, 'government', NULL, '2026-10-01 08:00:00'),
    (4, 4, 'school', 2, '2026-10-01 08:00:00');

INSERT INTO resource_versions
    (id, resource_id, version_number, title, description, author_name, category, education_level,
     resource_type, file_path, source_url, rights_basis, access_level, edit_state, created_at)
VALUES
    (1, 1, 1, 'Phân số trên trục số', 'Giáo án minh họa phân số.', 'An Lá Giấy', 'Toán', 'Tiểu học',
     'pdf', 'demo/private/fractions-v1.pdf', NULL, 'own_work', 'public', 'submitted', '2026-10-01 09:00:00'),
    (2, 1, 2, 'Phân số trên trục số mở rộng', 'Bổ sung ví dụ mới.', 'An Lá Giấy', 'Toán', 'Tiểu học',
     'pdf', 'demo/private/fractions-v2.pdf', NULL, 'own_work', 'public', 'submitted', '2026-10-04 09:00:00'),
    (3, 2, 1, 'Đọc biểu đồ cột', 'Bài giảng cần bổ sung nguồn.', 'Vân Bút Lam', 'Toán', 'THCS',
     'authored_document', NULL, NULL, 'unknown', 'restricted', 'submitted', '2026-10-01 09:00:00'),
    (4, 2, 2, 'Đọc biểu đồ cột hiệu chỉnh', 'Bản nháp chỉnh sửa bài giảng.', 'Vân Bút Lam', 'Toán', 'THCS',
     'authored_document', NULL, NULL, 'unknown', 'restricted', 'draft', '2026-10-04 09:00:00'),
    (5, 3, 1, 'Hướng dẫn đọc bản đồ', 'Minh họa một liên kết bên ngoài.', 'Nghiên Sao Bạc', 'Địa lý', 'THCS',
     'external_link', NULL, 'https://example.invalid/demo/map', 'official_link', 'public', 'submitted', '2026-10-01 09:00:00'),
    (6, 4, 1, 'Bài tập nhận biết hình', 'Bản nháp tài liệu tự soạn.', 'An Lá Giấy', 'Toán', 'Tiểu học',
     'authored_document', NULL, NULL, 'own_work', 'restricted', 'draft', '2026-10-01 09:00:00');

INSERT INTO resource_reviews (version_id, reviewer_id, decision, review_note, submitted_at, reviewed_at) VALUES
    (1, 2, 'approved', NULL, '2026-10-01 10:00:00', '2026-10-02 10:00:00'),
    (2, NULL, 'pending', NULL, '2026-10-04 10:00:00', NULL),
    (3, 3, 'rejected', 'Cần bổ sung nguồn và căn cứ chia sẻ.', '2026-10-01 10:00:00', '2026-10-03 10:00:00'),
    (5, 1, 'approved', NULL, '2026-10-01 10:00:00', '2026-10-02 10:00:00');

UPDATE resources SET published_version_id = 1, publication_status = 'published' WHERE id = 1;
UPDATE resources SET published_version_id = 5, publication_status = 'published' WHERE id = 3;
COMMIT;
