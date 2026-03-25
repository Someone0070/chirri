/**
 * Section Extractor — extracts relevant sections from single-page API docs.
 *
 * Sits between normalization and diffing in the pipeline.
 * When a user monitors a specific resource (e.g. "charges"), this module
 * extracts only the relevant section(s) from a large page, avoiding
 * false-positive diffs from unrelated content changes.
 *
 * Algorithm:
 *   1. Platform detection (Swagger, Redoc, Stripe, etc.)
 *   2. Main content isolation (strip nav/sidebar/footer)
 *   3. Anchor finding (ID, heading, data-attr — scored)
 *   4. Section boundary extraction (heading walk or container)
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
import {
  detectPlatform,
  getMainContentSelector,
  getNavSelectors,
  findPlatformSpecificAnchors,
  type PlatformType,
  type AnchorCandidate,
} from './platforms.js';

// ─── Public Types ───────────────────────────────────────────────────────────

export type ExtractionConfidence = 'exact' | 'heading' | 'fuzzy' | 'none';

export interface ExtractedSection {
  html: string;
  text: string;
  anchorId?: string;
  heading?: string;
  startOffset: number;
  endOffset: number;
  matchType: 'id' | 'heading' | 'data-attr' | 'class' | 'text' | 'platform';
}

export interface ExtractionResult {
  sections: ExtractedSection[];
  confidence: ExtractionConfidence;
  platform: PlatformType;
  totalAnchorsFound: number;
  extractionTimeMs: number;
  warnings: string[];
  fallbackReason?: string;
}

export interface SectionExtractionInput {
  html: string;
  resourceNames: string[];
  endpointPath?: string;
  platformHint?: PlatformType;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const COMMON_WORD_THRESHOLD = 15;
const MIN_SECTION_CHARS = 100;
const MAX_SECTION_RATIO = 0.8;
const MAX_SECTIONS = 10;
const MAX_CONTAINER_SIZE = 100_000; // chars

// ─── Main Entry Point ───────────────────────────────────────────────────────

export function extractSections(input: SectionExtractionInput): ExtractionResult {
  const start = Date.now();
  const warnings: string[] = [];

  const { html, resourceNames, endpointPath, platformHint } = input;

  // Phase 0: Platform detection
  const platform = platformHint || detectPlatform(html);

  // Check for JS-rendered pages with minimal content
  if (detectJSRendered(html)) {
    return {
      sections: [],
      confidence: 'none',
      platform,
      totalAnchorsFound: 0,
      extractionTimeMs: Date.now() - start,
      warnings: ['Page appears to be JS-rendered (minimal content in HTML). Consider using --playwright.'],
      fallbackReason: 'Page appears to be JS-rendered (minimal content in HTML). Consider using --playwright.',
    };
  }

  const $ = cheerio.load(html);

  // Phase 1: Isolate main content
  const $content = isolateMainContent($, platform);

  // Phase 2: Expand search terms and find anchors
  const terms = expandSearchTerms(resourceNames, endpointPath);

  let candidates = findAllAnchors($, $content, terms, endpointPath, platform);

  // Handle common-word overmatching
  if (candidates.length > COMMON_WORD_THRESHOLD) {
    warnings.push(`Resource name matched ${candidates.length} elements — filtering to high-confidence only`);
    const filtered = candidates.filter(c => c.score >= 90);
    if (filtered.length === 0) {
      return {
        sections: [],
        confidence: 'none',
        platform,
        totalAnchorsFound: candidates.length,
        extractionTimeMs: Date.now() - start,
        warnings,
        fallbackReason: `Resource name too common — matched ${candidates.length} elements, none with high confidence`,
      };
    }
    candidates = filtered;
  }

  if (candidates.length === 0) {
    return {
      sections: [],
      confidence: 'none',
      platform,
      totalAnchorsFound: 0,
      extractionTimeMs: Date.now() - start,
      warnings,
      fallbackReason: `No matching anchors found for resource '${resourceNames.join(', ')}' on platform '${platform}'`,
    };
  }

  // Deduplicate & rank
  candidates = deduplicateCandidates(candidates);
  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, MAX_SECTIONS);

  // Phase 3: Extract section content for each candidate
  const sections = extractSectionsFromCandidates($, $content, topCandidates, html);

  // Validate section sizes
  const fullPageText = $content.text();
  const sizeWarnings = validateSections(sections, fullPageText.length);
  warnings.push(...sizeWarnings);

  // Assign confidence
  const confidence = assignConfidence(sections, topCandidates);

  return {
    sections,
    confidence,
    platform,
    totalAnchorsFound: candidates.length,
    extractionTimeMs: Date.now() - start,
    warnings,
  };
}

// ─── Phase 1: Main Content Isolation ────────────────────────────────────────

function isolateMainContent($: CheerioAPI, platform: PlatformType): Cheerio<AnyNode> {
  const selectors = getMainContentSelector(platform);

  for (const sel of selectors) {
    const $el = $(sel);
    if ($el.length > 0 && $el.text().trim().length > 200) {
      // Clone so we don't mutate original, then strip nav elements
      const $clone = $el.clone();
      for (const navSel of getNavSelectors()) {
        $clone.find(navSel).remove();
      }
      return $clone;
    }
  }

  // Fallback: use body with nav stripped
  const $body = $('body').clone();
  for (const navSel of getNavSelectors()) {
    $body.find(navSel).remove();
  }
  return $body;
}

// ─── Phase 2: Search Term Expansion ─────────────────────────────────────────

function expandSearchTerms(resourceNames: string[], endpointPath?: string): string[] {
  const terms = new Set<string>();

  for (const name of resourceNames) {
    const lower = name.toLowerCase();
    terms.add(lower);
    // Singular/plural
    if (lower.endsWith('s') && lower.length > 3) {
      terms.add(lower.replace(/s$/, ''));
    }
    if (!lower.endsWith('s')) {
      terms.add(lower + 's');
    }

    // CamelCase variants
    const cap = lower.charAt(0).toUpperCase() + lower.slice(1);
    terms.add(cap);
    for (const prefix of ['create', 'list', 'get', 'update', 'delete', 'retrieve']) {
      terms.add(prefix + cap);
      terms.add(`${prefix}-${lower}`);
      terms.add(`${prefix}_${lower}`);
    }
  }

  if (endpointPath) {
    terms.add(endpointPath);
    terms.add(endpointPath.replace(/\//g, '-').replace(/^-/, ''));
    const segments = endpointPath.split('/').filter(Boolean);
    for (const seg of segments) {
      if (seg.length > 2) terms.add(seg.toLowerCase());
    }
  }

  return [...terms].filter(t => t.length >= 3);
}

// ─── Phase 2: Anchor Finding ────────────────────────────────────────────────

function findAllAnchors(
  $: CheerioAPI,
  $content: Cheerio<AnyNode>,
  terms: string[],
  endpointPath: string | undefined,
  platform: PlatformType
): AnchorCandidate[] {
  const candidates: AnchorCandidate[] = [];
  const lowerTerms = terms.map(t => t.toLowerCase());

  // Strategy 1: ID matching (score 85-100)
  $content.find('[id]').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    const idLower = id.toLowerCase();

    for (const term of lowerTerms) {
      if (idMatches(idLower, term)) {
        // Skip if this is inside nav
        if (isInNavigation($, $el)) return;
        candidates.push({
          selector: `[id="${id}"]`,
          score: idMatchScore(idLower, term),
          matchType: 'id',
          matchDetail: `id="${id}" matched term "${term}"`,
        });
        break; // one match per element
      }
    }
  });

  // Strategy 2: Heading text matching (score 70-85)
  $content.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const $el = $(el);
    const text = $el.text().toLowerCase().trim();
    if (!text) return;

    for (const term of lowerTerms) {
      if (headingMatches(text, term)) {
        if (isInNavigation($, $el)) return;
        // Don't double-count if already found by ID
        const id = $el.attr('id');
        if (id && candidates.some(c => c.selector === `[id="${id}"]`)) return;

        candidates.push({
          selector: `heading:"${text.substring(0, 60)}"`,
          score: headingMatchScore(text, term),
          matchType: 'heading',
          matchDetail: `<${el.tagName}> "${text.substring(0, 60)}" matched "${term}"`,
        });
        break;
      }
    }
  });

  // Strategy 3: Data attribute matching (score 85-95)
  const dataAttrs = [
    'data-endpoint', 'data-path', 'data-operation', 'data-resource',
    'data-method', 'data-url', 'data-api-path',
  ];
  const dataSelector = dataAttrs.map(a => `[${a}]`).join(',');
  $content.find(dataSelector).each((_, el) => {
    const $el = $(el);
    for (const attr of dataAttrs) {
      const val = $el.attr(attr);
      if (val && lowerTerms.some(t => val.toLowerCase().includes(t))) {
        candidates.push({
          selector: `[${attr}="${val}"]`,
          score: 90,
          matchType: 'data-attr',
          matchDetail: `${attr}="${val}"`,
        });
        break;
      }
    }
  });

  // Strategy 4: Platform-specific (score 93-98)
  candidates.push(
    ...findPlatformSpecificAnchors($, $content, terms, endpointPath, platform)
  );

  // Strategy 5: Class name matching (score 50-65)
  $content.find('[class]').each((_, el) => {
    const $el = $(el);
    const cls = ($el.attr('class') || '').toLowerCase();
    if (!cls) return;

    for (const term of lowerTerms) {
      if (classMatches(cls, term)) {
        if (isInNavigation($, $el)) return;
        candidates.push({
          selector: `[class~="${term}"]`,
          score: 55,
          matchType: 'class',
          matchDetail: `class="${cls.substring(0, 60)}" matched "${term}"`,
        });
        break;
      }
    }
  });

  return candidates;
}

// ─── Matching Helpers ───────────────────────────────────────────────────────

function idMatches(id: string, term: string): boolean {
  if (id === term) return true;
  const segments = id.split(/[-_/.]/);
  if (segments.includes(term)) return true;
  // CamelCase segment
  const camelSegments = id.replace(/([a-z])([A-Z])/g, '$1\0$2').toLowerCase().split('\0');
  if (camelSegments.includes(term)) return true;
  if (id.startsWith(term) || id.endsWith(term)) return true;
  return false;
}

function idMatchScore(id: string, term: string): number {
  if (id === term) return 100;
  const segments = id.split(/[-_/.]/);
  if (segments.includes(term)) return 95;
  if (id.startsWith(term) || id.endsWith(term)) return 90;
  return 85;
}

function headingMatches(text: string, term: string): boolean {
  // Exact match of entire heading
  if (text === term) return true;
  // Word boundary match
  const words = text.split(/[\s\-_/]+/);
  if (words.includes(term)) return true;
  // Contains as substring
  if (text.includes(term)) return true;
  return false;
}

function headingMatchScore(text: string, term: string): number {
  if (text === term) return 85;
  const words = text.split(/[\s\-_/]+/);
  if (words.includes(term)) return 80;
  if (text.startsWith(term)) return 78;
  return 72;
}

function classMatches(cls: string, term: string): boolean {
  const segments = cls.split(/[\s\-_]+/);
  return segments.includes(term);
}

function isInNavigation($: CheerioAPI, $el: Cheerio<AnyNode>): boolean {
  // Check if any parent matches nav selectors
  const navTests = [
    'nav', '[role="navigation"]',
    '.sidebar', '.toc', '.table-of-contents',
    '.menu-content', '.breadcrumb', 'footer',
  ];
  for (const sel of navTests) {
    if ($el.closest(sel).length > 0) return true;
  }
  // Also check class-based nav indicators on parents
  let parent = $el.parent();
  let depth = 0;
  while (parent.length && depth < 10) {
    const cls = (parent.attr('class') || '').toLowerCase();
    if (/\b(sidebar|side-bar|toc|table-of-contents|nav|menu|breadcrumb|footer)\b/.test(cls)) {
      return true;
    }
    parent = parent.parent();
    depth++;
  }
  return false;
}

// ─── Deduplication ──────────────────────────────────────────────────────────

function deduplicateCandidates(candidates: AnchorCandidate[]): AnchorCandidate[] {
  // Group by selector, keep highest score
  const map = new Map<string, AnchorCandidate>();
  for (const c of candidates) {
    const key = c.selector;
    const existing = map.get(key);
    if (!existing || c.score > existing.score) {
      map.set(key, c);
    }
  }
  return [...map.values()];
}

// ─── Phase 3: Section Extraction ────────────────────────────────────────────

function extractSectionsFromCandidates(
  $: CheerioAPI,
  $content: Cheerio<AnyNode>,
  candidates: AnchorCandidate[],
  fullHtml: string
): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  const extractedTexts = new Set<string>(); // dedup by content

  for (const candidate of candidates) {
    const section = extractSectionForCandidate($, $content, candidate, fullHtml);
    if (!section) continue;

    // Dedup: skip if we already extracted essentially the same content
    const textKey = section.text.substring(0, 200);
    if (extractedTexts.has(textKey)) continue;
    extractedTexts.add(textKey);

    sections.push(section);
    if (sections.length >= MAX_SECTIONS) break;
  }

  return sections;
}

function extractSectionForCandidate(
  $: CheerioAPI,
  $content: Cheerio<AnyNode>,
  candidate: AnchorCandidate,
  fullHtml: string
): ExtractedSection | null {
  // Find the actual element in $content
  const $el = findElementForCandidate($, $content, candidate);
  if (!$el || !$el.length) return null;

  const el = $el.get(0)!;
  const tagName = (el as any).tagName?.toLowerCase() || '';

  // Case 1: Element is a container (section, div, article)
  if (isContainerTag(tagName) && !isHeadingTag(tagName)) {
    return extractFromContainer($, $el, candidate);
  }

  // Case 2: Element is a heading
  if (isHeadingTag(tagName)) {
    return extractHeadingSection($, $el, candidate);
  }

  // Case 3: Element is an anchor or other inline
  if (tagName === 'a' || isInlineTag(tagName)) {
    // Try closest container
    const $container = $el.closest('section, article, [class*="endpoint"], [class*="operation"], [class*="method"]');
    if ($container.length && $.html($container).length < MAX_CONTAINER_SIZE) {
      return extractFromContainer($, $container, candidate);
    }
    // Try heading walk from nearest heading
    const $nearestHeading = findNearestHeading($, $el);
    if ($nearestHeading && $nearestHeading.length) {
      return extractHeadingSection($, $nearestHeading, candidate);
    }
  }

  // Case 4: Fallback — take the element + reasonable parent
  const $parent = $el.closest('section, article, div[id]');
  if ($parent.length && $.html($parent).length < MAX_CONTAINER_SIZE) {
    return extractFromContainer($, $parent, candidate);
  }

  return extractFromContainer($, $el, candidate);
}

function findElementForCandidate(
  $: CheerioAPI,
  $content: Cheerio<AnyNode>,
  candidate: AnchorCandidate
): Cheerio<AnyNode> | null {
  // Try selector-based lookup first
  if (candidate.selector.startsWith('[id=') || candidate.selector.startsWith('#') || candidate.selector.startsWith('section#')) {
    const sel = candidate.selector.startsWith('section#')
      ? candidate.selector
      : candidate.selector;
    const $found = $content.find(sel);
    if ($found.length) return $found.first();
    // Also try in full document
    const $docFound = $(sel);
    if ($docFound.length) return $docFound.first();
  }

  // For heading matches, search by text
  if (candidate.matchType === 'heading' && candidate.selector.startsWith('heading:')) {
    const headingText = candidate.matchDetail.match(/"([^"]+)"/)?.[1]?.toLowerCase() || '';
    let $match: Cheerio<AnyNode> | null = null;
    $content.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
      if (!$match && $(el).text().toLowerCase().trim().includes(headingText)) {
        $match = $(el);
        return false;
      }
    });
    return $match;
  }

  // For data-attr matches
  if (candidate.matchType === 'data-attr') {
    const $found = $content.find(candidate.selector);
    if ($found.length) return $found.first();
  }

  // For platform matches, search broader
  if (candidate.matchType === 'platform') {
    // Try to find by the detail
    const detail = candidate.matchDetail;
    if (detail.includes('tag section:')) {
      const tagName = detail.split(':')[1]?.trim().toLowerCase() || '';
      let $match: Cheerio<AnyNode> | null = null;
      $content.find('.opblock-tag-section').each((_, el) => {
        const text = $(el).find('.opblock-tag').text().trim().toLowerCase();
        if (text.includes(tagName)) {
          $match = $(el);
          return false;
        }
      });
      return $match;
    }
  }

  return null;
}

// ─── Container Extraction ───────────────────────────────────────────────────

function extractFromContainer(
  $: CheerioAPI,
  $el: Cheerio<AnyNode>,
  candidate: AnchorCandidate
): ExtractedSection {
  const html = $.html($el);
  const text = $el.text().replace(/\s+/g, ' ').trim();
  const el = $el.get(0)!;

  // Find the offset in the original HTML (approximate)
  const anchorId = $el.attr('id') || undefined;
  const heading = $el.find('h1, h2, h3, h4, h5, h6').first().text().trim() || undefined;

  return {
    html,
    text,
    anchorId,
    heading,
    startOffset: 0,  // We use content-based matching, not offset
    endOffset: html.length,
    matchType: candidate.matchType as ExtractedSection['matchType'],
  };
}

// ─── Heading Section Extraction ─────────────────────────────────────────────

function extractHeadingSection(
  $: CheerioAPI,
  $heading: Cheerio<AnyNode>,
  candidate: AnchorCandidate
): ExtractedSection {
  const headingEl = $heading.get(0)!;
  const tagName = (headingEl as any).tagName?.toLowerCase() || 'h2';
  const level = parseInt(tagName[1]) || 2;

  const parts: string[] = [$.html($heading)];
  const textParts: string[] = [$heading.text().trim()];

  // Walk siblings until next heading of same or higher level
  let $current = $heading.next();
  let totalSize = parts[0].length;

  while ($current.length > 0 && totalSize < MAX_CONTAINER_SIZE) {
    const currentTag = ($current.get(0) as any)?.tagName?.toLowerCase() || '';

    // Stop at same-or-higher level heading
    if (isHeadingTag(currentTag)) {
      const currentLevel = parseInt(currentTag[1]) || 0;
      if (currentLevel > 0 && currentLevel <= level) break;
    }

    const sibHtml = $.html($current);
    parts.push(sibHtml);
    textParts.push($current.text().trim());
    totalSize += sibHtml.length;

    $current = $current.next();
  }

  const html = parts.join('\n');
  const text = textParts.join('\n').replace(/\s+/g, ' ').trim();

  return {
    html,
    text,
    anchorId: $heading.attr('id') || undefined,
    heading: $heading.text().trim(),
    startOffset: 0,
    endOffset: html.length,
    matchType: candidate.matchType as ExtractedSection['matchType'],
  };
}

// ─── Utility Helpers ────────────────────────────────────────────────────────

function isContainerTag(tag: string): boolean {
  return ['section', 'article', 'div', 'main', 'aside', 'details'].includes(tag);
}

function isHeadingTag(tag: string): boolean {
  return /^h[1-6]$/.test(tag);
}

function isInlineTag(tag: string): boolean {
  return ['a', 'span', 'strong', 'em', 'b', 'i', 'code', 'small'].includes(tag);
}

function findNearestHeading($: CheerioAPI, $el: Cheerio<AnyNode>): Cheerio<AnyNode> | null {
  // Look at previous siblings for a heading
  let $prev = $el.prev();
  let depth = 0;
  while ($prev.length && depth < 20) {
    const tag = ($prev.get(0) as any)?.tagName?.toLowerCase() || '';
    if (isHeadingTag(tag)) return $prev;
    $prev = $prev.prev();
    depth++;
  }
  // Check parent's heading
  const $parentHeading = $el.parent().find('h1, h2, h3, h4, h5, h6').first();
  if ($parentHeading.length) return $parentHeading;
  return null;
}

// ─── JS-Rendered Detection ──────────────────────────────────────────────────

function detectJSRendered(html: string): boolean {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return false;

  const bodyHtml = bodyMatch[1];
  const bodyText = bodyHtml.replace(/<[^>]+>/g, '').trim();
  const hasFrameworkScripts = /swagger-ui-bundle|redoc\.standalone|react|angular|vue\.js/i.test(html);

  return bodyText.length < 500 && hasFrameworkScripts;
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateSections(sections: ExtractedSection[], fullPageLength: number): string[] {
  const warnings: string[] = [];

  for (const section of sections) {
    if (section.text.length < MIN_SECTION_CHARS) {
      warnings.push(`Section "${section.heading || 'unknown'}" is suspiciously small (${section.text.length} chars)`);
    }
  }

  const totalSectionChars = sections.reduce((sum, s) => sum + s.text.length, 0);
  if (fullPageLength > 0 && totalSectionChars > fullPageLength * MAX_SECTION_RATIO) {
    warnings.push(
      `Extracted sections cover ${Math.round((totalSectionChars / fullPageLength) * 100)}% of the page — extraction may not be effective`
    );
  }

  return warnings;
}

// ─── Confidence Assignment ──────────────────────────────────────────────────

function assignConfidence(sections: ExtractedSection[], candidates: AnchorCandidate[]): ExtractionConfidence {
  if (sections.length === 0) return 'none';

  const bestScore = Math.max(...candidates.map(c => c.score));
  const bestCandidate = candidates.find(c => c.score === bestScore);
  const bestType = bestCandidate?.matchType;

  if (bestScore >= 90 && (bestType === 'id' || bestType === 'data-attr' || bestType === 'platform')) {
    return 'exact';
  }
  if (bestScore >= 70 && bestType === 'heading') {
    return 'heading';
  }
  return 'fuzzy';
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

export { detectPlatform } from './platforms.js';
export type { PlatformType } from './platforms.js';
