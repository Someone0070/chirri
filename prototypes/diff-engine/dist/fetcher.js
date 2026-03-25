/**
 * Fetcher - HTTP fetch + Playwright fallback for JS-rendered pages
 */
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
/**
 * Fetch a URL via plain HTTP
 */
async function httpFetch(url, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: controller.signal,
            redirect: 'follow',
        });
        if (!resp.ok)
            throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        return await resp.text();
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Fetch a URL via Playwright (headless Chrome)
 */
async function playwrightFetch(url, timeoutMs = 30000) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({
            userAgent: USER_AGENT,
        });
        await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
        // Wait a bit for any late JS rendering
        await page.waitForTimeout(2000);
        return await page.content();
    }
    finally {
        await browser.close();
    }
}
/**
 * Extract readability text from HTML
 */
function extractReadability(html, url) {
    try {
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        return article?.textContent?.trim() || '';
    }
    catch {
        return '';
    }
}
/**
 * Extract structural DOM (tag structure only, no text content)
 */
function extractStructuralDom(html) {
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        function walkNode(node, depth) {
            if (node.nodeType === 3)
                return ''; // Skip text nodes
            if (node.nodeType !== 1)
                return ''; // Only element nodes
            const el = node;
            const tag = el.tagName.toLowerCase();
            // Skip script, style, svg, noscript
            if (['script', 'style', 'svg', 'noscript', 'link', 'meta'].includes(tag))
                return '';
            const indent = '  '.repeat(depth);
            const children = Array.from(el.childNodes)
                .map(child => walkNode(child, depth + 1))
                .filter(Boolean)
                .join('\n');
            // Include semantic attributes only
            const attrs = [];
            for (const attr of ['role', 'aria-label', 'type', 'rel', 'href', 'src']) {
                if (el.hasAttribute(attr)) {
                    let val = el.getAttribute(attr) || '';
                    // Truncate long values
                    if (val.length > 50)
                        val = val.substring(0, 50) + '...';
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
    }
    catch {
        return '';
    }
}
/**
 * Extract text-only content (strip all HTML)
 */
function extractTextOnly(html) {
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        // Remove script and style elements
        doc.querySelectorAll('script, style, noscript, svg').forEach((el) => el.remove());
        return doc.body?.textContent?.trim() || '';
    }
    catch {
        return '';
    }
}
/**
 * Check if HTML looks like it needs JS rendering (minimal content)
 */
function needsJsRendering(html) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    doc.querySelectorAll('script, style, noscript, svg').forEach((el) => el.remove());
    const textContent = doc.body?.textContent?.trim() || '';
    // If body text is very short, likely needs JS
    return textContent.length < 200;
}
/**
 * Fetch a URL and generate all 4 snapshot types
 */
export async function fetchUrl(url, usePlaywright = false) {
    const start = Date.now();
    let html = '';
    let method = 'http';
    try {
        // Try HTTP first
        html = await httpFetch(url);
        // If content is too thin, try Playwright
        if (usePlaywright && needsJsRendering(html)) {
            try {
                html = await playwrightFetch(url);
                method = 'playwright';
            }
            catch (pwErr) {
                // Fall back to HTTP result
                console.warn(`  Playwright fallback failed for ${url}: ${pwErr}`);
            }
        }
        return {
            url,
            rawHtml: html,
            readabilityText: extractReadability(html, url),
            structuralDom: extractStructuralDom(html),
            textOnly: extractTextOnly(html),
            fetchMethod: method,
            fetchTimeMs: Date.now() - start,
        };
    }
    catch (err) {
        // If HTTP fails entirely and Playwright is enabled, try Playwright
        if (usePlaywright) {
            try {
                html = await playwrightFetch(url);
                method = 'playwright';
                return {
                    url,
                    rawHtml: html,
                    readabilityText: extractReadability(html, url),
                    structuralDom: extractStructuralDom(html),
                    textOnly: extractTextOnly(html),
                    fetchMethod: method,
                    fetchTimeMs: Date.now() - start,
                };
            }
            catch (pwErr) {
                return {
                    url,
                    rawHtml: '',
                    readabilityText: '',
                    structuralDom: '',
                    textOnly: '',
                    fetchMethod: 'http',
                    fetchTimeMs: Date.now() - start,
                    error: `HTTP: ${err.message}; Playwright: ${pwErr.message}`,
                };
            }
        }
        return {
            url,
            rawHtml: '',
            readabilityText: '',
            structuralDom: '',
            textOnly: '',
            fetchMethod: 'http',
            fetchTimeMs: Date.now() - start,
            error: err.message,
        };
    }
}
