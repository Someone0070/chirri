import type { DomainResult, MethodResult } from './types.js';
import { getBaseDomain } from './utils.js';
import { deduplicateResults } from './dedup.js';
import { subdomainProbe } from './methods/subdomain.js';
import { pathProbe } from './methods/paths.js';
import { sitemapParse } from './methods/sitemap.js';
import { robotsParse } from './methods/robots.js';
import { homepageLinkExtraction } from './methods/homepage.js';
import { openapiProbe } from './methods/openapi.js';
import { platformFingerprint } from './methods/platform.js';
import { searchEngineQuery } from './methods/search.js';
import { githubDiscovery } from './methods/github.js';

export async function discoverDomain(domain: string): Promise<DomainResult> {
  const start = Date.now();
  const baseDomain = getBaseDomain(domain);
  const errors: string[] = [];
  let methodsSucceeded = 0;

  console.log(`[discovery] Starting discovery for ${baseDomain}`);

  const subdomainResult = await runSafe(() => subdomainProbe(baseDomain), 'subdomain', errors);
  const discoveredHosts = subdomainResult.results
    .filter((r) => r.type === 'docs')
    .map((r) => new URL(r.url).hostname);

  const pathResult = await runSafe(() => pathProbe(baseDomain, discoveredHosts), 'path_probe', errors);
  const sitemapResult = await runSafe(() => sitemapParse(baseDomain), 'sitemap', errors);
  const robotsResult = await runSafe(() => robotsParse(baseDomain), 'robots', errors);
  const homepageResult = await runSafe(() => homepageLinkExtraction(baseDomain), 'homepage_link', errors);

  const allDocUrls = [...subdomainResult.results, ...pathResult.results, ...homepageResult.results]
    .filter((r) => r.type === 'docs')
    .map((r) => r.url)
    .slice(0, 3);

  const openapiResult = await runSafe(() => openapiProbe(baseDomain, discoveredHosts), 'openapi_probe', errors);
  const platformResult = await runSafe(() => platformFingerprint(baseDomain, allDocUrls), 'platform_fingerprint', errors);
  const searchResult = await runSafe(() => searchEngineQuery(baseDomain), 'search', errors);
  const githubResult = await runSafe(() => githubDiscovery(baseDomain), 'github', errors);

  const allMethods = [
    subdomainResult, pathResult, sitemapResult, robotsResult,
    homepageResult, openapiResult, platformResult, searchResult, githubResult,
  ];

  for (const m of allMethods) { if (m.results.length > 0) methodsSucceeded++; }

  const allResults = allMethods.flatMap((m) => m.results);
  const totalRaw = allResults.length;

  const { results: deduped, stats: dedupStats } = await deduplicateResults(allResults, {
    resolveRedirects: true,
    concurrency: 10,
  });

  console.log(`[discovery] Discovered ${totalRaw} URLs, deduplicated to ${deduped.length} unique pages`);

  const docs = deduped.filter((r) => r.type === 'docs');
  const changelog = deduped.filter((r) => r.type === 'changelog');
  const status = deduped.filter((r) => r.type === 'status');
  const openapi = deduped.filter((r) => r.type === 'openapi');

  const platforms = platformResult.results
    .filter((r) => r.meta?.platform)
    .map((r) => r.meta!.platform);

  return {
    domain: baseDomain,
    discovered: {
      docs: docs.sort((a, b) => b.confidence - a.confidence),
      changelog: changelog.sort((a, b) => b.confidence - a.confidence),
      status: status.sort((a, b) => b.confidence - a.confidence),
      openapi: openapi.sort((a, b) => b.confidence - a.confidence),
    },
    platforms: [...new Set(platforms)],
    methods_tried: 9,
    methods_succeeded: methodsSucceeded,
    total_discovered: deduped.length,
    total_raw: totalRaw,
    dedup_stats: dedupStats,
    duration_ms: Date.now() - start,
    errors,
  };
}

async function runSafe(
  fn: () => Promise<MethodResult>,
  name: string,
  errors: string[],
): Promise<MethodResult> {
  try {
    const result = await fn();
    if (result.error) errors.push(`${name}: ${result.error}`);
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`${name}: ${message}`);
    return { method: name, results: [] };
  }
}
