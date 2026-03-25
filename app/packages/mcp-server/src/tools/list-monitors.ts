import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerListMonitors(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_list_monitors", {
    title: "List Monitored APIs",
    description:
      "List all API endpoints currently being monitored by Chirri. Returns URL, status, last check time, and recent change count. Supports filtering by status and searching by URL or name.",
    inputSchema: {
      status: z
        .enum(["learning", "active", "paused", "error", "degraded"])
        .optional()
        .describe("Filter by monitoring status"),
      search: z.string().optional().describe("Search by URL or name"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(20)
        .describe("Number of results to return"),
      cursor: z
        .string()
        .optional()
        .describe("Pagination cursor from previous response"),
    },
  }, async ({ status, search, limit, cursor }) => {
    try {
      const data = await api.listUrls({ status, search, limit, cursor });
      const result = {
        monitors: data.data.map((u) => ({
          id: u.id,
          url: u.url,
          name: u.name,
          status: u.status,
          check_interval: u.check_interval,
          last_check_at: u.last_check_at,
          recent_change_count: u.recent_change_count,
          provider: u.provider_slug,
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
