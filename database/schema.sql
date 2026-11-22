-- MySQL 8.4 LTS. Run once in a selected, empty development schema.
CREATE TABLE schools (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    school_code VARCHAR(30) COLLATE utf8mb4_0900_as_ci NOT NULL,
    school_name VARCHAR(200) NOT NULL,
    teacher_id_pattern VARCHAR(255) NOT NULL,
    status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_schools_code (school_code),
    CONSTRAINT chk_schools_metadata CHECK (
        CHAR_LENGTH(school_code) > 0
        AND NOT REGEXP_LIKE(school_code, '[[:space:]]')
        AND REGEXP_LIKE(school_name, '[^[:space:]]')
        AND REGEXP_LIKE(teacher_id_pattern, '[^[:space:]]')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) COLLATE utf8mb4_0900_bin NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('teacher', 'school_admin', 'government') NOT NULL,
    school_id BIGINT UNSIGNED NULL DEFAULT NULL,
    status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY ix_users_school (school_id),
    CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES schools (id),
    CONSTRAINT chk_users_role_school CHECK (
        (role = 'school_admin' AND school_id IS NOT NULL)
        OR (role IN ('teacher', 'government') AND school_id IS NULL)
    ),
    CONSTRAINT chk_users_email_normalized CHECK (
        email = LOWER(email) AND CHAR_LENGTH(email) > 0
        AND NOT REGEXP_LIKE(email, '[[:space:]]')
    ),
    CONSTRAINT chk_users_name_hash CHECK (
        REGEXP_LIKE(full_name, '[^[:space:]]') AND REGEXP_LIKE(password_hash, '[^[:space:]]')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE teacher_schools (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    teacher_id BIGINT UNSIGNED NOT NULL,
    school_id BIGINT UNSIGNED NOT NULL,
    teacher_code VARCHAR(100) NOT NULL,
    pattern_checked_at DATETIME NULL DEFAULT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_teacher_schools_pair (teacher_id, school_id),
    KEY ix_teacher_schools_school (school_id),
    CONSTRAINT fk_teacher_schools_teacher FOREIGN KEY (teacher_id) REFERENCES users (id),
    CONSTRAINT fk_teacher_schools_school FOREIGN KEY (school_id) REFERENCES schools (id),
    CONSTRAINT chk_teacher_schools_code CHECK (REGEXP_LIKE(teacher_code, '[^[:space:]]'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE resources (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_id BIGINT UNSIGNED NOT NULL,
    review_scope ENUM('school', 'government') NOT NULL,
    review_school_id BIGINT UNSIGNED NULL DEFAULT NULL,
    published_version_id BIGINT UNSIGNED NULL DEFAULT NULL,
    publication_status ENUM('hidden', 'published') NOT NULL DEFAULT 'hidden',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_resources_owner (owner_id),
    KEY ix_resources_school_scope (review_school_id, review_scope),
    KEY ix_resources_publication (publication_status),
    KEY ix_resources_published_version (id, published_version_id),
    CONSTRAINT fk_resources_owner FOREIGN KEY (owner_id) REFERENCES users (id),
    CONSTRAINT fk_resources_school FOREIGN KEY (review_school_id) REFERENCES schools (id),
    CONSTRAINT chk_resources_review_scope CHECK (
        (review_scope = 'school' AND review_school_id IS NOT NULL)
        OR (review_scope = 'government' AND review_school_id IS NULL)
    ),
    CONSTRAINT chk_resources_publication CHECK (
        (publication_status = 'published' AND published_version_id IS NOT NULL)
        OR (publication_status = 'hidden' AND published_version_id IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE resource_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    resource_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    author_name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    education_level VARCHAR(100) NOT NULL,
    resource_type ENUM('pdf', 'external_link', 'authored_document') NOT NULL,
    file_path VARCHAR(500) NULL DEFAULT NULL,
    source_url VARCHAR(2048) NULL DEFAULT NULL,
    rights_basis VARCHAR(100) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'unknown',
    access_level ENUM('public', 'restricted') NOT NULL DEFAULT 'restricted',
    edit_state ENUM('draft', 'submitted') NOT NULL DEFAULT 'draft',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_resource_versions_number (resource_id, version_number),
    UNIQUE KEY uq_resource_versions_parent_id (resource_id, id),
    CONSTRAINT fk_resource_versions_resource FOREIGN KEY (resource_id) REFERENCES resources (id),
    CONSTRAINT chk_resource_versions_number CHECK (version_number > 0),
    CONSTRAINT chk_resource_versions_payload CHECK (
        (resource_type <> 'external_link'
            OR (source_url IS NOT NULL AND REGEXP_LIKE(source_url, '[^[:space:]]')))
        AND (resource_type <> 'pdf'
            OR (file_path IS NOT NULL AND REGEXP_LIKE(file_path, '[^[:space:]]')))
    ),
    CONSTRAINT chk_resource_versions_rights CHECK (
        rights_basis IN ('own_work', 'open_license', 'authorized_distribution', 'official_link', 'unknown')
        AND (access_level <> 'public' OR rights_basis <> 'unknown')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add the circular reference once both tables exist.
ALTER TABLE resources
    ADD CONSTRAINT fk_resources_published_version
    FOREIGN KEY (id, published_version_id) REFERENCES resource_versions (resource_id, id);

CREATE TABLE resource_reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    version_id BIGINT UNSIGNED NOT NULL,
    reviewer_id BIGINT UNSIGNED NULL DEFAULT NULL,
    decision ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    review_note TEXT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_resource_reviews_version (version_id),
    KEY ix_resource_reviews_reviewer (reviewer_id),
    KEY ix_resource_reviews_decision_queue (decision, submitted_at),
    CONSTRAINT fk_resource_reviews_version FOREIGN KEY (version_id) REFERENCES resource_versions (id),
    CONSTRAINT fk_resource_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id),
    CONSTRAINT chk_resource_reviews_finalization CHECK (
        (decision = 'pending' AND reviewer_id IS NULL AND reviewed_at IS NULL)
        OR (decision IN ('approved', 'rejected') AND reviewer_id IS NOT NULL
            AND reviewed_at IS NOT NULL AND reviewed_at >= submitted_at)
    ),
    CONSTRAINT chk_resource_reviews_rejection_note CHECK (
        decision <> 'rejected' OR (review_note IS NOT NULL AND REGEXP_LIKE(review_note, '[^[:space:]]'))
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
