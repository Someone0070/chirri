import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerGetChanges(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_get_changes", {
    title: "Get Changes",
    description:
      "Get recent changes detected across your monitored APIs. Filter by URL, severity, or date range. Returns change summaries with severity levels and workflow states.",
    inputSchema: {
      url_id: z.string().optional().describe("Filter by URL monitor ID"),
      severity: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Filter by minimum severity"),
      workflow_state: z
        .enum(["new", "tracked", "ignored", "snoozed", "resolved"])
        .optional()
        .describe("Filter by workflow state"),
      since: z
        .string()
        .optional()
        .describe("ISO 8601 date to get changes since"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of changes to return"),
      cursor: z.string().optional().describe("Pagination cursor"),
    },
  }, async ({ url_id, severity, workflow_state, since, limit, cursor }) => {
    try {
      const data = await api.listChanges({
        url_id,
        severity,
        workflow_state,
        since,
        limit,
        cursor,
      });
      const result = {
        changes: data.data.map((c) => ({
          id: c.id,
          url: c.url,
          url_name: c.url_name,
          change_type: c.change_type,
          severity: c.severity,
          summary: c.summary,
          workflow_state: c.workflow_state,
          confirmation_status: c.confirmation_status,
          detected_at: c.detected_at,
        })),
        total: data.data.length,
        has_more: data.has_more,
        next_cursor: data.next_cursor,
      };
      return ok(result);
    } catch (error) {
      return err(error);
    }
  });
}
