import { DomainResult, MethodResult, DiscoveryResult } from './types.js';
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

  // Phase 1: Run independent methods first
  console.log(`  [1/9] Subdomain probing...`);
  const subdomainResult = await runSafe(() => subdomainProbe(baseDomain), 'subdomain', errors);
  
  // Extract discovered hosts for later methods
  const discoveredHosts = subdomainResult.results
    .filter(r => r.type === 'docs')
    .map(r => new URL(r.url).hostname);

  console.log(`  [2/9] Path probing...`);
  const pathResult = await runSafe(() => pathProbe(baseDomain, discoveredHosts), 'path_probe', errors);

  console.log(`  [3/9] Sitemap parsing...`);
  const sitemapResult = await runSafe(() => sitemapParse(baseDomain), 'sitemap', errors);

  console.log(`  [4/9] robots.txt parsing...`);
  const robotsResult = await runSafe(() => robotsParse(baseDomain), 'robots', errors);

  console.log(`  [5/9] Homepage link extraction...`);
  const homepageResult = await runSafe(() => homepageLinkExtraction(baseDomain), 'homepage_link', errors);

  // Collect discovered doc URLs for OpenAPI and platform checks
  const allDocUrls = [...subdomainResult.results, ...pathResult.results, ...homepageResult.results]
    .filter(r => r.type === 'docs')
    .map(r => r.url)
    .slice(0, 3);

  console.log(`  [6/9] OpenAPI/Swagger probing...`);
  const openapiResult = await runSafe(() => openapiProbe(baseDomain, discoveredHosts), 'openapi_probe', errors);

  console.log(`  [7/9] Platform fingerprinting...`);
  const platformResult = await runSafe(() => platformFingerprint(baseDomain, allDocUrls), 'platform_fingerprint', errors);

  console.log(`  [8/9] Search engine query...`);
  const searchResult = await runSafe(() => searchEngineQuery(baseDomain), 'search', errors);

  console.log(`  [9/9] GitHub repo discovery...`);
  const githubResult = await runSafe(() => githubDiscovery(baseDomain), 'github', errors);

  // Collect all results
  const allMethods = [
    subdomainResult, pathResult, sitemapResult, robotsResult,
    homepageResult, openapiResult, platformResult, searchResult, githubResult,
  ];

  for (const m of allMethods) {
    if (m.results.length > 0) methodsSucceeded++;
  }

  const allResults = allMethods.flatMap(m => m.results);
  const totalRaw = allResults.length;

  // Run dedup: normalize URLs, resolve redirects, merge duplicates
  console.log(`  [dedup] Deduplicating ${totalRaw} raw URLs...`);
  const { results: deduped, stats: dedupStats } = await deduplicateResults(allResults, {
    resolveRedirects: true,
    concurrency: 10,
  });
  console.log(`  [dedup] Discovered ${totalRaw} URLs, deduplicated to ${deduped.length} unique pages`);
  if (dedupStats.redirectsResolved > 0) {
    console.log(`  [dedup] Resolved ${dedupStats.redirectsResolved} redirects (${dedupStats.redirectsCached} cached)`);
  }

  // Categorize
  const docs = deduped.filter(r => r.type === 'docs');
  const changelog = deduped.filter(r => r.type === 'changelog');
  const status = deduped.filter(r => r.type === 'status');
  const openapi = deduped.filter(r => r.type === 'openapi');

  // Extract platforms
  const platforms = platformResult.results
    .filter(r => r.meta?.platform)
    .map(r => r.meta!.platform);

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

async function runSafe(fn: () => Promise<MethodResult>, name: string, errors: string[]): Promise<MethodResult> {
  try {
    const result = await fn();
    if (result.error) {
      errors.push(`${name}: ${result.error}`);
    }
    return result;
  } catch (err: any) {
    errors.push(`${name}: ${err.message}`);
    return { method: name, results: [] };
  }
}
