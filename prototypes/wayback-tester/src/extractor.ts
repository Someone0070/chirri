/**
 * Content extraction: readability + text-only from HTML
 */
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';

/**
 * Extract readable text using Mozilla Readability
 */
export function extractReadability(html: string, url: string): string {
  try {
    const dom = new JSDOM(html, { url: `https://${url}` });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    return article?.textContent?.trim() || '';
  } catch (e) {
    return '';
  }
}

/**
 * Extract text-only content using cheerio (strips all tags)
 */
export function extractTextOnly(html: string): string {
  try {
    const $ = cheerio.load(html);
    // Remove script, style, nav, footer, header for cleaner text
    $('script, style, nav, footer, header, aside, .sidebar, .nav, .footer, .header').remove();
    const text = $('body').text() || $.root().text();
    // Normalize whitespace
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join('\n')
      .trim();
  } catch (e) {
    return '';
  }
}
