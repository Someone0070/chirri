/**
 * Register all Chirri MCP tools on the given McpServer instance.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";

import { registerListMonitors } from "./list-monitors.js";
import { registerAddMonitor } from "./add-monitor.js";
import { registerRemoveMonitor } from "./remove-monitor.js";
import { registerGetChanges } from "./get-changes.js";
import { registerGetDiff } from "./get-diff.js";
import { registerCheckNow } from "./check-now.js";
import { registerGetForecasts } from "./get-forecasts.js";
import { registerAcknowledge } from "./acknowledge.js";
import { registerGetImpactAnalysis } from "./get-impact-analysis.js";
import { registerGetDependencyGraph } from "./get-dependency-graph.js";
import { registerSearch } from "./search.js";

export function registerAllTools(server: McpServer, api: ChirriApiClient): void {
  registerListMonitors(server, api);
  registerAddMonitor(server, api);
  registerRemoveMonitor(server, api);
  registerGetChanges(server, api);
  registerGetDiff(server, api);
  registerCheckNow(server, api);
  registerGetForecasts(server, api);
  registerAcknowledge(server, api);
  registerGetImpactAnalysis(server, api);
  registerGetDependencyGraph(server, api);
  registerSearch(server, api);
}
