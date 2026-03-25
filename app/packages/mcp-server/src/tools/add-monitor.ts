import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerAddMonitor(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_add_monitor", {
    title: "Add Monitor",
    description:
      "Add a new API endpoint URL to Chirri monitoring. The URL will go through classification and a learning period before active monitoring begins. For known providers (Stripe, OpenAI, etc.), bonus sources are automatically added.",
    inputSchema: {
      url: z
        .string()
        .describe("The API endpoint URL to monitor (must be http:// or https://)"),
      name: z
        .string()
        .optional()
        .describe("Human-friendly name for this monitor"),
      check_interval: z
        .enum(["5m", "15m", "1h", "6h", "24h"])
        .default("24h")
        .describe("How often to check for changes (available intervals depend on plan)"),
    },
  }, async ({ url, name, check_interval }) => {
    try {
      const data = await api.createUrl({ url, name, check_interval });
      const result = {
        id: data.id,
        url: data.url,
        name: data.name,
        status: data.status,
        provider: data.provider?.name ?? null,
        sources_added: data.provider?.sources
          ? (data.provider.sources as unknown[]).length
          : 0,
        message:
          "Added! Classification in progress, then learning baseline (~10 minutes).",
      };
      return ok(result);
    } catch (error) {
      return err(error);
    }
  });
}
