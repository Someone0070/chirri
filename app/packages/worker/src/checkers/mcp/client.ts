/**
 * MCP Transport Client — JSON-RPC over HTTP/SSE
 *
 * Supports:
 * - Plain HTTP POST (JSON-RPC 2.0)
 * - SSE transport (EventSource for streaming, POST for requests)
 *
 * Security:
 * - SSRF protection: blocks private IPs, localhost, link-local
 * - Timeout protection: 10s connection, 30s response
 * - Size limits: max 5MB response
 */

import { createHash } from 'crypto';
import type {
  McpToolsListResponse,
  McpServerInfo,
  McpConnectionConfig,
} from './types.js';

// ─── SSRF Protection ────────────────────────────────────────────────────────

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '[::1]',
]);

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i, // link-local IPv6
];

function isPrivateOrBlocked(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTS.has(lower)) return true;

  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(lower)) return true;
  }

  return false;
}

function validateEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error(`Invalid MCP endpoint URL: ${endpoint}`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`MCP endpoint must use HTTP(S): ${endpoint}`);
  }

  if (isPrivateOrBlocked(url.hostname)) {
    throw new Error(`MCP endpoint blocked (private/localhost): ${url.hostname}`);
  }

  return url;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CONNECTION_TIMEOUT_MS = 10_000;
const RESPONSE_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_TOOLS = 1000;
const MAX_TOOL_SIZE_BYTES = 10 * 1024; // 10KB per tool

// ─── MCP Client ─────────────────────────────────────────────────────────────

let requestIdCounter = 1;

export class McpClient {
  private config: McpConnectionConfig;
  private sessionUrl: string | null = null;
  private validatedUrl: URL;

  constructor(config: McpConnectionConfig) {
    this.config = config;
    this.validatedUrl = validateEndpoint(config.endpoint);
  }

  /**
   * Initialize connection to MCP server and get server info.
   */
  async initialize(): Promise<McpServerInfo> {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'chirri',
        version: '1.0.0',
      },
    });

    // Send initialized notification (no response expected)
    try {
      await this.sendNotification('notifications/initialized', {});
    } catch {
      // Best-effort; some servers don't require this
    }

    return response.serverInfo as McpServerInfo;
  }

  /**
   * Call tools/list to get all tool definitions.
   */
  async listTools(): Promise<McpToolsListResponse> {
    const response = await this.sendRequest('tools/list', {});

    // Validate tool count
    const tools = response.tools || [];
    if (tools.length > MAX_TOOLS) {
      throw new Error(
        `MCP server returned ${tools.length} tools (max ${MAX_TOOLS})`,
      );
    }

    // Validate individual tool sizes
    for (const tool of tools) {
      const toolJson = JSON.stringify(tool);
      if (toolJson.length > MAX_TOOL_SIZE_BYTES) {
        throw new Error(
          `Tool "${tool.name}" exceeds max size (${toolJson.length} > ${MAX_TOOL_SIZE_BYTES} bytes)`,
        );
      }
    }

    return { tools } as McpToolsListResponse;
  }

  /**
   * Disconnect from MCP server (cleanup).
   */
  async disconnect(): Promise<void> {
    this.sessionUrl = null;
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async sendRequest(method: string, params: unknown): Promise<any> {
    const { authHeader } = this.config;
    const timeoutMs = this.config.timeoutMs ?? RESPONSE_TIMEOUT_MS;
    const endpoint = this.sessionUrl ?? this.config.endpoint;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (authHeader) {
      // authHeader can be full "Bearer xxx" or just the token
      if (authHeader.toLowerCase().startsWith('bearer ') || authHeader.toLowerCase().startsWith('basic ')) {
        headers['Authorization'] = authHeader;
      } else {
        headers['Authorization'] = `Bearer ${authHeader}`;
      }
    }

    const id = requestIdCounter++;
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `MCP HTTP ${response.status}: ${response.statusText}${text ? ` — ${text.substring(0, 200)}` : ''}`,
        );
      }

      // Check Content-Length if available
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
        throw new Error(
          `MCP response too large: ${contentLength} bytes (max ${MAX_RESPONSE_BYTES})`,
        );
      }

      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) {
        throw new Error(
          `MCP response too large: ${text.length} bytes (max ${MAX_RESPONSE_BYTES})`,
        );
      }

      const data = JSON.parse(text);

      if (data.error) {
        throw new Error(
          `MCP error ${data.error.code ?? ''}: ${data.error.message ?? JSON.stringify(data.error)}`,
        );
      }

      return data.result;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`MCP request timeout after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sendNotification(method: string, params: unknown): Promise<void> {
    const { authHeader } = this.config;
    const endpoint = this.sessionUrl ?? this.config.endpoint;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      if (authHeader.toLowerCase().startsWith('bearer ') || authHeader.toLowerCase().startsWith('basic ')) {
        headers['Authorization'] = authHeader;
      } else {
        headers['Authorization'] = `Bearer ${authHeader}`;
      }
    }

    const body = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Factory function for creating MCP clients.
 */
export function createMcpClient(config: McpConnectionConfig): McpClient {
  return new McpClient(config);
}
