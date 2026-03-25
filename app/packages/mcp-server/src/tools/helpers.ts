import { ChirriApiError } from "../api-client.js";

/**
 * Format a successful result as MCP tool output.
 */
export function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Format an error as MCP tool output.
 */
export function err(error: unknown) {
  let message: string;
  if (error instanceof ChirriApiError) {
    message = `Error (${error.code}): ${error.message}`;
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
  } else {
    message = `Error: ${String(error)}`;
  }
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
