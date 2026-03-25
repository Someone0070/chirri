import type { DiscoveryResult } from './types.js';

const TIMEOUT = 6000;

export async function safeFetch(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response | null> {
  const { timeout = TIMEOUT, ...fetchOpts } = options;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      ...fetchOpts,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Chirri-Discovery/0.1 (API changelog tracker)',
        ...((fetchOpts.headers as Record<string, string>) || {}),
      },
    });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

export async function safeHead(
  url: string,
): Promise<{ ok: boolean; status: number; headers: Headers } | null> {
  let res = await safeFetch(url, { method: 'HEAD' });
  if (!res) {
    res = await safeFetch(url, { method: 'GET' });
  }
  if (!res) return null;
  return { ok: res.ok, status: res.status, headers: res.headers };
}

export async function safeGet(
  url: string,
): Promise<{ ok: boolean; status: number; text: string; headers: Headers } | null> {
  const res = await safeFetch(url);
  if (!res) return null;
  try {
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, headers: res.headers };
  } catch {
    return null;
  }
}

export function classifyUrl(
  url: string,
  fallbackType?: DiscoveryResult['type'],
): DiscoveryResult['type'] {
  const lower = url.toLowerCase();
  if (/openapi|swagger/.test(lower)) return 'openapi';
  if (/status\./.test(lower) || /\/status/.test(lower) || /statuspage|instatus/.test(lower))
    return 'status';
  if (/changelog|release-notes|releases|whats-new|what-s-new|changes/.test(lower))
    return 'changelog';
  if (/docs|documentation|developer|reference|api-reference|api-docs|guides/.test(lower))
    return 'docs';
  if (/blog/.test(lower)) return 'blog';
  return fallbackType || 'unknown';
}

export function getBaseDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join('.');
}

export function getCompanyName(domain: string): string {
  const base = getBaseDomain(domain);
  return base.split('.')[0];
}

export function dedupeResults(results: DiscoveryResult[]): DiscoveryResult[] {
  const seen = new Map<string, DiscoveryResult>();
  for (const r of results) {
    const key = r.url.replace(/\/+$/, '').toLowerCase();
    const existing = seen.get(key);
    if (!existing || existing.confidence < r.confidence) {
      seen.set(key, r);
    }
  }
  return Array.from(seen.values());
}

export async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
