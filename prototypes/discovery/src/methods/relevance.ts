import * as cheerio from 'cheerio';
import { DiscoveryResult, DomainResult } from '../types.js';
import { safeGet, safeHead, classifyUrl, parallelLimit } from '../utils.js';

export interface RelevanceEntry {
  url: string;
  type: DiscoveryResult['type'];
  score: number;
  matches: number;
  alwaysRelevant: boolean;
  reason?: string;
}

export interface RelevanceResult {
  endpoint: string;
  endpointPath: string;
  resources: string[];
  changelog: RelevanceEntry[];
  status: RelevanceEntry[];
  openapi: RelevanceEntry[];
  relevantDocs: RelevanceEntry[];
  filteredOut: number;
  totalBefore: number;
}

/**
 * Extract resource names from an endpoint URL.
 * e.g. "api.buttondown.com/v1/emails" -> ["emails", "email"]
 * e.g. "api.stripe.com/v2/customers/charges" -> ["customers", "customer", "charges", "charge"]
 */
export function extractResources(endpointUrl: string): { path: string; resources: string[] } {
  // Parse the URL to get path
  let urlPath: string;
  try {
    const parsed = new URL(endpointUrl.startsWith('http') ? endpointUrl : `https://${endpointUrl}`);
    urlPath = parsed.pathname;
  } catch {
    // If URL parsing fails, treat the whole thing as a path
    urlPath = endpointUrl.includes('/') ? '/' + endpointUrl.split('/').slice(1).join('/') : endpointUrl;
  }

  // Strip version prefixes
  const stripped = urlPath.replace(/^\/(v\d+|api)\//i, '/').replace(/^\//, '');
  const segments = stripped.split('/').filter(Boolean);

  const resources: string[] = [];
  for (const seg of segments) {
    const lower = seg.toLowerCase();
    resources.push(lower);

    // Generate singular/plural forms
    if (lower.endsWith('s') && lower.length > 2) {
      // plural -> singular: emails -> email, charges -> charge
      if (lower.endsWith('ies')) {
        resources.push(lower.slice(0, -3) + 'y'); // e.g. entries -> entry
      } else if (lower.endsWith('ses') || lower.endsWith('xes') || lower.endsWith('zes')) {
        resources.push(lower.slice(0, -2)); // e.g. buses -> bus
      } else {
        resources.push(lower.slice(0, -1)); // e.g. emails -> email
      }
    } else {
      // singular -> plural
      if (lower.endsWith('y') && !['ay', 'ey', 'oy', 'uy'].some(e => lower.endsWith(e))) {
        resources.push(lower.slice(0, -1) + 'ies'); // e.g. entry -> entries
      } else if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z')) {
        resources.push(lower + 'es');
      } else {
        resources.push(lower + 's');
      }
    }

    // For hyphenated names, also try without hyphens and just the main word
    if (lower.includes('-')) {
      const parts = lower.split('-');
      for (const p of parts) {
        if (p.length > 2) resources.push(p);
        // Also add plural/singular of parts
        if (p.endsWith('s') && p.length > 2) {
          resources.push(p.slice(0, -1));
        } else if (p.length > 2) {
          resources.push(p + 's');
        }
      }
    }
  }

  return { path: urlPath, resources: [...new Set(resources)] };
}

/**
 * Calculate URL path score without fetching content.
 */
function urlPathScore(discoveredUrl: string, endpointPath: string, resources: string[]): number {
  let score = 0;
  let urlPath: string;
  try {
    urlPath = new URL(discoveredUrl).pathname.toLowerCase();
  } catch {
    urlPath = discoveredUrl.toLowerCase();
  }

  const fullUrl = discoveredUrl.toLowerCase();

  // Check if URL path contains the endpoint path segment (e.g. /emails or /v1/emails)
  const endpointSegments = endpointPath.replace(/^\//, '').toLowerCase();
  if (urlPath.includes('/' + endpointSegments) || urlPath.includes(endpointSegments)) {
    score += 50;
  }

  // Check if URL contains any resource name in path
  for (const resource of resources) {
    if (urlPath.includes('/' + resource) || urlPath.includes(resource + '/') || urlPath.endsWith('/' + resource) || fullUrl.includes('/' + resource)) {
      score += 40;
      break; // Only count once for URL path matching
    }
  }

  return score;
}

/**
 * Calculate content-based score by analyzing fetched text.
 */
function contentScore(text: string, endpointPath: string, resources: string[]): { score: number; matches: number } {
  let score = 0;
  let matches = 0;
  const lowerText = text.toLowerCase();

  // Exact endpoint path mentions: +30 per mention (cap 90)
  const endpointLower = endpointPath.toLowerCase();
  const endpointCount = countOccurrences(lowerText, endpointLower);
  if (endpointCount > 0) {
    score += Math.min(endpointCount * 30, 90);
    matches += endpointCount;
  }

  // Resource name mentions: +10 per mention (cap 50)
  for (const resource of resources) {
    const resourceCount = countOccurrences(lowerText, resource);
    if (resourceCount > 0) {
      score += Math.min(resourceCount * 10, 50);
      matches += resourceCount;
      break; // Only count best matching resource to avoid double counting s/plural
    }
  }

  // HTTP method + endpoint: +40 per mention
  const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  for (const method of httpMethods) {
    const pattern = `${method.toLowerCase()} ${endpointLower}`;
    const methodCount = countOccurrences(lowerText, pattern);
    if (methodCount > 0) {
      score += methodCount * 40;
      matches += methodCount;
    }
  }

  // Code examples with endpoint: +20
  const codePatterns = ['```', 'curl ', 'fetch(', 'requests.', 'axios.', 'http.'];
  const hasCode = codePatterns.some(p => lowerText.includes(p));
  if (hasCode && endpointCount > 0) {
    score += 20;
  }

  return { score, matches };
}

function countOccurrences(text: string, search: string): number {
  if (!search || search.length === 0) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

/**
 * Check if a URL is a category that's always relevant.
 */
function isAlwaysRelevant(type: DiscoveryResult['type']): boolean {
  return type === 'changelog' || type === 'status' || type === 'openapi';
}

/**
 * Detect if a URL looks like a docs root (e.g. docs.stripe.com/api, docs.example.com/reference).
 */
function isDocsRoot(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Skip login/redirect URLs — they're not real doc pages
  if (parsed.pathname.includes('login') || parsed.searchParams.has('redirect')) return false;
  // Skip GitHub URLs
  if (parsed.hostname.includes('github.com')) return false;

  const pathname = parsed.pathname.replace(/\/+$/, '');
  const segments = pathname.split('/').filter(Boolean);
  // Root-like if 0-2 path segments AND looks like an API docs page
  if (segments.length > 2) return false;
  const hostname = parsed.hostname.toLowerCase();
  return /\/(api|reference|docs|documentation)(\/|$)/i.test(pathname) ||
    hostname.startsWith('docs.') ||
    hostname.startsWith('developer.');
}

/**
 * Construct endpoint-specific doc URLs from a docs root and resource names.
 */
function constructEndpointUrls(docsRootUrl: string, resources: string[]): string[] {
  const root = docsRootUrl.replace(/\/+$/, '');
  const candidates: Set<string> = new Set();

  for (const resource of resources) {
    // Direct append
    candidates.add(`${root}/${resource}`);
    // With common sub-paths
    candidates.add(`${root}/reference/${resource}`);
    candidates.add(`${root}/endpoints/${resource}`);
    // With version prefix
    candidates.add(`${root}/v1/${resource}`);
    candidates.add(`${root}/v2/${resource}`);
    // Hash-based (for single-page docs)
    candidates.add(`${root}#${resource}`);
  }

  return [...candidates];
}

/**
 * Crawl a doc root page 1 level deep to find links containing resource names.
 */
async function crawlDocPageForResources(
  docUrl: string,
  resources: string[],
): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];
  const res = await safeGet(docUrl);
  if (!res?.ok || !res.text) return results;

  const $ = cheerio.load(res.text);
  const seen = new Set<string>();
  let baseOrigin: string;
  try {
    baseOrigin = new URL(docUrl).origin;
  } catch {
    return results;
  }

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    let fullUrl: string;
    try {
      fullUrl = new URL(href, docUrl).href;
    } catch {
      return;
    }

    // Only follow links on same origin
    try {
      if (new URL(fullUrl).origin !== baseOrigin) return;
    } catch {
      return;
    }

    const normalized = fullUrl.replace(/\/+$/, '').toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const lowerUrl = fullUrl.toLowerCase();
    // Check if the link contains any resource name
    for (const resource of resources) {
      if (lowerUrl.includes('/' + resource) || lowerUrl.includes('#' + resource)) {
        results.push({
          url: fullUrl,
          method: 'doc_crawl',
          confidence: 0.9,
          type: classifyUrl(fullUrl, 'docs'),
        });
        break;
      }
    }
  });

  return results;
}

/**
 * Filter discovered URLs by relevance to a specific endpoint.
 */
export async function filterByRelevance(
  endpointUrl: string,
  domainResult: DomainResult,
): Promise<RelevanceResult> {
  const { path: endpointPath, resources } = extractResources(endpointUrl);

  const allUrls: DiscoveryResult[] = [
    ...domainResult.discovered.docs,
    ...domainResult.discovered.changelog,
    ...domainResult.discovered.status,
    ...domainResult.discovered.openapi,
  ];

  const totalBefore = allUrls.length;

  // Separate always-relevant from docs that need scoring
  const changelog: RelevanceEntry[] = domainResult.discovered.changelog.map(r => ({
    url: r.url, type: r.type, score: 100, matches: 0, alwaysRelevant: true, reason: 'changelog',
  }));
  const status: RelevanceEntry[] = domainResult.discovered.status.map(r => ({
    url: r.url, type: r.type, score: 100, matches: 0, alwaysRelevant: true, reason: 'status page',
  }));
  const openapi: RelevanceEntry[] = domainResult.discovered.openapi.map(r => ({
    url: r.url, type: r.type, score: 100, matches: 0, alwaysRelevant: true, reason: 'openapi spec',
  }));

  // ── NEW: Endpoint-specific URL construction ──
  // Find doc roots and try constructing specific endpoint URLs
  const docRoots = domainResult.discovered.docs.filter(d => isDocsRoot(d.url));
  const constructedUrls: string[] = [];
  const constructedFound: RelevanceEntry[] = [];
  const docsRootUrls = new Set<string>(); // Track which roots produced specific pages

  if (docRoots.length > 0 && resources.length > 0) {
    console.log(`   🔗 Endpoint construction: trying specific URLs from ${docRoots.length} doc root(s)...`);

    for (const root of docRoots) {
      const candidates = constructEndpointUrls(root.url, resources);
      constructedUrls.push(...candidates);
    }

    // Also crawl doc root pages 1 level deep to find resource-specific links
    console.log(`   🕷️  Crawling doc root pages for resource-specific links...`);
    const crawlTasks = docRoots.slice(0, 3).map(root => async () => {
      return crawlDocPageForResources(root.url, resources);
    });
    const crawlResults = await parallelLimit(crawlTasks, 3);
    for (const results of crawlResults) {
      for (const r of results) {
        const normalized = r.url.replace(/\/+$/, '').toLowerCase();
        if (!constructedUrls.some(u => u.replace(/\/+$/, '').toLowerCase() === normalized)) {
          constructedUrls.push(r.url);
        }
      }
    }

    // HEAD request each candidate (parallel, 5s timeout)
    const uniqueCandidates = [...new Set(constructedUrls.map(u => u.replace(/\/+$/, '')))];
    // Filter out hash-based URLs from HEAD checks (they'll resolve to the same page)
    const headCandidates = uniqueCandidates.filter(u => !u.includes('#'));
    const hashCandidates = uniqueCandidates.filter(u => u.includes('#'));

    console.log(`   🔗 Checking ${headCandidates.length} constructed URLs...`);

    const headTasks = headCandidates.map(candidateUrl => async () => {
      const headRes = await safeHead(candidateUrl);
      return { url: candidateUrl, ok: headRes?.ok ?? false };
    });

    const headResults = await parallelLimit(headTasks, 10);

    for (const { url: candidateUrl, ok } of headResults) {
      if (ok) {
        console.log(`   ✅ Found specific page: ${candidateUrl}`);
        constructedFound.push({
          url: candidateUrl,
          type: 'docs',
          score: 200, // High score to beat root pages
          matches: 0,
          alwaysRelevant: false,
          reason: 'endpoint_construction',
        });

        // Track which root produced this
        for (const root of docRoots) {
          if (candidateUrl.startsWith(root.url.replace(/\/+$/, ''))) {
            docsRootUrls.add(root.url.replace(/\/+$/, '').toLowerCase());
          }
        }
      }
    }

    // Only add hash candidates if no non-hash specific pages were found
    if (constructedFound.length === 0) {
      for (const hashUrl of hashCandidates) {
        const baseUrl = hashUrl.split('#')[0].replace(/\/+$/, '');
        if (docRoots.some(r => r.url.replace(/\/+$/, '') === baseUrl)) {
          constructedFound.push({
            url: hashUrl,
            type: 'docs',
            score: 150,
            matches: 0,
            alwaysRelevant: false,
            reason: 'endpoint_construction (hash)',
          });
        }
      }
    }
  }

  // Score doc URLs
  const docEntries: RelevanceEntry[] = [];
  const docsToScore = domainResult.discovered.docs;

  // Phase 1: URL path scoring (fast, no fetch)
  const pathScored = docsToScore.map(r => ({
    result: r,
    pathScore: urlPathScore(r.url, endpointPath, resources),
  }));

  // Phase 2: Content fetch for URLs with path score > 0, or top 20 by other signals
  const sorted = pathScored.sort((a, b) => b.pathScore - a.pathScore);
  
  // Fetch: all with path score > 0, PLUS top API reference pages (likely contain endpoint refs)
  const withPathScore = sorted.filter(s => s.pathScore > 0);
  const apiRefPages = sorted
    .filter(s => s.pathScore === 0)
    .filter(s => {
      const lower = s.result.url.toLowerCase();
      return lower.includes('/api') || lower.includes('/reference') || lower.includes('/docs/api');
    })
    .slice(0, 5); // Max 5 API reference pages to check
  
  const needsFetch = [...withPathScore, ...apiRefPages].slice(0, 20);

  console.log(`   🔍 Relevance: scoring ${docsToScore.length} docs, fetching content for ${needsFetch.length}...`);

  for (const item of needsFetch) {
    const { result, pathScore } = item;
    let totalScore = pathScore;
    let totalMatches = 0;

    // Fetch content for scoring
    const fetched = await safeGet(result.url);
    if (fetched?.ok && fetched.text) {
      const { score: cScore, matches } = contentScore(fetched.text, endpointPath, resources);
      totalScore += cScore;
      totalMatches = matches;
    }

    docEntries.push({
      url: result.url,
      type: result.type,
      score: totalScore,
      matches: totalMatches,
      alwaysRelevant: false,
    });
  }

  // Also add path-scored entries that we didn't fetch but had some score
  for (const item of pathScored) {
    if (!needsFetch.includes(item) && item.pathScore > 0) {
      docEntries.push({
        url: item.result.url,
        type: item.result.type,
        score: item.pathScore,
        matches: 0,
        alwaysRelevant: false,
      });
    }
  }

  // ── NEW: Merge constructed entries and demote root pages ──
  // Add constructed entries that aren't already in docEntries
  for (const constructed of constructedFound) {
    const normalizedConstructed = constructed.url.replace(/\/+$/, '').toLowerCase();
    const existing = docEntries.find(e => e.url.replace(/\/+$/, '').toLowerCase() === normalizedConstructed);
    if (existing) {
      // Boost existing entry
      existing.score = Math.max(existing.score, constructed.score);
      existing.reason = constructed.reason;
    } else {
      docEntries.push(constructed);
    }
  }

  // If we found specific endpoint pages, demote the root docs pages
  if (constructedFound.length > 0) {
    for (const entry of docEntries) {
      const normalizedEntry = entry.url.replace(/\/+$/, '').toLowerCase();
      // Check if this entry is a root that produced a specific page
      if (docsRootUrls.has(normalizedEntry) || docRoots.some(r => r.url.replace(/\/+$/, '').toLowerCase() === normalizedEntry)) {
        // Check it's not itself a constructed entry
        const isConstructed = constructedFound.some(c => c.url.replace(/\/+$/, '').toLowerCase() === normalizedEntry);
        if (!isConstructed) {
          console.log(`   ⬇️  Demoting root page: ${entry.url} (score ${entry.score} → ${Math.min(entry.score, 10)})`);
          entry.score = Math.min(entry.score, 10); // Demote below threshold
          entry.reason = 'demoted: specific endpoint page found';
        }
      }
    }
  }

  // Sort by score and take top 3 with score > 20
  const relevantDocs = docEntries
    .sort((a, b) => b.score - a.score)
    .filter(e => e.score > 20)
    .slice(0, 3);

  const alwaysRelevantCount = changelog.length + status.length + openapi.length;
  const filteredOut = totalBefore - alwaysRelevantCount - relevantDocs.length;

  return {
    endpoint: endpointUrl,
    endpointPath,
    resources,
    changelog,
    status,
    openapi,
    relevantDocs,
    filteredOut: Math.max(0, filteredOut),
    totalBefore,
  };
}
