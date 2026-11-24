-- Apply explicitly to the existing Learning Bridge schema. Infrastructure only.
CREATE TABLE IF NOT EXISTS auth_sessions (
    session_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at BIGINT UNSIGNED NOT NULL,
    data JSON NOT NULL,
    PRIMARY KEY (session_id),
    KEY ix_auth_sessions_expires_at (expires_at)
) ENGINE=InnoDB;
