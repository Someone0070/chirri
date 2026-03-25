import { DiscoveryResult, DedupStats } from './types.js';
import { parallelLimit } from './utils.js';

// ─── URL Normalization ───────────────────────────────────────────────

const NOISE_PARAMS = /^(utm_\w+|ref|source|fbclid|gclid|mc_cid|mc_eid|_ga|_gl)$/i;

/**
 * Normalize a URL for dedup comparison:
 * 1. Lowercase hostname
 * 2. Strip trailing slashes
 * 3. Strip default ports (:80, :443)
 * 4. Strip tracking/noise query params
 * 5. Strip hash/anchor
 * 6. Normalize www. (strip it)
 * 7. Normalize protocol (http → https)
 */
export function normalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // If it's not a valid URL, just lowercase and strip trailing slash
    return raw.replace(/\/+$/, '').toLowerCase();
  }

  // 7. Normalize protocol to https
  url.protocol = 'https:';

  // 1. Lowercase hostname (URL constructor already does this, but be explicit)
  url.hostname = url.hostname.toLowerCase();

  // 6. Strip www.
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
  }

  // 3. Strip default ports
  if (url.port === '80' || url.port === '443') {
    url.port = '';
  }

  // 5. Strip hash
  url.hash = '';

  // 4. Strip noise query params
  const params = new URLSearchParams(url.search);
  const keysToDelete: string[] = [];
  for (const key of params.keys()) {
    if (NOISE_PARAMS.test(key)) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    params.delete(key);
  }
  url.search = params.toString() ? `?${params.toString()}` : '';

  // 2. Strip trailing slash from pathname (but keep root '/')
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '');
  }
  url.pathname = pathname;

  return url.toString();
}

// ─── Redirect Resolution ─────────────────────────────────────────────

// In-memory cache for redirect resolution (persists for the lifetime of the process)
const redirectCache = new Map<string, string>();

/**
 * Resolve a URL by following redirects (HEAD requests, max 5 hops).
 * Returns the final resolved URL, or the original if unreachable.
 */
async function resolveRedirects(url: string): Promise<{ finalUrl: string; cached: boolean }> {
  if (redirectCache.has(url)) {
    return { finalUrl: redirectCache.get(url)!, cached: true };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    // Use fetch with redirect: 'follow' — it resolves the final URL for us
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Chirri-Discovery/0.1 (dedup redirect check)',
      },
    });
    clearTimeout(timer);

    const finalUrl = res.url || url;
    redirectCache.set(url, finalUrl);
    return { finalUrl, cached: false };
  } catch {
    // If HEAD fails, try GET with a short timeout
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Chirri-Discovery/0.1 (dedup redirect check)',
        },
      });
      clearTimeout(timer);

      // Consume body to free resources
      try { await res.text(); } catch {}

      const finalUrl = res.url || url;
      redirectCache.set(url, finalUrl);
      return { finalUrl, cached: false };
    } catch {
      // Unreachable — use original URL
      redirectCache.set(url, url);
      return { finalUrl: url, cached: false };
    }
  }
}

// ─── Category Priority ───────────────────────────────────────────────

const CATEGORY_PRIORITY: Record<string, number> = {
  docs: 4,
  changelog: 3,
  status: 2,
  openapi: 1,
  blog: 0,
  unknown: -1,
};

function bestCategory(a: DiscoveryResult['type'], b: DiscoveryResult['type']): DiscoveryResult['type'] {
  return (CATEGORY_PRIORITY[a] ?? -1) >= (CATEGORY_PRIORITY[b] ?? -1) ? a : b;
}

// ─── Main Dedup Function ─────────────────────────────────────────────

export interface DedupOptions {
  /** Whether to resolve redirects via HEAD requests (default: true) */
  resolveRedirects?: boolean;
  /** Max concurrent redirect resolution requests (default: 10) */
  concurrency?: number;
}

/**
 * Deduplicate discovery results:
 * 1. Normalize all URLs
 * 2. Resolve redirects (batched + concurrent)
 * 3. Group by canonical URL
 * 4. Merge entries: keep highest confidence, merge methods, best category
 * 5. Boost confidence for URLs found by multiple methods
 */
export async function deduplicateResults(
  results: DiscoveryResult[],
  options: DedupOptions = {}
): Promise<{ results: DiscoveryResult[]; stats: DedupStats }> {
  const { resolveRedirects: doResolve = true, concurrency = 10 } = options;

  const stats: DedupStats = {
    totalBefore: results.length,
    totalAfter: 0,
    redirectsResolved: 0,
    redirectsFailed: 0,
    redirectsCached: 0,
  };

  if (results.length === 0) {
    return { results: [], stats };
  }

  // Step 1: Normalize all URLs
  const normalized = results.map(r => ({
    ...r,
    _normalizedUrl: normalizeUrl(r.url),
  }));

  // Step 2: Resolve redirects (batched, concurrent)
  let resolvedMap = new Map<string, string>(); // normalizedUrl → canonicalUrl

  if (doResolve) {
    const uniqueUrls = [...new Set(normalized.map(r => r._normalizedUrl))];

    const tasks = uniqueUrls.map(url => async () => {
      const { finalUrl, cached } = await resolveRedirects(url);
      if (cached) {
        stats.redirectsCached++;
      } else if (finalUrl !== url) {
        stats.redirectsResolved++;
      }
      return { url, finalUrl };
    });

    const resolved = await parallelLimit(tasks, concurrency);
    for (const { url, finalUrl } of resolved) {
      // Normalize the final URL too
      resolvedMap.set(url, normalizeUrl(finalUrl));
    }
  }

  // Step 3: Group by canonical URL
  const groups = new Map<string, Array<typeof normalized[0]>>();

  for (const r of normalized) {
    const canonical = resolvedMap.get(r._normalizedUrl) || r._normalizedUrl;
    const group = groups.get(canonical) || [];
    group.push(r);
    groups.set(canonical, group);
  }

  // Step 4: Merge each group into a single entry
  const deduped: DiscoveryResult[] = [];

  for (const [canonical, group] of groups) {
    // Collect all unique methods
    const methods = [...new Set(group.map(r => r.method))];

    // Highest confidence
    let bestConfidence = Math.max(...group.map(r => r.confidence));

    // Best category
    let type = group[0].type;
    for (const r of group) {
      type = bestCategory(type, r.type);
    }

    // Merge meta
    const meta: Record<string, string> = {};
    for (const r of group) {
      if (r.meta) Object.assign(meta, r.meta);
    }

    // Step 5: Multi-method confidence boost
    // Each additional method adds a 5-point bonus (capped at +20)
    if (methods.length > 1) {
      const bonus = Math.min((methods.length - 1) * 5, 20);
      bestConfidence = Math.min(bestConfidence + bonus, 100);
    }

    deduped.push({
      url: canonical,
      canonicalUrl: canonical,
      method: methods[0], // primary method
      methods,
      confidence: bestConfidence,
      type,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    });
  }

  stats.totalAfter = deduped.length;

  return { results: deduped, stats };
}
