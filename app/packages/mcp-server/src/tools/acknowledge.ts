import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChirriApiClient } from "../api-client.js";
import { ok, err } from "./helpers.js";

export function registerAcknowledge(server: McpServer, api: ChirriApiClient) {
  server.registerTool("chirri_acknowledge", {
    title: "Acknowledge Change or Forecast",
    description:
      "Acknowledge a detected change or early warning forecast. For changes, this updates the workflow state (track, ignore, resolve). For forecasts, this marks it as acknowledged or dismissed.",
    inputSchema: {
      id: z.string().describe("Change ID (chg_...) or Forecast ID (frc_...)"),
      action: z
        .enum(["track", "ignore", "resolve", "acknowledge", "dismiss"])
        .describe(
          "Action to take. 'track/ignore/resolve' for changes, 'acknowledge/dismiss' for forecasts.",
        ),
      note: z
        .string()
        .optional()
        .describe("Optional note explaining the action"),
      snooze_until: z
        .string()
        .optional()
        .describe(
          "ISO 8601 date to snooze until (changes only, uses 'snooze' action implicitly)",
        ),
      dismiss_reason: z
        .enum(["false_positive", "not_relevant", "already_migrated"])
        .optional()
        .describe("Reason for dismissal (forecasts with 'dismiss' action only)"),
    },
  }, async ({ id, action, note, snooze_until, dismiss_reason }) => {
    try {
      const isChange = id.startsWith("chg_");
      const isForecast = id.startsWith("frc_");

      if (!isChange && !isForecast) {
        return err(
          new Error(
            "ID must start with 'chg_' (change) or 'frc_' (forecast).",
          ),
        );
      }

      let newState: string;

      if (isChange) {
        // Handle snooze_until override
        if (snooze_until) {
          await api.snoozeChange(id, snooze_until, note);
          newState = "snoozed";
        } else if (action === "track") {
          await api.trackChange(id, note);
          newState = "tracked";
        } else if (action === "ignore") {
          await api.ignoreChange(id, note);
          newState = "ignored";
        } else if (action === "resolve") {
          await api.resolveChange(id, note);
          newState = "resolved";
        } else {
          return err(
            new Error(
              `Invalid action '${action}' for change. Use 'track', 'ignore', or 'resolve'.`,
            ),
          );
        }

        return ok({
          id,
          type: "change",
          action: snooze_until ? "snooze" : action,
          new_state: newState,
          message: `Change marked as ${newState}.`,
        });
      } else {
        // Forecast
        if (action === "acknowledge") {
          await api.acknowledgeForecast(id);
          newState = "acknowledged";
        } else if (action === "dismiss") {
          const reason = dismiss_reason ?? "not_relevant";
          await api.dismissForecast(id, reason);
          newState = "dismissed";
        } else {
          return err(
            new Error(
              `Invalid action '${action}' for forecast. Use 'acknowledge' or 'dismiss'.`,
            ),
          );
        }

        return ok({
          id,
          type: "forecast",
          action,
          new_state: newState,
          message: `Forecast ${newState}.`,
        });
      }
    } catch (error) {
      return err(error);
    }
  });
}
