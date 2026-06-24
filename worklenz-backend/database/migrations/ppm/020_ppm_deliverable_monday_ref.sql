-- PPM Migration 020: Monday external-ref for forward-mirror idempotency
--
-- Adds a nullable, UNIQUE external reference column to ppm_deliverables so the
-- Monday -> taskflow forward-mirror (one-way create-mirror) can be idempotent:
-- a given Monday item id is mirrored to at most one deliverable, and re-runs /
-- retries never double-create.
--
-- ADDITIVE ONLY. Touches a ppm_ extension table — no Worklenz-core tables.
-- Nullable so existing portal/admin-created deliverables (no Monday origin) are
-- unaffected. The partial UNIQUE index ignores NULLs, so many native
-- deliverables can coexist while each Monday item maps to one row.

BEGIN;

ALTER TABLE ppm_deliverables
    ADD COLUMN IF NOT EXISTS monday_item_id BIGINT;

-- One deliverable per Monday item (NULLs allowed and not deduplicated).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ppm_deliverables_monday_item_id
    ON ppm_deliverables (monday_item_id)
    WHERE monday_item_id IS NOT NULL;

COMMENT ON COLUMN ppm_deliverables.monday_item_id IS
    'External ref: source Monday.com item id when this deliverable was created by the Monday->taskflow forward-mirror. NULL for natively-created deliverables. UNIQUE (partial) for mirror idempotency.';

COMMIT;
