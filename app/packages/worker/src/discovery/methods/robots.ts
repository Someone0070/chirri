import type { MethodResult } from '../types.js';
import { safeGet, classifyUrl } from '../utils.js';

const DOC_PATTERNS = /\/docs|\/api|\/developer|\/changelog|\/reference|\/status|\/release/i;

export async function robotsParse(domain: string): Promise<MethodResult> {
  const results: MethodResult['results'] = [];

  const url = `https://${domain}/robots.txt`;
  const res = await safeGet(url);
  if (!res || !res.ok) return { method: 'robots', results };

  const lines = res.text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.toLowerCase().startsWith('sitemap:')) {
      const sitemapUrl = trimmed.slice(8).trim();
      if (sitemapUrl) {
        results.push({ url: sitemapUrl, method: 'robots', confidence: 0.6, type: 'unknown', meta: { source: 'sitemap_directive' } });
      }
    }

    const match = trimmed.match(/^(?:Allow|Disallow):\s*(.+)/i);
    if (match) {
      const path = match[1].trim();
      if (DOC_PATTERNS.test(path) && !path.includes('*')) {
        const fullUrl = `https://${domain}${path.replace(/\$$/, '')}`;
        results.push({ url: fullUrl, method: 'robots', confidence: 0.4, type: classifyUrl(fullUrl), meta: { source: 'allow_disallow' } });
      }
    }
  }

  return { method: 'robots', results };
}
