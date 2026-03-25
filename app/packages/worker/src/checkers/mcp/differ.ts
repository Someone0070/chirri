/**
 * MCP Tool Definition Differ
 *
 * Deep diffs two sets of MCP tool definitions, detecting:
 * - Added tools (non-breaking)
 * - Removed tools (breaking)
 * - Schema changes (breaking or non-breaking depending on type)
 * - Description changes (non-breaking)
 */

import { createHash } from 'crypto';
import type {
  McpToolDefinition,
  ToolChange,
  McpDiffResult,
} from './types.js';

// ─── Canonical JSON ─────────────────────────────────────────────────────────

/**
 * Produce canonical JSON with sorted keys for deterministic hashing.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sorted.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`,
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * SHA-256 hash of a tool definition (canonical form).
 */
export function hashTool(tool: McpToolDefinition): string {
  const canonical = canonicalJson(tool);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * SHA-256 hash of the full tools list (canonical form).
 */
export function hashToolsList(tools: McpToolDefinition[]): string {
  const canonical = canonicalJson({ tools });
  return createHash('sha256').update(canonical).digest('hex');
}

// ─── Diff Engine ────────────────────────────────────────────────────────────

/**
 * Diff two MCP tool snapshots and produce a structured result.
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

    if (beforeHash === afterHash) continue;

    // Tool changed — analyze what changed
    const schemaChanges = diffToolSchema(beforeTool, afterTool);
    changes.push(...schemaChanges);

    // Check description change separately
    if (beforeTool.description !== afterTool.description) {
      // Only add if not already covered by schema changes
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

  // Aggregate
  const breakingChanges = changes.filter((c) => c.severity === 'breaking').length;
  const nonBreakingChanges = changes.filter(
    (c) => c.severity === 'non-breaking',
  ).length;
  const addedTools = changes
    .filter((c) => c.type === 'tool_added')
    .map((c) => c.toolName);
  const removedTools = changes
    .filter((c) => c.type === 'tool_removed')
    .map((c) => c.toolName);
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

// ─── Schema Diff ────────────────────────────────────────────────────────────

function diffToolSchema(
  before: McpToolDefinition,
  after: McpToolDefinition,
): ToolChange[] {
  const changes: ToolChange[] = [];
  const beforeSchema = before.inputSchema || { type: 'object' as const };
  const afterSchema = after.inputSchema || { type: 'object' as const };

  const beforeRequired = new Set(beforeSchema.required || []);
  const afterRequired = new Set(afterSchema.required || []);
  const beforeProps = beforeSchema.properties || {};
  const afterProps = afterSchema.properties || {};

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

  // Required parameter removed = BREAKING (was required, now isn't — clients might depend on it)
  for (const param of beforeRequired) {
    if (!afterRequired.has(param)) {
      // Only breaking if the param still exists (just became optional) — that's actually non-breaking
      // But if param was removed entirely, that's handled below
      if (afterProps[param] !== undefined) {
        changes.push({
          type: 'schema_changed',
          toolName: before.name,
          severity: 'non-breaking',
          before,
          after,
          details: `Parameter "${param}" changed from required to optional in "${before.name}"`,
          schemaPath: `inputSchema.required[${param}]`,
        });
      }
    }
  }

  // Parameter removed = BREAKING
  for (const param of Object.keys(beforeProps)) {
    if (afterProps[param] === undefined) {
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

  // Parameter added or type changed
  for (const param of Object.keys(afterProps)) {
    if (beforeProps[param] !== undefined) {
      // Existing param — check type change
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

      // Check enum changes
      const beforeEnum = beforeProps[param].enum;
      const afterEnum = afterProps[param].enum;
      if (beforeEnum && afterEnum) {
        const beforeSet = new Set(beforeEnum);
        const removedValues = beforeEnum.filter(
          (v: string) => !new Set(afterEnum).has(v),
        );
        if (removedValues.length > 0) {
          changes.push({
            type: 'schema_changed',
            toolName: before.name,
            severity: 'breaking',
            before,
            after,
            details: `Enum values removed from "${param}" in "${before.name}": ${removedValues.join(', ')}`,
            schemaPath: `inputSchema.properties.${param}.enum`,
          });
        }
        const addedValues = afterEnum.filter(
          (v: string) => !beforeSet.has(v),
        );
        if (addedValues.length > 0) {
          changes.push({
            type: 'schema_changed',
            toolName: before.name,
            severity: 'non-breaking',
            before,
            after,
            details: `Enum values added to "${param}" in "${before.name}": ${addedValues.join(', ')}`,
            schemaPath: `inputSchema.properties.${param}.enum`,
          });
        }
      }
    } else {
      // New parameter
      if (afterRequired.has(param)) {
        // Already reported as "required parameter added" above
        // Skip to avoid duplicate
      } else {
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

// ─── Summary Builder ────────────────────────────────────────────────────────

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
    parts.push(
      `${removed.length} tool${removed.length > 1 ? 's' : ''} removed`,
    );
  }
  if (modified.length > 0) {
    parts.push(
      `${modified.length} tool${modified.length > 1 ? 's' : ''} modified`,
    );
  }

  const breakingCount = changes.filter((c) => c.severity === 'breaking').length;
  if (breakingCount > 0) {
    parts.push(
      `${breakingCount} BREAKING change${breakingCount > 1 ? 's' : ''}`,
    );
  }

  return parts.join(', ') || 'No changes';
}
