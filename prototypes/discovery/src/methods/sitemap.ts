import { XMLParser } from 'fast-xml-parser';
import { MethodResult, DiscoveryResult } from '../types.js';
import { safeGet, classifyUrl } from '../utils.js';

const KEYWORDS = /changelog|release|update|docs|api|status|what.?s.?new|reference|developer/i;

export async function sitemapParse(domain: string): Promise<MethodResult> {
  const results: DiscoveryResult[] = [];
  const parser = new XMLParser({ ignoreAttributes: false });

  for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
    const url = `https://${domain}${path}`;
    const res = await safeGet(url);
    if (!res || !res.ok || !res.text.includes('<')) continue;

    try {
      const parsed = parser.parse(res.text);

      // Handle sitemap index
      const sitemapUrls: string[] = [];
      if (parsed.sitemapindex?.sitemap) {
        const sitemaps = Array.isArray(parsed.sitemapindex.sitemap) 
          ? parsed.sitemapindex.sitemap 
          : [parsed.sitemapindex.sitemap];
        for (const s of sitemaps.slice(0, 5)) {
          const loc = s.loc || s;
          if (typeof loc === 'string' && KEYWORDS.test(loc)) {
            // Fetch this sub-sitemap
            const subRes = await safeGet(loc);
            if (subRes?.ok) {
              try {
                const subParsed = parser.parse(subRes.text);
                extractUrls(subParsed, results);
              } catch {}
            }
          }
        }
      }

      // Handle regular sitemap
      extractUrls(parsed, results);
    } catch {}
  }

  return { method: 'sitemap', results };
}

function extractUrls(parsed: any, results: DiscoveryResult[]) {
  if (!parsed.urlset?.url) return;
  const urls = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
  
  let count = 0;
  for (const u of urls) {
    if (count >= 50) break; // Limit matches
    const loc = u.loc || u;
    if (typeof loc === 'string' && KEYWORDS.test(loc)) {
      results.push({
        url: loc,
        method: 'sitemap',
        confidence: 0.75,
        type: classifyUrl(loc),
      });
      count++;
    }
  }
}
