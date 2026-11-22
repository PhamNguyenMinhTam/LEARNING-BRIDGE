-- Run in an isolated development database. Inserted rows are rolled back.
SET NAMES utf8mb4;
DROP PROCEDURE IF EXISTS lb_test_validation;

DELIMITER //
CREATE PROCEDURE lb_test_validation()
BEGIN
    DECLARE test_school, test_teacher, test_admin, test_resource, first_version, second_version BIGINT UNSIGNED;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    INSERT INTO schools (school_code, school_name, teacher_id_pattern)
    VALUES ('LB-TEST-POS', 'Trường Kiểm Thử', '^[0-9]{8}$');
    SET test_school = LAST_INSERT_ID();

    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ('Giáo viên Kiểm Thử', 'validation-teacher@example.invalid', 'demo-placeholder', 'teacher');
    SET test_teacher = LAST_INSERT_ID();

    INSERT INTO users (full_name, email, password_hash, role, school_id)
    VALUES ('Quản trị Kiểm Thử', 'validation-admin@example.invalid', 'demo-placeholder', 'school_admin', test_school);
    SET test_admin = LAST_INSERT_ID();

    INSERT INTO teacher_schools (teacher_id, school_id, teacher_code, pattern_checked_at)
    VALUES (test_teacher, test_school, '12345678', CURRENT_TIMESTAMP);

    INSERT INTO resources (owner_id, review_scope, review_school_id)
    VALUES (test_teacher, 'school', test_school);
    SET test_resource = LAST_INSERT_ID();

    INSERT INTO resource_versions
        (resource_id, version_number, title, description, author_name, category, education_level,
         resource_type, file_path, rights_basis, access_level)
    VALUES (test_resource, 1, 'Phân số', 'Bài kiểm thử', 'Tác giả mẫu', 'Toán', 'Tiểu học',
            'pdf', 'test/private/example.pdf', 'own_work', 'public');
    SET first_version = LAST_INSERT_ID();

    UPDATE resource_versions SET edit_state = 'submitted' WHERE id = first_version AND edit_state = 'draft';
    INSERT INTO resource_reviews (version_id) VALUES (first_version);
    IF NOT EXISTS (
        SELECT 1 FROM resource_reviews WHERE version_id = first_version
        AND decision = 'pending' AND reviewer_id IS NULL AND reviewed_at IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pending review missing or invalid';
    END IF;

    UPDATE resource_reviews SET reviewer_id = test_admin, decision = 'approved', reviewed_at = CURRENT_TIMESTAMP
    WHERE version_id = first_version AND decision = 'pending';
    UPDATE resources SET published_version_id = first_version, publication_status = 'published'
    WHERE id = test_resource;

    INSERT INTO resource_versions
        (resource_id, version_number, title, description, author_name, category, education_level,
         resource_type, edit_state)
    VALUES (test_resource, 2, 'Phân số sửa đổi', 'Bài kiểm thử', 'Tác giả mẫu', 'Toán', 'Tiểu học',
            'authored_document', 'submitted');
    SET second_version = LAST_INSERT_ID();

    INSERT INTO resource_reviews (version_id) VALUES (second_version);
    UPDATE resource_reviews
    SET reviewer_id = test_admin, decision = 'rejected', review_note = 'Cần bổ sung nguồn.', reviewed_at = CURRENT_TIMESTAMP
    WHERE version_id = second_version AND decision = 'pending';

    IF NOT EXISTS (
        SELECT 1
        FROM resources AS r
        JOIN resource_versions AS v ON v.resource_id = r.id AND v.id = r.published_version_id
        JOIN resource_reviews AS rr ON rr.version_id = v.id
        JOIN teacher_schools AS ts ON ts.teacher_id = r.owner_id AND ts.school_id = r.review_school_id
        WHERE r.id = test_resource AND r.publication_status = 'published' AND v.version_number = 1
          AND v.title COLLATE utf8mb4_0900_bin = 'Phân số'
          AND v.access_level = 'public' AND v.edit_state = 'submitted'
          AND rr.decision = 'approved' AND ts.status = 'active'
    ) OR NOT EXISTS (
        SELECT 1 FROM resource_reviews
        WHERE version_id = second_version AND decision = 'rejected' AND review_note IS NOT NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Published version or review history mismatch';
    END IF;

    UPDATE resources SET publication_status = 'hidden', published_version_id = NULL WHERE id = test_resource;
    IF NOT EXISTS (
        SELECT 1 FROM resources WHERE id = test_resource
        AND publication_status = 'hidden' AND published_version_id IS NULL
    ) OR (SELECT COUNT(*) FROM resource_reviews WHERE version_id IN (first_version, second_version)) <> 2 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Withdrawal did not preserve review history';
    END IF;

    ROLLBACK;
    SELECT 'PASS: positive lifecycle, publication and withdrawal' AS result;
END//
DELIMITER ;

CALL lb_test_validation();
DROP PROCEDURE lb_test_validation;
