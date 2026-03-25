/**
 * MCP Monitoring Pipeline
 *
 * Orchestrates the full MCP server check:
 * 1. Connect to MCP server
 * 2. Fetch tools/list
 * 3. Snapshot current tools
 * 4. Compare against previous snapshot
 * 5. Run diff + impact analysis
 * 6. Store changes and queue notifications
 */

import { createHash } from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@chirri/shared';
import { createId } from '@chirri/shared/src/utils/id.js';
import { storeChange } from '@chirri/shared/src/services/snapshot-store.js';
import { notificationQueue } from '../../queues/notifications.js';
import { createMcpClient } from './client.js';
import { diffMcpTools, canonicalJson, hashTool, hashToolsList } from './differ.js';
import { classifyChangeSeverity, generateImpactReport } from './impact.js';
import type { McpConnectionConfig, McpToolDefinition } from './types.js';

const mcpToolSnapshotId = () => createId('mts_');

export interface McpCheckOptions {
  urlId: string;
  userId: string;
  sharedUrlId: string;
  mcpConfig: {
    transport?: 'sse' | 'http';
    endpoint: string;
    authHeader?: string;
    serverInfo?: {
      name: string;
      version: string;
      vendor?: string;
    };
  };
}

/**
 * Run the full MCP monitoring pipeline for a single server.
 */
export async function checkMcpServer(options: McpCheckOptions): Promise<void> {
  const { urlId, userId, sharedUrlId, mcpConfig } = options;

  console.log(`[check-mcp] Checking MCP server: ${mcpConfig.endpoint}`);

  // Step 1: Connect to MCP server
  const clientConfig: McpConnectionConfig = {
    transport: mcpConfig.transport || 'http',
    endpoint: mcpConfig.endpoint,
    authHeader: mcpConfig.authHeader,
    timeoutMs: 30_000,
  };

  const client = createMcpClient(clientConfig);
  let serverInfo;
  let toolsResponse;

  try {
    serverInfo = await client.initialize();
    toolsResponse = await client.listTools();
  } catch (err: any) {
    console.error(`[check-mcp] Failed to connect to MCP server:`, err.message);
    throw new Error(`MCP connection failed: ${err.message}`);
  } finally {
    await client.disconnect();
  }

  const tools: McpToolDefinition[] = toolsResponse.tools || [];
  console.log(
    `[check-mcp] Connected: ${serverInfo.name} v${serverInfo.version}, ${tools.length} tools`,
  );

  // Step 2: Hash current tools
  const currentToolsHash = hashToolsList(tools);
  const currentToolHashes: Record<string, string> = {};
  for (const tool of tools) {
    currentToolHashes[tool.name] = hashTool(tool);
  }

  // Step 3: Get previous snapshot
  const previousSnapshots = await db
    .select()
    .from(schema.mcpToolSnapshots)
    .where(eq(schema.mcpToolSnapshots.sharedUrlId, sharedUrlId))
    .orderBy(desc(schema.mcpToolSnapshots.capturedAt))
    .limit(1);

  const previousSnapshot = previousSnapshots[0] ?? null;

  // Step 4: Store current snapshot
  const snapshotId = mcpToolSnapshotId();
  await db.insert(schema.mcpToolSnapshots).values({
    id: snapshotId,
    sharedUrlId,
    toolsJson: { tools },
    toolsHash: currentToolsHash,
    toolHashes: currentToolHashes,
    serverInfo,
    capturedAt: new Date(),
    createdAt: new Date(),
  });

  console.log(`[check-mcp] Stored snapshot: ${snapshotId}`);

  // Step 5: If no previous snapshot, this is baseline
  if (!previousSnapshot) {
    console.log(`[check-mcp] No previous snapshot — stored baseline`);
    return;
  }

  // Step 6: Quick hash check — if unchanged, skip diff
  if (previousSnapshot.toolsHash === currentToolsHash) {
    console.log(`[check-mcp] No changes detected (hash match)`);
    return;
  }

  // Step 7: Tools changed — run full diff
  const previousTools: McpToolDefinition[] =
    (previousSnapshot.toolsJson as any)?.tools || [];

  const diffResult = diffMcpTools(previousTools, tools);

  if (!diffResult.hasChanges) {
    // Hash changed but diff found nothing (shouldn't happen, but be safe)
    console.log(`[check-mcp] Hash changed but no semantic changes`);
    return;
  }

  console.log(
    `[check-mcp] Changes detected: ${diffResult.summary} (${diffResult.breakingChanges} breaking)`,
  );

  // Step 8: Classify severity and generate report
  const severity = classifyChangeSeverity(diffResult);
  const impactReport = generateImpactReport(diffResult);

  // Step 9: Store change using existing change infrastructure
  const changeId = await storeChange(sharedUrlId, userId, urlId, {
    changeType: 'structural',
    severity,
    confidence: 100, // MCP changes are exact (no heuristics)
    summary: `MCP: ${diffResult.summary}`,
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
}
