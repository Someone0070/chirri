import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerRemoveMonitor(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_remove_monitor", {
    title: "Remove Monitor",
    description:
      "Remove a URL from Chirri monitoring. Stops all checks. Change history is retained per your plan's retention policy. You can pass either the monitor ID or the URL string.",
    inputSchema: {
      id: z
        .string()
        .optional()
        .describe("The URL monitor ID (url_...)"),
      url: z
        .string()
        .optional()
        .describe("Alternatively, the URL string to find and remove"),
    },
  }, async ({ id, url }) => {
    try {
      if (!id && !url) {
        return err(new Error("Provide either 'id' or 'url' to identify the monitor to remove."));
      }

      let targetId = id;
      let targetUrl = url;

      // If only URL provided, look it up
      if (!targetId && targetUrl) {
        const list = await api.listUrls({ search: targetUrl, limit: 5 });
        const match = list.data.find(
          (u) => u.url === targetUrl || u.url === targetUrl?.replace(/\/$/, ""),
        );
        if (!match) {
          return err(new Error(`No monitor found for URL: ${targetUrl}`));
        }
        targetId = match.id;
        targetUrl = match.url;
      }

      await api.deleteUrl(targetId!);

      return ok({
        removed: true,
        id: targetId,
        url: targetUrl ?? null,
        message: "Removed. Change history retained per your plan's retention policy.",
      });
    } catch (error) {
      return err(error);
    }
  });
}
