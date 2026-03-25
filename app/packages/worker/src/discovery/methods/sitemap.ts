import type { MethodResult, DiscoveryResult } from '../types.js';
import { safeGet, classifyUrl } from '../utils.js';

const KEYWORDS = /changelog|release|update|docs|api|status|what.?s.?new|reference|developer/i;

export async function sitemapParse(domain: string): Promise<MethodResult> {
  const results: DiscoveryResult[] = [];

  for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
    const url = `https://${domain}${path}`;
    const res = await safeGet(url);
    if (!res || !res.ok || !res.text.includes('<')) continue;

    // Simple XML parsing without external dependency — extract <loc> tags
    const locMatches = res.text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);
    let count = 0;
    for (const match of locMatches) {
      if (count >= 50) break;
      const loc = match[1];
      if (loc && KEYWORDS.test(loc)) {
        results.push({ url: loc, method: 'sitemap', confidence: 0.75, type: classifyUrl(loc) });
        count++;
      }
    }

    // Check for sitemap index entries
    const sitemapMatches = res.text.matchAll(/<sitemap>\s*<loc>\s*(.*?)\s*<\/loc>/gi);
    for (const match of sitemapMatches) {
      const sitemapUrl = match[1];
      if (sitemapUrl && KEYWORDS.test(sitemapUrl)) {
        const subRes = await safeGet(sitemapUrl);
        if (subRes?.ok) {
          const subLocs = subRes.text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);
          let subCount = 0;
          for (const subMatch of subLocs) {
            if (subCount >= 50) break;
            const subLoc = subMatch[1];
            if (subLoc && KEYWORDS.test(subLoc)) {
              results.push({ url: subLoc, method: 'sitemap', confidence: 0.75, type: classifyUrl(subLoc) });
              subCount++;
            }
          }
        }
      }
    }
  }

  return { method: 'sitemap', results };
}
