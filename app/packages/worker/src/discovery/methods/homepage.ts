import * as cheerio from 'cheerio';
import type { MethodResult, DiscoveryResult } from '../types.js';
import { safeGet, classifyUrl } from '../utils.js';

const LINK_KEYWORDS = /docs|documentation|api|developer|changelog|status|reference|release|guide/i;

function isDocRoot(url: string): boolean {
  const lower = url.toLowerCase().replace(/\/+$/, '');
  return /\/(api|reference|docs|documentation)(\/|$)/.test(lower) ||
    /docs\./.test(new URL(url).hostname) ||
    /developer\./.test(new URL(url).hostname);
}

function extractLinksFromHtml(
  html: string,
  baseUrl: string,
  domain: string,
  seen: Set<string>,
): DiscoveryResult[] {
  const results: DiscoveryResult[] = [];
  const $ = cheerio.load(html);
  const baseParts = domain.split('.').slice(-2).join('.');

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (!href) return;

    const matches = LINK_KEYWORDS.test(href) || LINK_KEYWORDS.test(text);
    if (!matches) return;

    let fullUrl: string;
    try { fullUrl = new URL(href, baseUrl).href; } catch { return; }

    try {
      const linkDomain = new URL(fullUrl).hostname;
      if (!linkDomain.includes(baseParts) && !linkDomain.includes('github.com') &&
          !linkDomain.includes('readme.io') && !linkDomain.includes('gitbook.io')) return;
    } catch { return; }

    const normalized = fullUrl.replace(/\/+$/, '').toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);

    results.push({
      url: fullUrl, method: 'homepage_link', confidence: 0.8,
      type: classifyUrl(fullUrl), meta: { linkText: text.slice(0, 100) },
    });
  });

  return results;
}

export async function homepageLinkExtraction(domain: string): Promise<MethodResult> {
  const results: DiscoveryResult[] = [];
  const seen = new Set<string>();

  const url = `https://${domain}`;
  const res = await safeGet(url);
  if (!res || !res.ok) return { method: 'homepage_link', results };

  const homepageLinks = extractLinksFromHtml(res.text, url, domain, seen);
  results.push(...homepageLinks);

  const docRoots = homepageLinks.filter((r) => {
    try { return isDocRoot(r.url); } catch { return false; }
  }).slice(0, 3);

  for (const docRoot of docRoots) {
    const deepRes = await safeGet(docRoot.url);
    if (deepRes?.ok && deepRes.text) {
      const deepLinks = extractLinksFromHtml(deepRes.text, docRoot.url, domain, seen);
      for (const link of deepLinks) {
        link.confidence = 0.75;
        link.meta = { ...link.meta, source: `crawled from ${docRoot.url}` };
      }
      results.push(...deepLinks);
    }
  }

  return { method: 'homepage_link', results };
}
