/**
 * Chirri REST API client.
 * Simple fetch wrapper that adds auth and error handling.
 */

export interface ApiClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Array<{ field?: string; message: string }>;
}

export class ChirriApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Array<{ field?: string; message: string }>,
  ) {
    super(message);
    this.name = "ChirriApiError";
  }
}

export class ChirriApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 204) {
        return undefined as T;
      }

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = (json as { error?: ApiError }).error;
        if (res.status === 401) {
          throw new ChirriApiError(
            err?.code ?? "unauthorized",
            401,
            "Invalid API key. Check your CHIRRI_API_KEY environment variable.",
          );
        }
        throw new ChirriApiError(
          err?.code ?? "api_error",
          res.status,
          err?.message ?? `API error: ${res.status} ${res.statusText}`,
          err?.details,
        );
      }

      return json as T;
    } catch (error) {
      if (error instanceof ChirriApiError) throw error;
      if ((error as Error).name === "AbortError") {
        throw new ChirriApiError(
          "timeout",
          504,
          `Request timed out after ${this.timeoutMs}ms`,
        );
      }
      throw new ChirriApiError(
        "network_error",
        0,
        `Network error: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildQuery(params: Record<string, unknown>): string {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        qs.set(key, String(value));
      }
    }
    const str = qs.toString();
    return str ? `?${str}` : "";
  }

  // ── URLs ───────────────────────────────────────────────

  async listUrls(params: {
    status?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  } = {}) {
    return this.request<{
      data: Array<{
        id: string;
        url: string;
        name: string | null;
        status: string;
        method: string;
        check_interval: string;
        tags: string[];
        last_check_at: string | null;
        next_check_at: string | null;
        recent_change_count: number;
        provider_slug: string | null;
        created_at: string;
      }>;
      has_more: boolean;
      next_cursor: string | null;
    }>("GET", `/v1/urls${this.buildQuery(params)}`);
  }

  async getUrl(id: string) {
    return this.request<{
      id: string;
      url: string;
      name: string | null;
      status: string;
      provider: { slug: string; name: string } | null;
      sources: Array<{
        id: string;
        type: string;
        name: string;
        url: string;
        bundled: boolean;
        status: string;
        last_check_at: string | null;
      }>;
      [key: string]: unknown;
    }>("GET", `/v1/urls/${id}`);
  }

  async createUrl(data: {
    url: string;
    name?: string;
    check_interval?: string;
  }) {
    return this.request<{
      id: string;
      url: string;
      name: string | null;
      status: string;
      provider: { slug: string; name: string; sources: unknown[] } | null;
      created_at: string;
    }>("POST", "/v1/urls", data);
  }

  async deleteUrl(id: string) {
    return this.request<void>("DELETE", `/v1/urls/${id}`);
  }

  async checkNow(id: string, wait = true) {
    return this.request<{
      url?: string;
      status_code?: number;
      response_time_ms?: number;
      change_detected?: boolean;
      change_id?: string | null;
      checked_at?: string;
      job_id?: string;
      message?: string;
    }>("POST", `/v1/urls/${id}/check${this.buildQuery({ wait })}`);
  }

  // ── URL Sources ────────────────────────────────────────

  async getUrlSources(urlId: string) {
    return this.request<{
      data: Array<{
        id: string;
        type: string;
        name: string;
        url: string;
        bundled: boolean;
        status: string;
        last_check_at: string | null;
      }>;
    }>("GET", `/v1/urls/${urlId}/sources`);
  }

  // ── Changes ────────────────────────────────────────────

  async listChanges(params: {
    url_id?: string;
    severity?: string;
    workflow_state?: string;
    since?: string;
    until?: string;
    limit?: number;
    cursor?: string;
  } = {}) {
    return this.request<{
      data: Array<{
        id: string;
        url_id: string;
        url_name: string | null;
        url: string;
        change_type: string;
        severity: string;
        confidence: number;
        summary: string;
        workflow_state: string;
        confirmation_status: string;
        detected_at: string;
      }>;
      has_more: boolean;
      next_cursor: string | null;
    }>("GET", `/v1/changes${this.buildQuery(params)}`);
  }

  async getChange(id: string) {
    return this.request<{
      id: string;
      url: string;
      url_name: string | null;
      change_type: string;
      severity: string;
      summary: string;
      diff: unknown;
      previous_snapshot: { status_code: number };
      current_snapshot: { status_code: number };
      detected_at: string;
      [key: string]: unknown;
    }>("GET", `/v1/changes/${id}`);
  }

  async getImpactAnalysis(changeId: string) {
    return this.request<{
      change_id: string;
      summary: string;
      impact_level: string;
      affected_areas: string[];
      migration_steps: string[];
      code_examples: Array<{
        language: string;
        before: string;
        after: string;
        description: string;
      }>;
      related_docs: Array<{ title: string; url: string }>;
    }>("GET", `/v1/changes/${changeId}/impact`);
  }

  // Change workflow actions
  async trackChange(id: string, note?: string) {
    return this.request("POST", `/v1/changes/${id}/track`, note ? { note } : undefined);
  }

  async ignoreChange(id: string, note?: string) {
    return this.request("POST", `/v1/changes/${id}/ignore`, note ? { note } : undefined);
  }

  async resolveChange(id: string, note?: string) {
    return this.request("POST", `/v1/changes/${id}/resolve`, note ? { note } : undefined);
  }

  async snoozeChange(id: string, until: string, note?: string) {
    return this.request("POST", `/v1/changes/${id}/snooze`, { until, note });
  }

  // ── Forecasts ──────────────────────────────────────────

  async listForecasts(params: {
    status?: string;
    severity?: string;
    url_id?: string;
    limit?: number;
    cursor?: string;
  } = {}) {
    return this.request<{
      data: Array<{
        id: string;
        url_id: string;
        url_name: string | null;
        signal_type: string;
        severity: string;
        title: string;
        description: string;
        deadline: string | null;
        status: string;
      }>;
      has_more: boolean;
      next_cursor: string | null;
    }>("GET", `/v1/forecasts${this.buildQuery(params)}`);
  }

  async acknowledgeForecast(id: string, muteReminders = false) {
    return this.request("POST", `/v1/forecasts/${id}/acknowledge`, {
      mute_reminders: muteReminders,
    });
  }

  async dismissForecast(id: string, reason: string) {
    return this.request("POST", `/v1/forecasts/${id}/dismiss`, { reason });
  }
}
