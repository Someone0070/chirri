# MCP Server Direct Monitoring Module - Design Document

**Version:** 1.0  
**Date:** 2026-03-25  
**Author:** Codex (Design Subagent)  
**Status:** Ready for Implementation

---

## Executive Summary

This design adds **MCP (Model Context Protocol) server monitoring** to Chirri as a new source type. While most MCP servers will be caught by existing HTTP monitoring (via their docs, changelogs, GitHub repos), this module fills the gap for:

1. **Undocumented MCP servers** (no formal docs or changelog)
2. **Direct tool-level monitoring** (detect schema changes before they're announced)
3. **Breaking change detection** (tool signature changes that break integrations)

The module connects to MCP servers via SSE/HTTP transport, snapshots their `tools/list` definitions, diffs against previous snapshots, and generates change reports with impact analysis.

---

## Architecture Overview

### Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Source type** | New `source_type = 'mcp_server'` in existing `urls` table | Simplest integration. Scheduler already queries `urls` for due checks. No new tables needed. |
| **Transport** | HTTP/SSE only (no stdio spawn) | Production safety: can't spawn arbitrary user packages. Covers hosted MCP servers (Smithery, etc). |
| **Diff strategy** | JSON deep diff (exact comparison) | Structured data = simpler than HTML diffing. No voting needed. Exact schema comparison. |
| **Discovery** | Parallel: HTTP sources + direct MCP snapshots | Monitor BOTH: announcements (via existing discovery) + actual tool definitions (via MCP). |
| **Impact analysis** | Rule-based classification (breaking vs non-breaking) | Clear rules: required param added = BREAKING. Optional param added = NON-BREAKING. |
| **Worker queue** | Extend existing `check-url` queue with new handler | Reuse scheduler, retry logic, rate limiting. Add MCP-specific handler branch. |

---

## 1. Data Model Changes

### 1.1 Schema Changes (`packages/shared/src/db/schema.ts`)

#### Add new column to `urls` table:

```typescript
export const urls = pgTable(
  'urls',
  {
    // ... existing columns ...
    
    // NEW: Source type discriminator
    sourceType: text('source_type').notNull().default('http'),
    // Values: 'http' | 'mcp_server'
    
    // NEW: MCP-specific config (only populated if sourceType = 'mcp_server')
    mcpConfig: jsonb('mcp_config').default({}),
    // Structure:
    // {
    //   transport: 'sse' | 'http',
    //   endpoint: string,          // e.g., 'https://mcp.example.com'
    //   authHeader?: string,       // Optional: 'Authorization: Bearer ...'
    //   serverInfo?: {
    //     name: string,
    //     version: string,
    //     vendor?: string
    //   }
    // }
    
    // ... existing columns ...
  },
  // ... existing indexes ...
);
```

#### Add new table `mcp_tool_snapshots`:

```typescript
export const mcpToolSnapshots = pgTable(
  'mcp_tool_snapshots',
  {
    id: text('id').primaryKey(), // mts_ + nanoid(21)
    sharedUrlId: text('shared_url_id')
      .notNull()
      .references(() => sharedUrls.id, { onDelete: 'cascade' }),
    
    // Full snapshot of tools/list response
    toolsJson: jsonb('tools_json').notNull(),
    // Structure: { tools: ToolDefinition[] }
    // ToolDefinition = { name, description, inputSchema }
    
    // Hash for quick change detection
    toolsHash: text('tools_hash').notNull(),
    // SHA-256 of canonical JSON (sorted keys)
    
    // Individual tool hashes for granular diff
    toolHashes: jsonb('tool_hashes').notNull(),
    // Structure: { [toolName]: sha256(canonicalJson(tool)) }
    
    // Server metadata at time of snapshot
    serverInfo: jsonb('server_info'),
    // Structure: { name, version, vendor, capabilities }
    
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_mcp_tool_snapshots_url').on(table.sharedUrlId, table.capturedAt),
    index('idx_mcp_tool_snapshots_hash').on(table.sharedUrlId, table.toolsHash),
  ],
);
```

### 1.2 Migration SQL

**File:** `packages/shared/migrations/00XX_add_mcp_monitoring.sql`

```sql
-- Add source_type column to urls table
ALTER TABLE urls ADD COLUMN source_type TEXT NOT NULL DEFAULT 'http';
ALTER TABLE urls ADD COLUMN mcp_config JSONB DEFAULT '{}';

-- Create index for faster MCP URL queries
CREATE INDEX idx_urls_source_type ON urls(source_type, next_check_at);

-- Create mcp_tool_snapshots table
CREATE TABLE mcp_tool_snapshots (
  id TEXT PRIMARY KEY,
  shared_url_id TEXT NOT NULL REFERENCES shared_urls(id) ON DELETE CASCADE,
  tools_json JSONB NOT NULL,
  tools_hash TEXT NOT NULL,
  tool_hashes JSONB NOT NULL,
  server_info JSONB,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_tool_snapshots_url ON mcp_tool_snapshots(shared_url_id, captured_at);
CREATE INDEX idx_mcp_tool_snapshots_hash ON mcp_tool_snapshots(shared_url_id, tools_hash);

-- Update shared_urls.content_type for MCP servers
-- (Will be set to 'mcp/tools-list' by the worker)

COMMENT ON COLUMN urls.source_type IS 'Source type: http (default) or mcp_server';
COMMENT ON COLUMN urls.mcp_config IS 'MCP-specific config (transport, endpoint, auth)';
COMMENT ON TABLE mcp_tool_snapshots IS 'Snapshots of MCP server tool definitions';
```

---

## 2. Worker Module Structure

### 2.1 File Organization

```
packages/worker/src/
├── checkers/
│   ├── mcp/
│   │   ├── client.ts           # MCP transport abstraction
│   │   ├── diff.ts             # Tool definition differ
│   │   ├── impact.ts           # Breaking change analysis
│   │   ├── snapshot.ts         # Snapshot storage logic
│   │   └── types.ts            # MCP types
│   ├── fetcher.ts              # (existing HTTP fetcher)
│   ├── pipeline.ts             # (existing voting pipeline)
│   └── ...
├── queues/
│   ├── check-url.ts            # (existing - extend with MCP handler)
│   └── ...
└── ...
```

### 2.2 Module Interfaces

#### `packages/worker/src/checkers/mcp/types.ts`

```typescript
/**
 * MCP Tool Definition (from MCP spec)
 */
export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: any;
  };
}

/**
 * MCP tools/list response
 */
export interface McpToolsListResponse {
  tools: McpToolDefinition[];
}

/**
 * MCP server info (from initialize)
 */
export interface McpServerInfo {
  name: string;
  version: string;
  vendor?: string;
  capabilities?: {
    tools?: { listChanged?: boolean };
    [key: string]: any;
  };
}

/**
 * MCP connection config
 */
export interface McpConnectionConfig {
  transport: 'sse' | 'http';
  endpoint: string;
  authHeader?: string;
  timeoutMs?: number;
}

/**
 * Tool change types
 */
export type ToolChangeType =
  | 'tool_added'
  | 'tool_removed'
  | 'schema_changed'
  | 'description_changed';

/**
 * Individual tool change
 */
export interface ToolChange {
  type: ToolChangeType;
  toolName: string;
  severity: 'breaking' | 'non-breaking';
  before?: McpToolDefinition;
  after?: McpToolDefinition;
  details: string;
  schemaPath?: string; // For schema changes: e.g., "properties.userId.type"
}

/**
 * Full diff result
 */
export interface McpDiffResult {
  hasChanges: boolean;
  changes: ToolChange[];
  summary: string;
  breakingChanges: number;
  nonBreakingChanges: number;
  addedTools: string[];
  removedTools: string[];
  modifiedTools: string[];
}
```

---

## 3. MCP Transport Abstraction

### 3.1 Client Implementation

**File:** `packages/worker/src/checkers/mcp/client.ts`

```typescript
import fetch from 'node-fetch';
import type {
  McpToolsListResponse,
  McpServerInfo,
  McpConnectionConfig,
} from './types.js';

/**
 * MCP client — supports SSE and HTTP transports
 */
export class McpClient {
  private config: McpConnectionConfig;

  constructor(config: McpConnectionConfig) {
    this.config = config;
  }

  /**
   * Connect to MCP server and get server info
   */
  async initialize(): Promise<McpServerInfo> {
    // MCP initialize request
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'chirri',
        version: '1.0.0',
      },
    });

    return response.serverInfo;
  }

  /**
   * Call tools/list to get all tool definitions
   */
  async listTools(): Promise<McpToolsListResponse> {
    const response = await this.sendRequest('tools/list', {});
    return response;
  }

  /**
   * Send JSON-RPC request to MCP server
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    const { endpoint, authHeader, timeoutMs = 30000 } = this.config;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`MCP error: ${data.error.message}`);
      }

      return data.result;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('MCP request timeout');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Factory function for creating MCP clients
 */
export function createMcpClient(config: McpConnectionConfig): McpClient {
  return new McpClient(config);
}
```

---

## 4. Diff Algorithm for Tool Definitions

### 4.1 Deep JSON Diff with Schema Awareness

**File:** `packages/worker/src/checkers/mcp/diff.ts`

```typescript
import { createHash } from 'crypto';
import type {
  McpToolDefinition,
  ToolChange,
  McpDiffResult,
} from './types.js';

/**
 * Canonicalize JSON (sorted keys) for hashing
 */
function canonicalJson(obj: any): string {
  if (obj === null) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const sorted = Object.keys(obj).sort();
  const pairs = sorted.map((k) => `"${k}":${canonicalJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Hash a tool definition
 */
export function hashTool(tool: McpToolDefinition): string {
  const canonical = canonicalJson(tool);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Diff two MCP tool snapshots
 */
export function diffMcpTools(
  before: McpToolDefinition[],
  after: McpToolDefinition[],
): McpDiffResult {
  const beforeMap = new Map(before.map((t) => [t.name, t]));
  const afterMap = new Map(after.map((t) => [t.name, t]));

  const changes: ToolChange[] = [];

  // 1. Find added tools
  for (const [name, tool] of afterMap) {
    if (!beforeMap.has(name)) {
      changes.push({
        type: 'tool_added',
        toolName: name,
        severity: 'non-breaking',
        after: tool,
        details: `New tool "${name}" added`,
      });
    }
  }

  // 2. Find removed tools
  for (const [name, tool] of beforeMap) {
    if (!afterMap.has(name)) {
      changes.push({
        type: 'tool_removed',
        toolName: name,
        severity: 'breaking',
        before: tool,
        details: `Tool "${name}" removed`,
      });
    }
  }

  // 3. Find modified tools
  for (const [name, beforeTool] of beforeMap) {
    const afterTool = afterMap.get(name);
    if (!afterTool) continue;

    const beforeHash = hashTool(beforeTool);
    const afterHash = hashTool(afterTool);

    if (beforeHash !== afterHash) {
      // Tool changed — analyze what changed
      const schemaChanges = diffToolSchema(beforeTool, afterTool);
      changes.push(...schemaChanges);

      // Check description change
      if (beforeTool.description !== afterTool.description) {
        changes.push({
          type: 'description_changed',
          toolName: name,
          severity: 'non-breaking',
          before: beforeTool,
          after: afterTool,
          details: `Description changed for "${name}"`,
        });
      }
    }
  }

  // Aggregate stats
  const breakingChanges = changes.filter((c) => c.severity === 'breaking').length;
  const nonBreakingChanges = changes.filter((c) => c.severity === 'non-breaking').length;
  const addedTools = changes.filter((c) => c.type === 'tool_added').map((c) => c.toolName);
  const removedTools = changes.filter((c) => c.type === 'tool_removed').map((c) => c.toolName);
  const modifiedTools = [
    ...new Set(
      changes
        .filter((c) => c.type !== 'tool_added' && c.type !== 'tool_removed')
        .map((c) => c.toolName),
    ),
  ];

  const hasChanges = changes.length > 0;
  const summary = buildSummary(changes, addedTools, removedTools, modifiedTools);

  return {
    hasChanges,
    changes,
    summary,
    breakingChanges,
    nonBreakingChanges,
    addedTools,
    removedTools,
    modifiedTools,
  };
}

/**
 * Diff tool input schemas
 */
function diffToolSchema(
  before: McpToolDefinition,
  after: McpToolDefinition,
): ToolChange[] {
  const changes: ToolChange[] = [];
  const beforeSchema = before.inputSchema;
  const afterSchema = after.inputSchema;

  // Check required parameters
  const beforeRequired = new Set(beforeSchema.required || []);
  const afterRequired = new Set(afterSchema.required || []);

  // Required parameter added = BREAKING
  for (const param of afterRequired) {
    if (!beforeRequired.has(param)) {
      changes.push({
        type: 'schema_changed',
        toolName: before.name,
        severity: 'breaking',
        before,
        after,
        details: `Required parameter "${param}" added to "${before.name}"`,
        schemaPath: `inputSchema.required[${param}]`,
      });
    }
  }

  // Required parameter removed = BREAKING
  for (const param of beforeRequired) {
    if (!afterRequired.has(param)) {
      changes.push({
        type: 'schema_changed',
        toolName: before.name,
        severity: 'breaking',
        before,
        after,
        details: `Required parameter "${param}" removed from "${before.name}"`,
        schemaPath: `inputSchema.required[${param}]`,
      });
    }
  }

  // Check parameter types
  const beforeProps = beforeSchema.properties || {};
  const afterProps = afterSchema.properties || {};

  // Parameter removed = BREAKING
  for (const param of Object.keys(beforeProps)) {
    if (!afterProps[param]) {
      changes.push({
        type: 'schema_changed',
        toolName: before.name,
        severity: 'breaking',
        before,
        after,
        details: `Parameter "${param}" removed from "${before.name}"`,
        schemaPath: `inputSchema.properties.${param}`,
      });
    }
  }

  // Parameter type changed = BREAKING
  for (const param of Object.keys(afterProps)) {
    if (beforeProps[param]) {
      const beforeType = beforeProps[param].type;
      const afterType = afterProps[param].type;
      if (beforeType !== afterType) {
        changes.push({
          type: 'schema_changed',
          toolName: before.name,
          severity: 'breaking',
          before,
          after,
          details: `Parameter "${param}" type changed from "${beforeType}" to "${afterType}" in "${before.name}"`,
          schemaPath: `inputSchema.properties.${param}.type`,
        });
      }
    } else {
      // New optional parameter = NON-BREAKING
      if (!afterRequired.has(param)) {
        changes.push({
          type: 'schema_changed',
          toolName: before.name,
          severity: 'non-breaking',
          before,
          after,
          details: `Optional parameter "${param}" added to "${before.name}"`,
          schemaPath: `inputSchema.properties.${param}`,
        });
      }
    }
  }

  return changes;
}

/**
 * Build human-readable summary
 */
function buildSummary(
  changes: ToolChange[],
  added: string[],
  removed: string[],
  modified: string[],
): string {
  const parts: string[] = [];

  if (added.length > 0) {
    parts.push(`${added.length} tool${added.length > 1 ? 's' : ''} added`);
  }
  if (removed.length > 0) {
    parts.push(`${removed.length} tool${removed.length > 1 ? 's' : ''} removed`);
  }
  if (modified.length > 0) {
    parts.push(`${modified.length} tool${modified.length > 1 ? 's' : ''} modified`);
  }

  const breakingCount = changes.filter((c) => c.severity === 'breaking').length;
  if (breakingCount > 0) {
    parts.push(`${breakingCount} BREAKING change${breakingCount > 1 ? 's' : ''}`);
  }

  return parts.join(', ') || 'No changes';
}
```

---

## 5. Impact Analysis Rules

### 5.1 Breaking Change Classification

**File:** `packages/worker/src/checkers/mcp/impact.ts`

```typescript
import type { ToolChange, McpDiffResult } from './types.js';

/**
 * Classify change severity for notifications
 */
export function classifyChangeSeverity(diff: McpDiffResult): 'critical' | 'high' | 'medium' | 'low' {
  if (diff.breakingChanges > 0) {
    // Any breaking change = critical
    return 'critical';
  }

  if (diff.removedTools.length > 0) {
    // Tool removal (should already be marked breaking, but double-check)
    return 'critical';
  }

  if (diff.modifiedTools.length > 5) {
    // Many tools modified = high priority
    return 'high';
  }

  if (diff.addedTools.length > 0) {
    // New tools = medium priority (informational)
    return 'medium';
  }

  // Only description changes = low priority
  return 'low';
}

/**
 * Generate impact report for humans
 */
export function generateImpactReport(diff: McpDiffResult): string {
  const lines: string[] = [];

  lines.push(`## MCP Server Change Detected\n`);
  lines.push(`**Summary:** ${diff.summary}\n`);

  if (diff.breakingChanges > 0) {
    lines.push(`⚠️ **BREAKING CHANGES: ${diff.breakingChanges}**\n`);
  }

  // Breaking changes first
  const breaking = diff.changes.filter((c) => c.severity === 'breaking');
  if (breaking.length > 0) {
    lines.push(`### Breaking Changes\n`);
    for (const change of breaking) {
      lines.push(`- **${change.toolName}**: ${change.details}`);
      if (change.schemaPath) {
        lines.push(`  - Path: \`${change.schemaPath}\``);
      }
    }
    lines.push('');
  }

  // Added tools
  if (diff.addedTools.length > 0) {
    lines.push(`### Tools Added (${diff.addedTools.length})\n`);
    for (const tool of diff.addedTools) {
      lines.push(`- \`${tool}\``);
    }
    lines.push('');
  }

  // Removed tools
  if (diff.removedTools.length > 0) {
    lines.push(`### Tools Removed (${diff.removedTools.length})\n`);
    for (const tool of diff.removedTools) {
      lines.push(`- \`${tool}\``);
    }
    lines.push('');
  }

  // Non-breaking modifications
  const nonBreaking = diff.changes.filter((c) => c.severity === 'non-breaking');
  if (nonBreaking.length > 0) {
    lines.push(`### Non-Breaking Changes (${nonBreaking.length})\n`);
    for (const change of nonBreaking) {
      lines.push(`- **${change.toolName}**: ${change.details}`);
    }
    lines.push('');
  }

  lines.push(`### Action Required\n`);
  if (diff.breakingChanges > 0) {
    lines.push(`- Review your integrations that use the modified tools`);
    lines.push(`- Update your code to handle schema changes`);
    lines.push(`- Test thoroughly before deploying`);
  } else {
    lines.push(`- Review changes for informational purposes`);
    lines.push(`- No immediate action required`);
  }

  return lines.join('\n');
}
```

---

## 6. Integration with Existing Systems

### 6.1 Extend `check-url` Queue

**File:** `packages/worker/src/queues/check-url.ts` (modifications)

```typescript
// Add to imports
import { createMcpClient } from '../checkers/mcp/client.js';
import { diffMcpTools, hashTool } from '../checkers/mcp/diff.js';
import { classifyChangeSeverity, generateImpactReport } from '../checkers/mcp/impact.js';
import { nanoid } from 'nanoid';

// Modify worker processor
export function createCheckUrlWorker(): Worker<CheckUrlJobData> {
  return new Worker<CheckUrlJobData>(
    'check-url',
    async (job) => {
      const { urlId, url, userId, sharedUrlId } = job.data;

      console.log(`[check-url] Processing job=${job.id} url=${url}`);

      // Get URL record to check source_type
      const urlRows = await db
        .select()
        .from(schema.urls)
        .where(eq(schema.urls.id, urlId))
        .limit(1);

      const urlRecord = urlRows[0];
      if (!urlRecord) {
        throw new Error(`URL not found: ${urlId}`);
      }

      // Branch based on source type
      if (urlRecord.sourceType === 'mcp_server') {
        // NEW: MCP monitoring path
        return await checkMcpServer(urlRecord, userId, sharedUrlId);
      } else {
        // EXISTING: HTTP monitoring path
        return await checkHttpUrl(urlRecord, userId, sharedUrlId);
      }
    },
    {
      connection,
      concurrency: 5,
    },
  );
}

/**
 * NEW: Check MCP server for tool changes
 */
async function checkMcpServer(
  urlRecord: any,
  userId: string,
  sharedUrlId: string,
): Promise<void> {
  const { id: urlId, mcpConfig } = urlRecord;

  console.log(`[check-mcp] Checking MCP server: ${mcpConfig.endpoint}`);

  // Step 1: Connect to MCP server
  const client = createMcpClient({
    transport: mcpConfig.transport || 'http',
    endpoint: mcpConfig.endpoint,
    authHeader: mcpConfig.authHeader,
    timeoutMs: 30000,
  });

  let serverInfo;
  let toolsResponse;

  try {
    serverInfo = await client.initialize();
    toolsResponse = await client.listTools();
  } catch (err: any) {
    console.error(`[check-mcp] Failed to connect to MCP server:`, err);
    throw new Error(`MCP connection failed: ${err.message}`);
  }

  // Step 2: Hash current tools
  const currentToolsHash = createHash('sha256')
    .update(canonicalJson(toolsResponse))
    .digest('hex');

  const currentToolHashes: Record<string, string> = {};
  for (const tool of toolsResponse.tools) {
    currentToolHashes[tool.name] = hashTool(tool);
  }

  // Step 3: Get previous snapshot
  const previousSnapshots = await db
    .select()
    .from(schema.mcpToolSnapshots)
    .where(eq(schema.mcpToolSnapshots.sharedUrlId, sharedUrlId))
    .orderBy(desc(schema.mcpToolSnapshots.capturedAt))
    .limit(1);

  const previousSnapshot = previousSnapshots[0];

  // Step 4: Store current snapshot
  const snapshotId = `mts_${nanoid(21)}`;
  await db.insert(schema.mcpToolSnapshots).values({
    id: snapshotId,
    sharedUrlId,
    toolsJson: toolsResponse,
    toolsHash: currentToolsHash,
    toolHashes: currentToolHashes,
    serverInfo,
    capturedAt: new Date(),
    createdAt: new Date(),
  });

  console.log(`[check-mcp] Stored snapshot: ${snapshotId}`);

  // Step 5: If no previous snapshot, we're done (baseline)
  if (!previousSnapshot) {
    console.log(`[check-mcp] No previous snapshot — stored baseline`);
    await updateCheckTimestamps(urlId, sharedUrlId);
    return;
  }

  // Step 6: Check if tools changed
  if (previousSnapshot.toolsHash === currentToolsHash) {
    console.log(`[check-mcp] No changes detected`);
    await updateCheckTimestamps(urlId, sharedUrlId);
    return;
  }

  // Step 7: Tools changed — run diff
  const previousTools = previousSnapshot.toolsJson.tools;
  const currentTools = toolsResponse.tools;

  const diffResult = diffMcpTools(previousTools, currentTools);

  console.log(
    `[check-mcp] Changes detected: ${diffResult.summary} (${diffResult.breakingChanges} breaking)`,
  );

  // Step 8: Classify severity and generate report
  const severity = classifyChangeSeverity(diffResult);
  const impactReport = generateImpactReport(diffResult);

  // Step 9: Store change
  const changeId = await storeChange(sharedUrlId, userId, urlId, {
    changeType: 'structural', // MCP tool changes are structural
    severity,
    confidence: 100, // MCP changes are exact (no heuristics)
    summary: diffResult.summary,
    diff: {
      ...diffResult,
      impactReport,
    },
    previousSnapshotId: previousSnapshot.id,
    currentSnapshotId: snapshotId,
  });

  console.log(`[check-mcp] Change stored: ${changeId}`);

  // Step 10: Queue notification
  await notificationQueue.add('notify', {
    userId,
    changeId,
  });

  console.log(`[check-mcp] Notification queued for change=${changeId}`);

  // Step 11: Update timestamps
  await updateCheckTimestamps(urlId, sharedUrlId);
}

/**
 * EXISTING: Check HTTP URL (renamed for clarity)
 */
async function checkHttpUrl(
  urlRecord: any,
  userId: string,
  sharedUrlId: string,
): Promise<void> {
  // ... existing check-url logic ...
  // (Keep the existing implementation from the original file)
}

// Helper imports
import { createHash } from 'crypto';
import { desc } from 'drizzle-orm';

function canonicalJson(obj: any): string {
  if (obj === null) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const sorted = Object.keys(obj).sort();
  const pairs = sorted.map((k) => `"${k}":${canonicalJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}
```

### 6.2 Discovery Integration

**File:** `packages/worker/src/discovery/orchestrator.ts` (modifications)

```typescript
// Add MCP detection to discovery process

/**
 * NEW: Detect if a domain offers MCP endpoints
 */
async function detectMcpEndpoint(domain: string): Promise<string | null> {
  const probeUrls = [
    `https://${domain}/mcp`,
    `https://${domain}/.well-known/mcp`,
    `https://mcp.${domain}`,
    `https://api.${domain}/mcp`,
  ];

  for (const url of probeUrls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'chirri-discovery', version: '1.0.0' },
          },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result?.serverInfo) {
          console.log(`[discovery] Found MCP endpoint: ${url}`);
          return url;
        }
      }
    } catch {
      // Probe failed, try next
    }
  }

  return null;
}

// Modify discoverDomain to include MCP detection
export async function discoverDomain(domain: string): Promise<DomainResult> {
  // ... existing discovery logic ...

  // NEW: Add MCP endpoint detection
  const mcpEndpoint = await detectMcpEndpoint(baseDomain);
  if (mcpEndpoint) {
    discovered.mcp_server = [{
      type: 'mcp_server',
      url: mcpEndpoint,
      confidence: 100,
      method: 'mcp_probe',
    }];
  }

  return {
    domain: baseDomain,
    discovered: {
      docs,
      changelog,
      status,
      openapi,
      mcp_server: discovered.mcp_server || [], // NEW
    },
    // ... rest of result ...
  };
}
```

---

## 7. Scheduler Integration

The existing scheduler in Chirri queries `urls.next_check_at` to find URLs due for checking. No changes needed — MCP servers will be scheduled the same way as HTTP URLs.

**Key points:**
- MCP servers get a `check_interval` (e.g., `6h` for faster detection of tool changes)
- The scheduler will call `checkUrlQueue.add()` for MCP URLs just like HTTP URLs
- The `check-url` worker will branch based on `source_type`

---

## 8. Notification System Integration

No changes needed. The existing notification queue will work for MCP changes:

1. Worker stores change in `changes` table
2. Worker queues notification in `notifications` queue
3. Notification worker sends email/webhook/etc.

**Special considerations for MCP notifications:**
- Include full impact report in email body
- Highlight breaking changes prominently
- Link to MCP server documentation (if available)
- Suggest migration actions

---

## 9. API Changes (User-Facing)

### 9.1 Add MCP Server Endpoint

**File:** `packages/api/src/routes/urls.ts` (new endpoint)

```typescript
/**
 * POST /api/urls/mcp
 * Add an MCP server for monitoring
 */
app.post('/api/urls/mcp', requireAuth, async (req, res) => {
  const { endpoint, name, checkInterval, authHeader } = req.body;

  // Validate endpoint
  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  // Test connection
  try {
    const client = createMcpClient({
      transport: 'http',
      endpoint,
      authHeader,
      timeoutMs: 10000,
    });

    const serverInfo = await client.initialize();
    const toolsResponse = await client.listTools();

    console.log(
      `[api] MCP server ${endpoint} connected: ${toolsResponse.tools.length} tools`,
    );

    // Create URL record
    const urlId = `url_${nanoid(21)}`;
    const urlHash = createHash('sha256').update(endpoint).digest('hex');
    const sharedUrlId = `surl_${nanoid(21)}`;

    await db.transaction(async (tx) => {
      // Create shared URL
      await tx.insert(schema.sharedUrls).values({
        id: sharedUrlId,
        urlHash,
        url: endpoint,
        domain: new URL(endpoint).hostname,
        effectiveInterval: checkInterval || '6h',
        subscriberCount: 1,
        contentType: 'mcp/tools-list',
        monitoringMethod: 'mcp',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create user URL
      await tx.insert(schema.urls).values({
        id: urlId,
        userId: req.user!.id,
        url: endpoint,
        urlHash,
        name: name || `${serverInfo.name} (MCP)`,
        sourceType: 'mcp_server', // NEW
        mcpConfig: {
          transport: 'http',
          endpoint,
          authHeader,
          serverInfo,
        },
        checkInterval: checkInterval || '6h',
        status: 'active',
        sharedUrlId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Queue initial check
    await checkUrlQueue.add('check', {
      urlId,
      url: endpoint,
      userId: req.user!.id,
      sharedUrlId,
    });

    res.json({
      success: true,
      urlId,
      serverInfo,
      toolCount: toolsResponse.tools.length,
    });
  } catch (err: any) {
    console.error(`[api] MCP connection failed:`, err);
    res.status(400).json({
      error: 'Failed to connect to MCP server',
      message: err.message,
    });
  }
});
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

**File:** `packages/worker/src/checkers/mcp/diff.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { diffMcpTools, hashTool } from './diff.js';

describe('MCP Diff', () => {
  it('detects tool addition', () => {
    const before = [
      { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object' } },
    ];
    const after = [
      { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object' } },
      { name: 'write_file', description: 'Write a file', inputSchema: { type: 'object' } },
    ];

    const result = diffMcpTools(before, after);
    expect(result.hasChanges).toBe(true);
    expect(result.addedTools).toEqual(['write_file']);
    expect(result.breakingChanges).toBe(0);
  });

  it('detects tool removal as breaking', () => {
    const before = [
      { name: 'read_file', description: 'Read', inputSchema: { type: 'object' } },
      { name: 'write_file', description: 'Write', inputSchema: { type: 'object' } },
    ];
    const after = [
      { name: 'read_file', description: 'Read', inputSchema: { type: 'object' } },
    ];

    const result = diffMcpTools(before, after);
    expect(result.removedTools).toEqual(['write_file']);
    expect(result.breakingChanges).toBe(1);
  });

  it('detects required parameter addition as breaking', () => {
    const before = [
      {
        name: 'create_user',
        description: 'Create user',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      },
    ];
    const after = [
      {
        name: 'create_user',
        description: 'Create user',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name', 'email'],
        },
      },
    ];

    const result = diffMcpTools(before, after);
    expect(result.breakingChanges).toBeGreaterThan(0);
    expect(result.changes.some((c) => c.details.includes('email'))).toBe(true);
  });

  it('detects optional parameter addition as non-breaking', () => {
    const before = [
      {
        name: 'create_user',
        description: 'Create user',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      },
    ];
    const after = [
      {
        name: 'create_user',
        description: 'Create user',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name'],
        },
      },
    ];

    const result = diffMcpTools(before, after);
    expect(result.nonBreakingChanges).toBeGreaterThan(0);
    expect(result.breakingChanges).toBe(0);
  });
});
```

### 10.2 Integration Tests

**File:** `packages/worker/src/queues/check-url.test.ts` (additions)

```typescript
describe('MCP Server Monitoring', () => {
  it('stores baseline snapshot for new MCP server', async () => {
    // Setup: Mock MCP server
    // Test: Add MCP URL, run check
    // Assert: Snapshot stored, no change detected
  });

  it('detects tool changes and creates notification', async () => {
    // Setup: Store baseline, modify mock MCP server
    // Test: Run check
    // Assert: Change detected, notification queued
  });

  it('classifies breaking changes as critical severity', async () => {
    // Setup: Baseline with tool, mock server removes tool
    // Test: Run check
    // Assert: severity === 'critical'
  });
});
```

---

## 11. Deployment Plan

### Phase 1: Core Infrastructure (Week 1)
1. Run migration to add `source_type`, `mcp_config`, `mcp_tool_snapshots`
2. Deploy MCP client module (`client.ts`, `types.ts`)
3. Deploy diff engine (`diff.ts`)
4. Deploy impact analysis (`impact.ts`)

### Phase 2: Worker Integration (Week 2)
1. Extend `check-url` queue with MCP handler
2. Deploy snapshot storage logic
3. Test with mock MCP server

### Phase 3: Discovery & API (Week 3)
1. Add MCP endpoint detection to discovery
2. Deploy `/api/urls/mcp` endpoint
3. Add UI for adding MCP servers

### Phase 4: Polish & Launch (Week 4)
1. Improve notification templates for MCP changes
2. Add MCP-specific dashboard views
3. Documentation & blog post
4. Launch to beta users

---

## 12. Performance Considerations

### 12.1 Rate Limiting
- MCP servers may rate-limit `tools/list` calls
- Default check interval: `6h` (vs `24h` for HTTP)
- Respect server rate limits (implement exponential backoff)

### 12.2 Snapshot Storage
- MCP snapshots are smaller than HTML (JSON only)
- Store full `tools_json` in PostgreSQL (< 100KB typically)
- No need for R2 storage (unlike HTML snapshots)

### 12.3 Diff Performance
- JSON diff is fast (< 10ms for 100 tools)
- No LLM calls needed (unlike HTML change analysis)
- Pure algorithmic comparison

---

## 13. Security Considerations

### 13.1 Authentication
- Support `Authorization` header for private MCP servers
- Store auth tokens in `url_secrets` table (encrypted)
- Never log auth headers

### 13.2 SSRF Protection
- Validate MCP endpoint URLs (no `localhost`, `127.0.0.1`, private IPs)
- Enforce HTTPS for production
- Timeout protection (30s max)

### 13.3 Malicious Servers
- Limit tool count (max 1000 tools per server)
- Limit tool definition size (max 10KB per tool)
- Validate JSON structure before storing

---

## 14. Future Enhancements

### 14.1 Stdio Transport Support
- Allow users to monitor local MCP servers (via stdio)
- Requires agent deployment (OpenClaw, etc.)
- Not v1 scope — add later

### 14.2 Tool Deprecation Warnings
- Parse `deprecated: true` in tool schemas
- Generate forecast alerts (like HTTP deprecation headers)

### 14.3 Tool Usage Analytics
- Track which tools users actually call (via integrations)
- Alert on removal of frequently-used tools

### 14.4 Semantic Versioning Detection
- Parse `serverInfo.version` and detect major bumps
- Auto-increase check frequency after major version

---

## 15. Success Metrics

**Key metrics to track:**
- Number of MCP servers monitored
- Breaking changes detected per week
- Notification open rate for MCP changes
- User feedback on impact reports
- False positive rate (changes detected but not real)

**Target for v1 launch:**
- Support 100+ MCP servers
- < 1% false positive rate
- 90%+ notification open rate for breaking changes

---

## Appendix A: Example MCP Change Notification

**Email Subject:** [BREAKING] MCP Server "example-mcp" Tool Changes Detected

**Email Body:**

```
## MCP Server Change Detected

**Server:** example-mcp (https://mcp.example.com)
**Summary:** 2 tools modified, 1 BREAKING change

⚠️ **BREAKING CHANGES: 1**

### Breaking Changes

- **create_user**: Required parameter "email" added to "create_user"
  - Path: `inputSchema.required[email]`

### Non-Breaking Changes (1)

- **get_user**: Optional parameter "includeProfile" added to "get_user"

### Action Required

- Review your integrations that use the modified tools
- Update your code to handle schema changes
- Test thoroughly before deploying

---

[View Full Diff] [Manage Alerts] [Feedback]
```

---

## Appendix B: File Path Summary

**New files to create:**
- `packages/worker/src/checkers/mcp/types.ts`
- `packages/worker/src/checkers/mcp/client.ts`
- `packages/worker/src/checkers/mcp/diff.ts`
- `packages/worker/src/checkers/mcp/impact.ts`
- `packages/worker/src/checkers/mcp/snapshot.ts`
- `packages/worker/src/checkers/mcp/diff.test.ts`
- `packages/api/src/routes/mcp.ts`
- `packages/shared/migrations/00XX_add_mcp_monitoring.sql`

**Files to modify:**
- `packages/shared/src/db/schema.ts` (add columns, new table)
- `packages/worker/src/queues/check-url.ts` (add MCP handler branch)
- `packages/worker/src/discovery/orchestrator.ts` (add MCP detection)

---

## End of Design Document

**Status:** Ready for implementation  
**Estimated effort:** 2-3 weeks (1 senior engineer)  
**Dependencies:** None (uses existing infrastructure)  
**Risk level:** Low (isolated module, no breaking changes to existing system)
