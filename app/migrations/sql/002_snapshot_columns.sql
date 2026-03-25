-- Add snapshot content columns to check_results for the diff engine
-- These store the extracted text representations for each check

ALTER TABLE check_results ADD COLUMN IF NOT EXISTS raw_html TEXT;
ALTER TABLE check_results ADD COLUMN IF NOT EXISTS readability_text TEXT;
ALTER TABLE check_results ADD COLUMN IF NOT EXISTS text_only TEXT;
ALTER TABLE check_results ADD COLUMN IF NOT EXISTS structural_dom TEXT;
ALTER TABLE check_results ADD COLUMN IF NOT EXISTS fetch_tier INT DEFAULT 1;
ALTER TABLE check_results ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE check_results ADD COLUMN IF NOT EXISTS response_headers JSONB DEFAULT '{}';

-- Future partitions (if they don't exist yet)
CREATE TABLE IF NOT EXISTS check_results_2026_06 PARTITION OF check_results
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS check_results_2026_07 PARTITION OF check_results
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
