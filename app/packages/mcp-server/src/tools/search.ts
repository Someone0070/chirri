import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerSearch(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_search", {
    title: "Search",
    description:
      "Search across all your Chirri data — changes, forecasts, and monitored URLs. Useful for finding specific changes by keyword, or checking if a particular API field or endpoint has been affected.",
    inputSchema: {
      query: z
        .string()
        .describe(
          "Search query (e.g., 'amount field removed', 'stripe deprecation', 'openai model')",
        ),
      type: z
        .enum(["all", "changes", "forecasts", "monitors"])
        .default("all")
        .describe("Limit search to a specific type"),
      limit: z
        .number()
        .min(1)
        .max(20)
        .default(10)
        .describe("Number of results"),
    },
  }, async ({ query, type, limit }) => {
    try {
      const perType = Math.ceil(limit / 3);
      const results: Array<{
        type: string;
        id: string;
        title: string;
        summary: string;
        url: string | null;
        relevance_score: number;
      }> = [];

      // Search monitors
      if (type === "all" || type === "monitors") {
        try {
          const urls = await api.listUrls({ search: query, limit: perType });
          for (const u of urls.data) {
            results.push({
              type: "monitor",
              id: u.id,
              title: u.name ?? u.url,
              summary: `Status: ${u.status}, Interval: ${u.check_interval}, Changes (7d): ${u.recent_change_count}`,
              url: u.url,
              relevance_score: 1,
            });
          }
        } catch {
          // Search may fail — partial results OK
        }
      }

      // Search changes
      if (type === "all" || type === "changes") {
        try {
          const changes = await api.listChanges({ limit: perType });
          for (const c of changes.data) {
            // Client-side text match since API may not have search param on changes
            const text =
              `${c.summary} ${c.url} ${c.url_name ?? ""} ${c.change_type}`.toLowerCase();
            if (text.includes(query.toLowerCase())) {
              results.push({
                type: "change",
                id: c.id,
                title: c.summary,
                summary: `${c.severity} ${c.change_type} — ${c.workflow_state}`,
                url: c.url,
                relevance_score: 0.8,
              });
            }
          }
        } catch {
          // Partial results OK
        }
      }

      // Search forecasts
      if (type === "all" || type === "forecasts") {
        try {
          const forecasts = await api.listForecasts({ limit: perType });
          for (const f of forecasts.data) {
            const text =
              `${f.title} ${f.description} ${f.url_name ?? ""} ${f.signal_type}`.toLowerCase();
            if (text.includes(query.toLowerCase())) {
              results.push({
                type: "forecast",
                id: f.id,
                title: f.title,
                summary: f.description,
                url: null,
                relevance_score: 0.8,
              });
            }
          }
        } catch {
          // Partial results OK
        }
      }

      // Sort by relevance
      results.sort((a, b) => b.relevance_score - a.relevance_score);

      return ok({
        results: results.slice(0, limit),
        total: results.length,
      });
    } catch (error) {
      return err(error);
    }
  });
}
