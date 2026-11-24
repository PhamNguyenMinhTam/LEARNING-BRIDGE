-- Run once after 001. Stop all application writers before applying.
ALTER TABLE resources
    ADD COLUMN administrative_status ENUM('normal', 'withdrawn', 'legacy_hold') NOT NULL DEFAULT 'normal',
    ADD COLUMN withdrawn_at DATETIME NULL,
    ADD COLUMN withdrawn_by BIGINT UNSIGNED NULL,
    ADD COLUMN withdrawal_reason VARCHAR(2000) NULL,
    ADD COLUMN reinstated_at DATETIME NULL,
    ADD COLUMN reinstated_by BIGINT UNSIGNED NULL,
    ADD CONSTRAINT fk_resources_withdrawn_by FOREIGN KEY (withdrawn_by) REFERENCES users (id),
    ADD CONSTRAINT fk_resources_reinstated_by FOREIGN KEY (reinstated_by) REFERENCES users (id),
    DROP CHECK chk_resources_publication,
    ADD CONSTRAINT chk_resources_publication_state CHECK (
        (administrative_status = 'normal' AND (
            (publication_status = 'published' AND published_version_id IS NOT NULL)
            OR (publication_status = 'hidden' AND published_version_id IS NULL)))
        OR (administrative_status = 'withdrawn' AND publication_status = 'hidden' AND published_version_id IS NOT NULL
            AND withdrawn_at IS NOT NULL AND withdrawn_by IS NOT NULL AND withdrawal_reason IS NOT NULL
            AND REGEXP_LIKE(withdrawal_reason, '[^[:space:]]'))
        OR (administrative_status = 'legacy_hold' AND publication_status = 'hidden' AND published_version_id IS NULL)
    );

-- Earlier releases erased the pointer and did not identify administrative withdrawals.
-- Preserve any existing hold without claiming a withdrawal actually happened.
UPDATE resources r
SET administrative_status = 'legacy_hold'
WHERE r.publication_status = 'hidden' AND EXISTS (
    SELECT 1 FROM resource_versions v JOIN resource_reviews rv ON rv.version_id = v.id
    WHERE v.resource_id = r.id AND rv.decision = 'approved'
);
