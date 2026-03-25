-- 003_mcp_monitoring.sql
-- Add MCP server monitoring support
--
-- Changes:
--   1. Add source_type and mcp_config columns to urls table
--   2. Create mcp_tool_snapshots table for tool definition snapshots
--   3. Add indexes for efficient MCP queries

-- ─── 1. URLs table changes ──────────────────────────────────────────────────

-- Source type discriminator: 'http' (default) or 'mcp_server'
ALTER TABLE urls ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'http';

-- MCP-specific config (transport, endpoint, auth, serverInfo)
ALTER TABLE urls ADD COLUMN IF NOT EXISTS mcp_config JSONB DEFAULT '{}';

-- Index for filtering by source type + scheduling
CREATE INDEX IF NOT EXISTS idx_urls_source_type ON urls(source_type, next_check_at);

-- ─── 2. MCP Tool Snapshots table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcp_tool_snapshots (
  id TEXT PRIMARY KEY,
  shared_url_id TEXT NOT NULL REFERENCES shared_urls(id) ON DELETE CASCADE,

  -- Full snapshot of tools/list response
  tools_json JSONB NOT NULL,

  -- SHA-256 of canonical JSON for quick change detection
  tools_hash TEXT NOT NULL,

  -- Per-tool hashes for granular diff: { [toolName]: sha256 }
  tool_hashes JSONB NOT NULL,

  -- Server metadata at time of snapshot
  server_info JSONB,

  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index: latest snapshot per URL
CREATE INDEX IF NOT EXISTS idx_mcp_tool_snapshots_url
  ON mcp_tool_snapshots(shared_url_id, captured_at);

-- Hash lookup: quick "has anything changed?" check
CREATE INDEX IF NOT EXISTS idx_mcp_tool_snapshots_hash
  ON mcp_tool_snapshots(shared_url_id, tools_hash);

-- ─── 3. Comments ────────────────────────────────────────────────────────────

COMMENT ON COLUMN urls.source_type IS 'Source type: http (default) or mcp_server';
COMMENT ON COLUMN urls.mcp_config IS 'MCP-specific config: { transport, endpoint, authHeader, serverInfo }';
COMMENT ON TABLE mcp_tool_snapshots IS 'Snapshots of MCP server tool definitions for change detection';
