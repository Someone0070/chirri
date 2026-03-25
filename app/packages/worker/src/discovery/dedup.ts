import type { DiscoveryResult, DedupStats } from './types.js';
import { parallelLimit } from './utils.js';

const NOISE_PARAMS = /^(utm_\w+|ref|source|fbclid|gclid|mc_cid|mc_eid|_ga|_gl)$/i;

export function normalizeUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { return raw.replace(/\/+$/, '').toLowerCase(); }

  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase();
  if (url.hostname.startsWith('www.')) url.hostname = url.hostname.slice(4);
  if (url.port === '80' || url.port === '443') url.port = '';
  url.hash = '';

  const params = new URLSearchParams(url.search);
  const keysToDelete: string[] = [];
  for (const key of params.keys()) { if (NOISE_PARAMS.test(key)) keysToDelete.push(key); }
  for (const key of keysToDelete) params.delete(key);
  url.search = params.toString() ? `?${params.toString()}` : '';

  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.replace(/\/+$/, '');
  url.pathname = pathname;

  return url.toString();
}

const redirectCache = new Map<string, string>();

async function resolveRedirects(url: string): Promise<{ finalUrl: string; cached: boolean }> {
  if (redirectCache.has(url)) return { finalUrl: redirectCache.get(url)!, cached: true };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'HEAD', signal: controller.signal, redirect: 'follow',
      headers: { 'User-Agent': 'Chirri-Discovery/0.1 (dedup redirect check)' },
    });
    clearTimeout(timer);
    const finalUrl = res.url || url;
    redirectCache.set(url, finalUrl);
    return { finalUrl, cached: false };
  } catch {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'GET', signal: controller.signal, redirect: 'follow',
        headers: { 'User-Agent': 'Chirri-Discovery/0.1 (dedup redirect check)' },
      });
      clearTimeout(timer);
      try { await res.text(); } catch { /* consume */ }
      const finalUrl = res.url || url;
      redirectCache.set(url, finalUrl);
      return { finalUrl, cached: false };
    } catch {
      redirectCache.set(url, url);
      return { finalUrl: url, cached: false };
    }
  }
}

const CATEGORY_PRIORITY: Record<string, number> = {
  docs: 4, changelog: 3, status: 2, openapi: 1, blog: 0, unknown: -1,
};

function bestCategory(a: DiscoveryResult['type'], b: DiscoveryResult['type']): DiscoveryResult['type'] {
  return (CATEGORY_PRIORITY[a] ?? -1) >= (CATEGORY_PRIORITY[b] ?? -1) ? a : b;
}

export interface DedupOptions {
  resolveRedirects?: boolean;
  concurrency?: number;
}

export async function deduplicateResults(
  results: DiscoveryResult[],
  options: DedupOptions = {},
): Promise<{ results: DiscoveryResult[]; stats: DedupStats }> {
  const { resolveRedirects: doResolve = true, concurrency = 10 } = options;

  const stats: DedupStats = {
    totalBefore: results.length, totalAfter: 0,
    redirectsResolved: 0, redirectsFailed: 0, redirectsCached: 0,
  };

  if (results.length === 0) return { results: [], stats };

  const normalized = results.map((r) => ({ ...r, _normalizedUrl: normalizeUrl(r.url) }));

  const resolvedMap = new Map<string, string>();
  if (doResolve) {
    const uniqueUrls = [...new Set(normalized.map((r) => r._normalizedUrl))];
    const tasks = uniqueUrls.map((url) => async () => {
      const { finalUrl, cached } = await resolveRedirects(url);
      if (cached) stats.redirectsCached++;
      else if (finalUrl !== url) stats.redirectsResolved++;
      return { url, finalUrl };
    });
    const resolved = await parallelLimit(tasks, concurrency);
    for (const { url, finalUrl } of resolved) resolvedMap.set(url, normalizeUrl(finalUrl));
  }

  const groups = new Map<string, Array<(typeof normalized)[0]>>();
  for (const r of normalized) {
    const canonical = resolvedMap.get(r._normalizedUrl) || r._normalizedUrl;
    const group = groups.get(canonical) || [];
    group.push(r);
    groups.set(canonical, group);
  }

  const deduped: DiscoveryResult[] = [];
  for (const [canonical, group] of groups) {
    const methods = [...new Set(group.map((r) => r.method))];
    let bestConfidence = Math.max(...group.map((r) => r.confidence));
    let type = group[0].type;
    for (const r of group) type = bestCategory(type, r.type);
    const meta: Record<string, string> = {};
    for (const r of group) { if (r.meta) Object.assign(meta, r.meta); }
    if (methods.length > 1) {
      const bonus = Math.min((methods.length - 1) * 5, 20);
      bestConfidence = Math.min(bestConfidence + bonus, 100);
    }
    deduped.push({
      url: canonical, canonicalUrl: canonical,
      method: methods[0], methods,
      confidence: bestConfidence, type,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    });
  }

  stats.totalAfter = deduped.length;
  return { results: deduped, stats };
}
