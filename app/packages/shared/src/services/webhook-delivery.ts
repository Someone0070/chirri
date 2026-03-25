import { createHmac, randomUUID } from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface DeliveryResult {
  deliveryId: string;
  success: boolean;
  statusCode?: number;
  attempts: number;
  error?: string;
}

interface DeliveryAttempt {
  attempt: number;
  statusCode?: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

// ============================================================================
// HMAC Signing
// ============================================================================

function signPayload(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

// ============================================================================
// Retry delays: 1s, 10s, 60s
// ============================================================================

const RETRY_DELAYS_MS = [1_000, 10_000, 60_000];
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Public API
// ============================================================================

export async function deliverWebhook(
  endpoint: string,
  payload: WebhookPayload,
  secret: string,
): Promise<DeliveryResult> {
  const deliveryId = randomUUID();
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);
  const attempts: DeliveryAttempt[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chirri-Signature': `sha256=${signature}`,
          'X-Chirri-Event': payload.event,
          'X-Chirri-Delivery-ID': deliveryId,
          'User-Agent': 'Chirri-Webhooks/1.0',
        },
        body,
        signal: AbortSignal.timeout(10_000), // 10s per-request timeout
      });

      const success = response.status >= 200 && response.status < 300;

      attempts.push({
        attempt,
        statusCode: response.status,
        success,
        timestamp: new Date().toISOString(),
      });

      if (success) {
        logAttempts(deliveryId, endpoint, attempts);
        return {
          deliveryId,
          success: true,
          statusCode: response.status,
          attempts: attempt,
        };
      }

      // Non-retryable status codes
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        logAttempts(deliveryId, endpoint, attempts);
        return {
          deliveryId,
          success: false,
          statusCode: response.status,
          attempts: attempt,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (err) {
      attempts.push({
        attempt,
        success: false,
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
    }

    // Wait before retry (except after last attempt)
    if (attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  logAttempts(deliveryId, endpoint, attempts);
  const lastAttempt = attempts[attempts.length - 1];
  return {
    deliveryId,
    success: false,
    statusCode: lastAttempt?.statusCode,
    attempts: MAX_ATTEMPTS,
    error: lastAttempt?.error || `Failed after ${MAX_ATTEMPTS} attempts`,
  };
}

// ============================================================================
// Logging
// ============================================================================

function logAttempts(deliveryId: string, endpoint: string, attempts: DeliveryAttempt[]): void {
  const lastAttempt = attempts[attempts.length - 1];
  const status = lastAttempt?.success ? 'SUCCESS' : 'FAILED';
  console.log(
    `[webhook-delivery] ${status} id=${deliveryId} endpoint=${endpoint} attempts=${attempts.length}` +
      (lastAttempt?.statusCode ? ` status=${lastAttempt.statusCode}` : '') +
      (lastAttempt?.error ? ` error=${lastAttempt.error}` : ''),
  );
}
