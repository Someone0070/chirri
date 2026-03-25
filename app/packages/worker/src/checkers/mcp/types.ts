/**
 * MCP Server Monitoring — Type definitions
 */

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
  schemaPath?: string;
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
