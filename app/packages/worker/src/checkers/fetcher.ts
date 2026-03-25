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

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
  Connection: 'keep-alive',
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

function extractNextData(html: string): string {
  try {
    const match = html.match(
      /<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/i,
    );
    if (!match) return '';

    const data = JSON.parse(match[1]);
    const texts: string[] = [];

    function walk(obj: unknown, depth = 0): void {
      if (depth > 15) return;
      if (typeof obj === 'string') {
        const trimmed = obj.trim();
        if (
          trimmed.length > 20 &&
          !trimmed.startsWith('http') &&
          !trimmed.startsWith('/') &&
          !/^[a-f0-9]{32,}$/i.test(trimmed)
        ) {
          texts.push(trimmed);
        }
      } else if (Array.isArray(obj)) {
        for (const item of obj) walk(item, depth + 1);
      } else if (obj && typeof obj === 'object') {
        for (const val of Object.values(obj)) walk(val, depth + 1);
      }
    }

    walk((data as Record<string, unknown>).props);
    return texts.join('\n');
  } catch {
    return '';
  }
}

// ─── Text extraction helpers ─────────────────────────────────────────────────

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

function extractStructuralDom(html: string): string {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    function walkNode(node: Node, depth: number): string {
      if (node.nodeType === 3) return '';
      if (node.nodeType !== 1) return '';

      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      if (['script', 'style', 'svg', 'noscript', 'link', 'meta'].includes(tag)) return '';

      const indent = '  '.repeat(depth);
      const children = Array.from(el.childNodes)
        .map((child) => walkNode(child, depth + 1))
        .filter(Boolean)
        .join('\n');

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

async function fetchPage(
  url: string,
): Promise<{ html: string; tier: FetchTier; textLength: number }> {
  // Tier 1: basic fetch (no headers)
  try {
    const html = await basicFetch(url);
    const text = extractText(html);
    if (text.length > MIN_TEXT_LENGTH) {
      return { html, tier: 1, textLength: text.length };
    }

    const nextData = extractNextData(html);
    if (nextData.length > MIN_TEXT_LENGTH) {
      return { html, tier: 1, textLength: nextData.length };
    }
  } catch {
    // Tier 1 failed entirely, continue to Tier 2
  }

  // Tier 2: browser-emulated fetch
  try {
    const html = await browserFetch(url);
    const text = extractText(html);
    if (text.length > MIN_TEXT_LENGTH) {
      return { html, tier: 2, textLength: text.length };
    }

    const nextData = extractNextData(html);
    if (nextData.length > MIN_TEXT_LENGTH) {
      return { html, tier: 2, textLength: nextData.length };
    }

    // Tier 3: rendering service (stub)
    return { html, tier: 3, textLength: text.length };
  } catch {
    return { html: '', tier: 3, textLength: 0 };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchUrl(url: string): Promise<FetchResult> {
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      url,
      rawHtml: '',
      readabilityText: '',
      structuralDom: '',
      textOnly: '',
      fetchMethod: 'http',
      fetchTier: 3,
      fetchTimeMs: Date.now() - start,
      error: message,
    };
  }
}
