import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerGetForecasts(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_get_forecasts", {
    title: "Get Forecasts",
    description:
      "Get early warning forecasts for your monitored APIs. These are advance notices of upcoming changes like deprecations, sunset dates, and version migrations detected from changelogs, headers, and status pages.",
    inputSchema: {
      status: z
        .enum(["active", "acknowledged", "dismissed", "expired"])
        .optional()
        .describe("Filter by forecast status"),
      severity: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Filter by severity"),
      url_id: z.string().optional().describe("Filter by URL monitor ID"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of forecasts to return"),
    },
  }, async ({ status, severity, url_id, limit }) => {
    try {
      const data = await api.listForecasts({ status, severity, url_id, limit });
      const result = {
        forecasts: data.data.map((f) => ({
          id: f.id,
          url_name: f.url_name,
          signal_type: f.signal_type,
          severity: f.severity,
          title: f.title,
          description: f.description,
          deadline: f.deadline,
          status: f.status,
        })),
        total: data.data.length,
        has_more: data.has_more,
      };
      return ok(result);
    } catch (error) {
      return err(error);
    }
  });
}
