import { MethodResult, DiscoveryResult } from '../types.js';
import { classifyUrl } from '../utils.js';

/**
 * Search engine discovery via Brave Search API.
 * 
 * This is a stub that returns empty results when run as a CLI tool.
 * When integrated with the OpenClaw agent, the web_search tool handles the actual API calls.
 * 
 * For CLI testing, set BRAVE_API_KEY env var to enable direct API calls.
 */
export async function searchEngineQuery(domain: string): Promise<MethodResult> {
  const results: DiscoveryResult[] = [];
  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    return {
      method: 'search',
      results,
      error: 'BRAVE_API_KEY not set - search method skipped',
    };
  }

  try {
    const query = encodeURIComponent(`site:${domain} changelog OR release-notes OR api-documentation OR docs`);
    const url = `https://api.search.brave.com/res/v1/web/search?q=${query}&count=10`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!res.ok) {
      return { method: 'search', results, error: `Brave API returned ${res.status}` };
    }

    const data = await res.json() as any;
    const webResults = data.web?.results || [];

    for (const r of webResults) {
      if (r.url) {
        results.push({
          url: r.url,
          method: 'search',
          confidence: 0.7,
          type: classifyUrl(r.url),
          meta: { title: r.title || '', snippet: (r.description || '').slice(0, 200) },
        });
      }
    }
  } catch (err: any) {
    return { method: 'search', results, error: err.message };
  }

  return { method: 'search', results };
}
