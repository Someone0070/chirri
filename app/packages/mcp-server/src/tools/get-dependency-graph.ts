import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerGetDependencyGraph(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_get_dependency_graph", {
    title: "Get Dependency Graph",
    description:
      "Get the full dependency graph for a monitored URL, showing all sources being tracked: the primary endpoint, changelog, OpenAPI spec, status page, and SDK versions. Shows what Chirri is watching and the status of each source.",
    inputSchema: {
      url_id: z.string().describe("The URL monitor ID (url_...)"),
    },
  }, async ({ url_id }) => {
    try {
      const urlDetail = await api.getUrl(url_id);
      let sources = urlDetail.sources ?? [];

      // Fallback: fetch sources separately if not included
      if (sources.length === 0) {
        try {
          const sourcesData = await api.getUrlSources(url_id);
          sources = sourcesData.data ?? [];
        } catch {
          // Sources endpoint may not exist yet
        }
      }

      const result = {
        url_id: urlDetail.id,
        url: urlDetail.url,
        provider: urlDetail.provider?.name ?? null,
        sources: sources.map((s) => ({
          id: s.id,
          type: s.type,
          name: s.name,
          url: s.url,
          status: s.status ?? "active",
          bundled: s.bundled,
          last_check_at: s.last_check_at ?? null,
          recent_changes: 0,
        })),
      };
      return ok(result);
    } catch (error) {
      return err(error);
    }
  });
}
