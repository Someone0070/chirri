/**
 * Fetcher - 3-Tier fetch strategy with __NEXT_DATA__ extraction
 *
 * Tier 1: Basic fetch (no special headers) — free, fastest
 * Tier 2: Browser-emulated fetch (full browser headers) — free, slightly slower
 * Tier 3: Rendering service (stub) — paid, last resort
 */

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export type FetchTier = 1 | 2 | 3;

export interface FetchResult {
  url: string;
  rawHtml: string;
  readabilityText: string;
  structuralDom: string;
  textOnly: string;
  fetchMethod: 'http' | 'playwright';
  fetchTier: FetchTier;
  fetchTimeMs: number;
  error?: string;
}

/** URLs that needed Tier 3 (for cost estimation) */
export const tier3Needed: { url: string; textLength: number }[] = [];

// ─── Tier 1: Basic fetch (no special headers) ───────────────────────────────

async function basicFetch(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Tier 2: Browser-emulated fetch (full browser headers) ──────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

async function browserFetch(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

// ─── __NEXT_DATA__ extraction ────────────────────────────────────────────────

/**
 * Extract text content from __NEXT_DATA__ JSON embedded in Next.js pages.
 * This gives us rendered content for free on any Next.js site.
 */
function extractNextData(html: string): string {
  try {
    const match = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/i);
    if (!match) return '';

    const data = JSON.parse(match[1]);
    const texts: string[] = [];

    // Recursively extract string values from the page props
    function walk(obj: any, depth = 0): void {
      if (depth > 15) return; // prevent infinite recursion
      if (typeof obj === 'string') {
        const trimmed = obj.trim();
        // Only collect meaningful text (skip URLs, hashes, short tokens)
        if (trimmed.length > 20 && !trimmed.startsWith('http') && !trimmed.startsWith('/') && !/^[a-f0-9]{32,}$/i.test(trimmed)) {
          texts.push(trimmed);
        }
      } else if (Array.isArray(obj)) {
        for (const item of obj) walk(item, depth + 1);
      } else if (obj && typeof obj === 'object') {
        for (const val of Object.values(obj)) walk(val, depth + 1);
      }
    }

    walk(data.props);
    return texts.join('\n');
  } catch {
    return '';
  }
}

// ─── Text extraction helpers ─────────────────────────────────────────────────

/**
 * Extract readable text from HTML (strip tags, scripts, styles)
 */
function extractText(html: string): string {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    doc.querySelectorAll('script, style, noscript, svg').forEach((el: Element) => el.remove());
    return doc.body?.textContent?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Extract readability text from HTML
 */
function extractReadability(html: string, url: string): string {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    return article?.textContent?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Extract structural DOM (tag structure only, no text content)
 */
function extractStructuralDom(html: string): string {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    function walkNode(node: Node, depth: number): string {
      if (node.nodeType === 3) return ''; // Skip text nodes
      if (node.nodeType !== 1) return ''; // Only element nodes

      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      // Skip script, style, svg, noscript
      if (['script', 'style', 'svg', 'noscript', 'link', 'meta'].includes(tag)) return '';

      const indent = '  '.repeat(depth);
      const children = Array.from(el.childNodes)
        .map(child => walkNode(child, depth + 1))
        .filter(Boolean)
        .join('\n');

      // Include semantic attributes only
      const attrs: string[] = [];
      for (const attr of ['role', 'aria-label', 'type', 'rel', 'href', 'src']) {
        if (el.hasAttribute(attr)) {
          let val = el.getAttribute(attr) || '';
          if (val.length > 50) val = val.substring(0, 50) + '...';
          attrs.push(`${attr}="${val}"`);
        }
      }
      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

      if (children) {
        return `${indent}<${tag}${attrStr}>\n${children}\n${indent}</${tag}>`;
      }
      return `${indent}<${tag}${attrStr}/>`;
    }

    return walkNode(doc.documentElement, 0);
  } catch {
    return '';
  }
}

/**
 * Extract text-only content (strip all HTML)
 */
function extractTextOnly(html: string): string {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    doc.querySelectorAll('script, style, noscript, svg').forEach((el: Element) => el.remove());
    return doc.body?.textContent?.trim() || '';
  } catch {
    return '';
  }
}

// ─── 3-Tier Fetch Strategy ──────────────────────────────────────────────────

const MIN_TEXT_LENGTH = 500;

/**
 * Core 3-tier fetch: try basic → browser headers → rendering stub
 * Also checks __NEXT_DATA__ before escalating to Tier 3.
 */
async function fetchPage(url: string): Promise<{ html: string; tier: FetchTier; textLength: number }> {
  // Tier 1: basic fetch (no headers)
  try {
    let html = await basicFetch(url);
    let text = extractText(html);
    if (text.length > MIN_TEXT_LENGTH) {
      return { html, tier: 1, textLength: text.length };
    }

    // Check __NEXT_DATA__ before moving to Tier 2
    const nextData = extractNextData(html);
    if (nextData.length > MIN_TEXT_LENGTH) {
      // Tier 1 HTML is fine, we just needed Next.js extraction
      return { html, tier: 1, textLength: nextData.length };
    }
  } catch (err: any) {
    // Tier 1 failed entirely, continue to Tier 2
  }

  // Tier 2: browser-emulated fetch
  try {
    let html = await browserFetch(url);
    let text = extractText(html);
    if (text.length > MIN_TEXT_LENGTH) {
      return { html, tier: 2, textLength: text.length };
    }

    // Check __NEXT_DATA__ before moving to Tier 3
    const nextData = extractNextData(html);
    if (nextData.length > MIN_TEXT_LENGTH) {
      return { html, tier: 2, textLength: nextData.length };
    }

    // Tier 3: rendering service (stub)
    console.log(`  [TIER 3 NEEDED] ${url} — only ${text.length} chars after browser fetch`);
    tier3Needed.push({ url, textLength: text.length });
    return { html, tier: 3, textLength: text.length };
  } catch (err: any) {
    // Tier 2 also failed entirely
    console.log(`  [TIER 3 NEEDED] ${url} — both Tier 1 and Tier 2 fetch failed: ${err.message}`);
    tier3Needed.push({ url, textLength: 0 });
    return { html: '', tier: 3, textLength: 0 };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch a URL using the 3-tier strategy and generate all snapshot types.
 * The `usePlaywright` parameter is kept for backward compat but is now ignored
 * (Playwright is replaced by the tiered approach).
 */
export async function fetchUrl(url: string, _usePlaywright = false): Promise<FetchResult> {
  const start = Date.now();

  try {
    const { html, tier, textLength } = await fetchPage(url);

    if (!html) {
      return {
        url,
        rawHtml: '',
        readabilityText: '',
        structuralDom: '',
        textOnly: '',
        fetchMethod: 'http',
        fetchTier: tier,
        fetchTimeMs: Date.now() - start,
        error: `All fetch tiers failed (tier ${tier}, ${textLength} chars)`,
      };
    }

    return {
      url,
      rawHtml: html,
      readabilityText: extractReadability(html, url),
      structuralDom: extractStructuralDom(html),
      textOnly: extractTextOnly(html),
      fetchMethod: 'http',
      fetchTier: tier,
      fetchTimeMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      url,
      rawHtml: '',
      readabilityText: '',
      structuralDom: '',
      textOnly: '',
      fetchMethod: 'http',
      fetchTier: 3,
      fetchTimeMs: Date.now() - start,
      error: err.message,
    };
  }
}
