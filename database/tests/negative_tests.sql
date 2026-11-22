-- Run after seed.sql in an isolated development database.
-- Each assertion rolls back its DML and checks the precise MySQL error number.
DROP PROCEDURE IF EXISTS lb_test_expect_error;

DELIMITER //
CREATE PROCEDURE lb_test_expect_error(
    IN test_name VARCHAR(100), IN expected_errno INT, IN test_sql TEXT
)
BEGIN
    DECLARE actual_errno INT DEFAULT 0;
    DECLARE failure_message VARCHAR(128);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET @lb_test_sql = test_sql;
    PREPARE lb_negative_statement FROM @lb_test_sql;
    START TRANSACTION;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
        BEGIN
            GET STACKED DIAGNOSTICS CONDITION 1 actual_errno = MYSQL_ERRNO;
        END;
        EXECUTE lb_negative_statement;
    END;
    ROLLBACK;
    DEALLOCATE PREPARE lb_negative_statement;
    SET @lb_test_sql = NULL;

    IF actual_errno <> expected_errno THEN
        SET failure_message = CONCAT(test_name, ': expected ', expected_errno, ', got ', actual_errno);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = failure_message;
    END IF;
    SELECT CONCAT('PASS: ', test_name, ' (', actual_errno, ')') AS result;
END//
DELIMITER ;

CALL lb_test_expect_error('Duplicate school code (case-insensitive)', 1062,
    'INSERT INTO schools (school_code, school_name, teacher_id_pattern) VALUES (''lb-mg01'', ''Duplicate'', ''^1$'')');
CALL lb_test_expect_error('Duplicate teacher-school pair', 1062,
    'INSERT INTO teacher_schools (teacher_id, school_id, teacher_code) VALUES (4, 1, ''26560053'')');
CALL lb_test_expect_error('Duplicate email', 1062,
    'INSERT INTO users (full_name, email, password_hash, role) VALUES (''Duplicate'', ''teacher-a@example.invalid'', ''demo-placeholder'', ''teacher'')');
CALL lb_test_expect_error('Noncanonical email', 3819,
    'INSERT INTO users (full_name, email, password_hash, role) VALUES (''Example'', ''TEACHER@example.invalid'', ''demo-placeholder'', ''teacher'')');
CALL lb_test_expect_error('Missing school FK', 1452,
    'INSERT INTO teacher_schools (teacher_id, school_id, teacher_code) VALUES (4, 0, ''26560053'')');
CALL lb_test_expect_error('Missing owner FK', 1452,
    'INSERT INTO resources (owner_id, review_scope) VALUES (0, ''government'')');
CALL lb_test_expect_error('School scope with no school', 3819,
    'INSERT INTO resources (owner_id, review_scope) VALUES (4, ''school'')');
CALL lb_test_expect_error('Government scope with a school', 3819,
    'INSERT INTO resources (owner_id, review_scope, review_school_id) VALUES (4, ''government'', 1)');
CALL lb_test_expect_error('School admin without school', 3819,
    'INSERT INTO users (full_name, email, password_hash, role) VALUES (''Example'', ''negative-admin@example.invalid'', ''demo-placeholder'', ''school_admin'')');
CALL lb_test_expect_error('Teacher with direct school', 3819,
    'INSERT INTO users (full_name, email, password_hash, role, school_id) VALUES (''Example'', ''negative-teacher@example.invalid'', ''demo-placeholder'', ''teacher'', 1)');
CALL lb_test_expect_error('Rejected review without note', 3819,
    'UPDATE resource_reviews SET decision = ''rejected'', reviewer_id = 2, reviewed_at = submitted_at WHERE version_id = 2');
CALL lb_test_expect_error('Rejected review with whitespace note', 3819,
    'UPDATE resource_reviews SET decision = ''rejected'', reviewer_id = 2, reviewed_at = submitted_at, review_note = CHAR(9, 10) WHERE version_id = 2');
CALL lb_test_expect_error('Pending review with reviewer', 3819,
    'UPDATE resource_reviews SET reviewer_id = 2 WHERE version_id = 2');
CALL lb_test_expect_error('Final review with no timestamp', 3819,
    'UPDATE resource_reviews SET decision = ''approved'', reviewer_id = 2 WHERE version_id = 2');
CALL lb_test_expect_error('Review timestamp before submission', 3819,
    'UPDATE resource_reviews SET decision = ''approved'', reviewer_id = 2, reviewed_at = submitted_at - INTERVAL 1 SECOND WHERE version_id = 2');
CALL lb_test_expect_error('Duplicate review for a version', 1062,
    'INSERT INTO resource_reviews (version_id) VALUES (2)');
CALL lb_test_expect_error('Publish a version from another resource', 1452,
    'UPDATE resources SET published_version_id = 5 WHERE id = 1');
CALL lb_test_expect_error('Published resource without a version', 3819,
    'UPDATE resources SET published_version_id = NULL WHERE id = 1');
CALL lb_test_expect_error('Hidden resource with a version', 3819,
    'UPDATE resources SET publication_status = ''hidden'' WHERE id = 1');
CALL lb_test_expect_error('Zero version number', 3819,
    'INSERT INTO resource_versions (resource_id, version_number, title, description, author_name, category, education_level, resource_type, file_path, source_url, rights_basis, access_level) VALUES (1, 0, ''Test'', '''', ''Author'', ''Math'', ''Primary'', ''authored_document'', NULL, NULL, ''unknown'', ''restricted'')');
CALL lb_test_expect_error('Duplicate version number', 1062,
    'INSERT INTO resource_versions (resource_id, version_number, title, description, author_name, category, education_level, resource_type, file_path, source_url, rights_basis, access_level) VALUES (1, 1, ''Test'', '''', ''Author'', ''Math'', ''Primary'', ''authored_document'', NULL, NULL, ''unknown'', ''restricted'')');
CALL lb_test_expect_error('Missing PDF path', 3819,
    'INSERT INTO resource_versions (resource_id, version_number, title, description, author_name, category, education_level, resource_type, file_path, source_url, rights_basis, access_level) VALUES (1, 99, ''Test'', '''', ''Author'', ''Math'', ''Primary'', ''pdf'', NULL, NULL, ''own_work'', ''restricted'')');
CALL lb_test_expect_error('Missing external URL', 3819,
    'INSERT INTO resource_versions (resource_id, version_number, title, description, author_name, category, education_level, resource_type, file_path, source_url, rights_basis, access_level) VALUES (1, 99, ''Test'', '''', ''Author'', ''Math'', ''Primary'', ''external_link'', NULL, NULL, ''official_link'', ''restricted'')');
CALL lb_test_expect_error('Unknown rights with public access', 3819,
    'INSERT INTO resource_versions (resource_id, version_number, title, description, author_name, category, education_level, resource_type, file_path, source_url, rights_basis, access_level) VALUES (1, 99, ''Test'', '''', ''Author'', ''Math'', ''Primary'', ''authored_document'', NULL, NULL, ''unknown'', ''public'')');
CALL lb_test_expect_error('Referenced school cannot be deleted', 1451,
    'DELETE FROM schools WHERE id = 1');

DROP PROCEDURE lb_test_expect_error;
