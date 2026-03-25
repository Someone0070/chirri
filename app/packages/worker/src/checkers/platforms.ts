/**
 * Platform-specific patterns for API documentation sites.
 * Each platform has detection signatures and extraction strategies.
 */

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';

export type PlatformType =
  | 'swagger-ui'
  | 'redoc'
  | 'stoplight'
  | 'mintlify'
  | 'docusaurus'
  | 'gitbook'
  | 'readme-io'
  | 'stripe'
  | 'generic';

export interface AnchorCandidate {
  selector: string;
  score: number;
  matchType: 'id' | 'heading' | 'data-attr' | 'class' | 'text' | 'platform';
  matchDetail: string;
}

interface PlatformSignature {
  platform: PlatformType;
  signatures: string[];
}

const PLATFORM_SIGNATURES: PlatformSignature[] = [
  { platform: 'stripe', signatures: ['stripe', 'method-area', 'api-method-path'] },
  { platform: 'swagger-ui', signatures: ['swagger-ui', 'SwaggerUIBundle', 'opblock'] },
  { platform: 'redoc', signatures: ['redoc-container', 'Redoc.init', 'redocly', 'redoc-wrap'] },
  { platform: 'stoplight', signatures: ['stoplight', 'sl-elements', 'elements-api'] },
  { platform: 'mintlify', signatures: ['mintlify'] },
  { platform: 'docusaurus', signatures: ['docusaurus', 'docsVersion', 'docMainContainer'] },
  { platform: 'gitbook', signatures: ['gitbook', 'GitBook'] },
  { platform: 'readme-io', signatures: ['readme-io', 'ReadMe', 'readme-header'] },
];

export function detectPlatform(html: string): PlatformType {
  for (const sig of PLATFORM_SIGNATURES) {
    const matched = sig.signatures.some((s) => html.includes(s));
    if (matched) return sig.platform;
  }
  return 'generic';
}

const MAIN_CONTENT_SELECTORS: Record<PlatformType, string[]> = {
  'swagger-ui': ['.swagger-ui'],
  redoc: ['.api-content', '[role="main"]', '.redoc-wrap'],
  stoplight: ['[role="main"]', '.sl-elements', '.sl-stack'],
  mintlify: ['main', 'article', '[class*="content"]'],
  docusaurus: ['article', 'main .container', '.docMainContainer', 'main'],
  gitbook: ['main', '[class*="page-body"]', '.page-inner'],
  'readme-io': ['.content-body', '[class*="markdown-body"]', 'main'],
  stripe: ['.main-content', '#content', 'main'],
  generic: ['main', 'article', '[role="main"]', '#content', '.content'],
};

export function getMainContentSelector(platform: PlatformType): string[] {
  return MAIN_CONTENT_SELECTORS[platform] || MAIN_CONTENT_SELECTORS['generic'];
}

const NAV_SELECTORS = [
  'nav', '[role="navigation"]',
  '.sidebar', '.side-bar', '.sidenav',
  '.toc', '.table-of-contents',
  '.menu-content', '.breadcrumb', '.breadcrumbs',
  'footer', '.footer',
  'header:not(main header)',
  '.topbar', '.top-bar',
  '[class*="sidebar"]', '[class*="nav-"]', '[class*="menu"]',
];

export function getNavSelectors(): string[] {
  return NAV_SELECTORS;
}

function idMatchesTerm(id: string, term: string): boolean {
  if (id === term) return true;
  const segments = id.split(/[-_/.]/);
  if (segments.includes(term)) return true;
  const camelSegments = id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().split('-');
  if (camelSegments.includes(term)) return true;
  if (id.startsWith(term) || id.endsWith(term)) return true;
  return false;
}

export function findPlatformSpecificAnchors(
  $: CheerioAPI,
  $content: Cheerio<AnyNode>,
  terms: string[],
  endpointPath: string | undefined,
  platform: PlatformType,
): AnchorCandidate[] {
  const lowerTerms = terms.map((t) => t.toLowerCase());

  switch (platform) {
    case 'swagger-ui': {
      const results: AnchorCandidate[] = [];
      $content.find('.opblock-tag-section').each((_, el) => {
        const tagText = $(el).find('.opblock-tag').first().text().trim().toLowerCase();
        if (lowerTerms.some((t) => tagText.includes(t) || t.includes(tagText))) {
          results.push({
            selector: `.opblock-tag-section containing "${tagText}"`,
            score: 95,
            matchType: 'platform',
            matchDetail: `Swagger tag section: ${tagText}`,
          });
        }
      });
      $content.find('.opblock').each((_, el) => {
        const $el = $(el);
        const id = $el.attr('id') || '';
        const pathText = $el.find('.opblock-summary-path').text().trim();
        if (endpointPath && pathText.includes(endpointPath)) {
          results.push({ selector: `#${id || 'opblock'}`, score: 98, matchType: 'platform', matchDetail: `Swagger opblock path: ${pathText}` });
        } else if (lowerTerms.some((t) => id.toLowerCase().includes(t))) {
          results.push({ selector: `#${id}`, score: 95, matchType: 'platform', matchDetail: `Swagger opblock id: ${id}` });
        }
      });
      return results;
    }
    case 'redoc': {
      const results: AnchorCandidate[] = [];
      $content.find('[id]').each((_, el) => {
        const $el = $(el);
        const id = $el.attr('id') || '';
        if (id.startsWith('tag/')) {
          const parts = id.split('/');
          const tagName = parts[1]?.toLowerCase() || '';
          if (parts.length === 2 && lowerTerms.some((t) => tagName.includes(t) || t.includes(tagName))) {
            results.push({ selector: `[id="${id}"]`, score: 95, matchType: 'platform', matchDetail: `Redoc tag: ${id}` });
          }
          if (id.includes('/operation/')) {
            const opName = (id.split('/operation/')[1] || '').toLowerCase();
            if (lowerTerms.some((t) => opName.includes(t))) {
              results.push({ selector: `[id="${id}"]`, score: 97, matchType: 'platform', matchDetail: `Redoc operation: ${id}` });
            }
          }
        }
      });
      return results;
    }
    case 'stoplight': {
      const results: AnchorCandidate[] = [];
      $content.find('.sl-panel, [data-testid="resource-operation"]').each((_, el) => {
        const $el = $(el);
        const titleText = $el.find('.sl-panel__title, .sl-panel__titlebar').text().trim().toLowerCase();
        if (endpointPath && titleText.includes(endpointPath)) {
          results.push({ selector: 'sl-panel', score: 97, matchType: 'platform', matchDetail: `Stoplight panel path: ${titleText}` });
        } else if (lowerTerms.some((t) => titleText.includes(t))) {
          results.push({ selector: 'sl-panel', score: 93, matchType: 'platform', matchDetail: `Stoplight panel: ${titleText}` });
        }
      });
      return results;
    }
    case 'docusaurus': {
      const results: AnchorCandidate[] = [];
      $content.find('.api-method, [class*="api-"]').each((_, el) => {
        const text = $(el).text().trim().toLowerCase().substring(0, 200);
        if (lowerTerms.some((t) => text.includes(t))) {
          results.push({ selector: '.api-method', score: 93, matchType: 'platform', matchDetail: 'Docusaurus api section' });
        }
      });
      return results;
    }
    case 'mintlify': {
      const results: AnchorCandidate[] = [];
      $content.find('[data-method][data-path], .openapi-section, .openapi-method').each((_, el) => {
        const $el = $(el);
        const path = $el.attr('data-path') || '';
        const text = $el.text().trim().toLowerCase().substring(0, 200);
        if (endpointPath && path.includes(endpointPath)) {
          results.push({ selector: `[data-path="${path}"]`, score: 97, matchType: 'platform', matchDetail: `Mintlify data-path: ${path}` });
        } else if (lowerTerms.some((t) => text.includes(t) || path.toLowerCase().includes(t))) {
          results.push({ selector: 'openapi-section', score: 93, matchType: 'platform', matchDetail: 'Mintlify section match' });
        }
      });
      return results;
    }
    case 'readme-io': {
      const results: AnchorCandidate[] = [];
      $content.find('.endpoint, [id^="endpoint-"]').each((_, el) => {
        const $el = $(el);
        const id = $el.attr('id') || '';
        const pathText = $el.find('.endpoint-path').text().trim();
        if (endpointPath && pathText.includes(endpointPath)) {
          results.push({ selector: `#${id}`, score: 97, matchType: 'platform', matchDetail: `ReadMe endpoint path: ${pathText}` });
        } else if (lowerTerms.some((t) => id.toLowerCase().includes(t))) {
          results.push({ selector: `#${id}`, score: 95, matchType: 'platform', matchDetail: `ReadMe endpoint id: ${id}` });
        }
      });
      return results;
    }
    case 'stripe': {
      const results: AnchorCandidate[] = [];
      $content.find('section[id], .method-area[id]').each((_, el) => {
        const $el = $(el);
        const id = ($el.attr('id') || '').toLowerCase();
        if (lowerTerms.some((t) => idMatchesTerm(id, t))) {
          results.push({ selector: `section#${$el.attr('id')}`, score: 97, matchType: 'platform', matchDetail: `Stripe section: ${$el.attr('id')}` });
        }
      });
      if (endpointPath) {
        $content.find('.api-method-path').each((_, el) => {
          const $el = $(el);
          if ($el.text().trim().includes(endpointPath)) {
            const section = $el.closest('section[id], .method-area');
            if (section.length) {
              results.push({ selector: `section#${section.attr('id')}`, score: 98, matchType: 'platform', matchDetail: `Stripe path: ${endpointPath}` });
            }
          }
        });
      }
      return results;
    }
    default:
      return [];
  }
}
