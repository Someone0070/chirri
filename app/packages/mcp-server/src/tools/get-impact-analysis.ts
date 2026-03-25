import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerGetImpactAnalysis(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_get_impact_analysis", {
    title: "Get Impact Analysis",
    description:
      "Get an AI-generated impact analysis for a detected change. Explains what changed, how it affects your integration, and provides migration steps and code examples.",
    inputSchema: {
      change_id: z.string().describe("The change ID (chg_...)"),
    },
  }, async ({ change_id }) => {
    try {
      const data = await api.getImpactAnalysis(change_id);
      return ok(data);
    } catch (error) {
      return err(error);
    }
  });
}
