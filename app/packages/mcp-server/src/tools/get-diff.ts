import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerGetDiff(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_get_diff", {
    title: "Get Diff",
    description:
      "Get the full diff between the previous and current state for a detected change. Shows exactly what fields, status codes, or headers changed.",
    inputSchema: {
      change_id: z.string().describe("The change ID (chg_...)"),
    },
  }, async ({ change_id }) => {
    try {
      const data = await api.getChange(change_id);
      const result = {
        change_id: data.id,
        url: data.url,
        change_type: data.change_type,
        severity: data.severity,
        summary: data.summary,
        diff: data.diff,
        previous_status_code: data.previous_snapshot?.status_code ?? null,
        current_status_code: data.current_snapshot?.status_code ?? null,
        detected_at: data.detected_at,
      };
      return ok(result);
    } catch (error) {
      return err(error);
    }
  });
}
