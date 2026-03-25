#!/usr/bin/env node

/**
 * Chirri MCP Server
 *
 * Wraps the Chirri REST API as MCP tools for use with Claude Desktop,
 * Cursor, Windsurf, and other MCP-compatible AI assistants.
 *
 * Environment variables:
 *   CHIRRI_API_KEY  (required) - Your Chirri API key (ck_live_...)
 *   CHIRRI_API_URL  (optional) - Override API base URL (default: https://api.chirri.io/v1)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ChirriApiClient } from "./api-client.js";
import { registerAllTools } from "./tools/index.js";

const CHIRRI_API_KEY = process.env.CHIRRI_API_KEY;
const CHIRRI_API_URL =
  process.env.CHIRRI_API_URL || "https://api.chirri.io/v1";

if (!CHIRRI_API_KEY) {
  console.error(
    "Error: CHIRRI_API_KEY environment variable is required.\n" +
      "Get your API key from https://chirri.io/settings/api-keys\n" +
      'Set it in your MCP config: "env": { "CHIRRI_API_KEY": "ck_live_..." }',
  );
  process.exit(1);
}

// Create API client
const api = new ChirriApiClient({
  baseUrl: CHIRRI_API_URL,
  apiKey: CHIRRI_API_KEY,
  timeoutMs: 10_000,
});

// Create MCP server
const server = new McpServer({
  name: "chirri",
  version: "1.0.0",
});

// Register all 11 tools
registerAllTools(server, api);

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

// Graceful shutdown
process.on("SIGTERM", () => {
  process.exit(0);
});

process.on("SIGINT", () => {
  process.exit(0);
});
