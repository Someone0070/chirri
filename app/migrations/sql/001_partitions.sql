-- check_results partitioned table (managed outside Drizzle)
-- Run AFTER drizzle-kit push

CREATE TABLE IF NOT EXISTS check_results (
    id                  TEXT NOT NULL,
    shared_url_id       TEXT NOT NULL,
    status_code         INT,
    response_time_ms    INT,
    body_size_bytes     INT,
    error               TEXT,
    error_category      TEXT CHECK (error_category IN ('transient','permanent','internal')),
    full_hash           TEXT,
    stable_hash         TEXT,
    schema_hash         TEXT,
    header_hash         TEXT,
    body_r2_key         TEXT,
    change_detected     BOOLEAN NOT NULL DEFAULT FALSE,
    change_id           TEXT,
    is_learning         BOOLEAN NOT NULL DEFAULT FALSE,
    is_confirmation     BOOLEAN NOT NULL DEFAULT FALSE,
    worker_id           TEXT,
    checked_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, checked_at)
) PARTITION BY RANGE (checked_at);

CREATE INDEX IF NOT EXISTS idx_check_results_shared_url_time ON check_results (shared_url_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_results_change ON check_results (change_id) WHERE change_detected = TRUE;

-- Initial partitions
CREATE TABLE IF NOT EXISTS check_results_2026_03 PARTITION OF check_results
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS check_results_2026_04 PARTITION OF check_results
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS check_results_2026_05 PARTITION OF check_results
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
