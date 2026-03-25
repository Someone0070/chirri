import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerCheckNow(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_check_now", {
    title: "Check Now",
    description:
      "Trigger an immediate check on a monitored URL right now, without waiting for the next scheduled check. Returns the check result if completed within 30 seconds.",
    inputSchema: {
      id: z.string().describe("The URL monitor ID (url_...)"),
      wait: z
        .boolean()
        .default(true)
        .describe(
          "Wait for check to complete (max 30s). If false, returns immediately with job ID.",
        ),
    },
  }, async ({ id, wait }) => {
    try {
      const data = await api.checkNow(id, wait);

      if (data.job_id && !data.status_code) {
        // Async mode — check queued
        return ok({
          url: null,
          job_id: data.job_id,
          message: "Check queued. It will run shortly.",
        });
      }

      const result = {
        url: data.url ?? null,
        status_code: data.status_code ?? null,
        response_time_ms: data.response_time_ms ?? null,
        change_detected: data.change_detected ?? false,
        change_id: data.change_id ?? null,
        change_summary: null,
        checked_at: data.checked_at ?? null,
        message: data.change_detected
          ? "Check complete. Change detected!"
          : "Check complete. No changes detected.",
      };
      return ok(result);
    } catch (error) {
      return err(error);
    }
  });
}
