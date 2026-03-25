# Chirri: Content Section Extraction Design

> **Status:** Design spec — ready for implementation  
> **Date:** 2026-03-24  
> **Purpose:** Extract relevant sections from single-page API docs before diffing, so monitoring `api.stripe.com/v1/charges` doesn't trigger on unrelated endpoint changes.

---

## 1. Problem Statement

Chirri's diff engine currently diffs **entire pages**. This works fine for multi-page docs where each endpoint has its own URL. But many API doc sites pack hundreds of endpoints onto a single page:

- **Stripe** (`docs.stripe.com/api`) — one giant page, sections linked via `#charges`, `#customers`, etc.
- **Redoc-generated** docs — single page with all operations rendered from an OpenAPI spec
- **Swagger UI** — single-page interactive explorer
- **Mintlify/Docusaurus/GitBook** — may use single-page or multi-page layouts

When a user monitors `/v1/charges`, a change to `/v1/customers` on the same page produces a false positive. We need to **extract only the relevant section** and diff that.

---

## 2. Architecture Overview

### Current Flow
```
fetch → normalize → diff entire page → report
```

### New Flow
```
fetch → normalize → extractSections(resource) → diff section(s) → report
                                ↓
                    [fallback: full page if extraction fails]
```

The section extractor is a **new module** (`src/section-extractor.ts`) that sits between normalization and diffing. It receives normalized HTML and returns one or more extracted sections.

### Integration Point

In `src/index.ts`, after fetching and normalizing but before diffing:

```typescript
import { extractSections, type ExtractionResult } from './section-extractor.js';

// After normalization...
const extraction = extractSections(normalizedHtml, {
  resourceNames: ['charges', 'charge'],
  endpointPath: '/v1/charges',
  platformHint: detectPlatform(normalizedHtml), // optional optimization
});

if (extraction.confidence !== 'none') {
  // Diff only the extracted section(s)
  const sectionText = extraction.sections.map(s => s.text).join('\n---\n');
  diffResult = diffAll(previousSectionText, sectionText);
} else {
  // Fallback: diff full page as before
  diffResult = diffAll(previousFullText, currentFullText);
}
```

---

## 3. Data Types

```typescript
interface SectionExtractionInput {
  html: string;                    // Full page HTML (post-normalization)
  resourceNames: string[];         // e.g., ["charges", "charge"]
  endpointPath?: string;           // e.g., "/v1/charges"
  platformHint?: PlatformType;     // Skip detection if already known
}

type PlatformType = 
  | 'swagger-ui'
  | 'redoc'
  | 'stoplight'
  | 'mintlify'
  | 'docusaurus'
  | 'gitbook'
  | 'readme-io'
  | 'generic';

type ExtractionConfidence = 
  | 'exact'      // Matched by ID or data attribute — high confidence
  | 'heading'    // Matched by heading text — good confidence  
  | 'fuzzy'      // Matched by class/text search — moderate confidence
  | 'none';      // No match found — fell back to full page

interface ExtractedSection {
  html: string;              // Raw HTML of the section
  text: string;              // Readable text (stripped tags, normalized whitespace)
  anchorId?: string;         // The ID/anchor that was matched
  heading?: string;          // The heading text, if found
  startOffset: number;       // Character offset in original HTML
  endOffset: number;         // Character offset in original HTML
  matchType: 'id' | 'heading' | 'data-attr' | 'class' | 'text';
}

interface ExtractionResult {
  sections: ExtractedSection[];
  confidence: ExtractionConfidence;
  platform: PlatformType;
  totalAnchorsFound: number;      // How many candidate anchors we considered
  extractionTimeMs: number;       // Performance tracking
  warnings: string[];             // e.g., "resource name is common word, may over-match"
  fallbackReason?: string;        // Why we fell back to full page
}
```

---

## 4. Algorithm Specification

### Phase 0: Platform Detection

Before searching for sections, detect which docs platform generated the page. This allows us to use platform-specific selectors that are far more precise than generic heuristics.

```typescript
function detectPlatform(html: string): PlatformType {
  // Check in order of specificity
  if (html.includes('swagger-ui') || html.includes('SwaggerUIBundle'))
    return 'swagger-ui';
  if (html.includes('redoc-container') || html.includes('Redoc.init') || html.includes('redocly'))
    return 'redoc';
  if (html.includes('stoplight') || html.includes('sl-') || html.includes('elements-api'))
    return 'stoplight';
  if (html.includes('mintlify') || html.includes('__next') && html.includes('openapi'))
    return 'mintlify';
  if (html.includes('docusaurus') || html.includes('docsVersion'))
    return 'docusaurus';
  if (html.includes('gitbook') || html.includes('GitBook'))
    return 'gitbook';
  if (html.includes('readme-io') || html.includes('ReadMe'))
    return 'readme-io';
  return 'generic';
}
```

### Phase 1: Isolate Main Content

Before searching for resource anchors, strip navigation/sidebar/footer to avoid false matches. Resource names like "charges" WILL appear in sidebar navigation — we must ignore those.

```typescript
function isolateMainContent(html: string, platform: PlatformType): string {
  // Platform-specific main content selectors
  const mainContentSelectors: Record<PlatformType, string[]> = {
    'swagger-ui':  ['.swagger-ui .information-container + div', '.swagger-ui'],
    'redoc':       ['[role="main"]', '.api-content', '.redoc-wrap'],
    'stoplight':   ['[role="main"]', '.sl-elements', '.sl-stack'],
    'mintlify':    ['main', 'article', '[class*="content"]'],
    'docusaurus':  ['main .container article', 'main', '.docMainContainer'],
    'gitbook':     ['main', '[class*="page-body"]', '.page-inner'],
    'readme-io':   ['main', '.content-body', '[class*="markdown-body"]'],
    'generic':     ['main', 'article', '[role="main"]', '#content', '.content'],
  };

  // Use cheerio/JSDOM to find the first matching selector
  // Returns the innerHTML of the main content area
  // Falls back to <body> if no selector matches
}
```

### Phase 2: Find Anchor Points

Search the isolated main content for elements referencing the resource. Each anchor gets a **score**.

```typescript
interface AnchorCandidate {
  element: Element;           // DOM element
  score: number;              // 0-100, higher = better match
  matchType: ExtractedSection['matchType'];
  matchDetail: string;        // What exactly matched (for debugging)
}

function findAnchors(
  mainContent: Document | Element,
  resourceNames: string[],
  endpointPath?: string,
  platform?: PlatformType
): AnchorCandidate[] {
  const candidates: AnchorCandidate[] = [];
  
  // Generate search terms from resource names
  const terms = expandSearchTerms(resourceNames, endpointPath);
  // e.g., ["charges", "charge", "create-a-charge", "list-charges",
  //         "createCharge", "CreateCharge", "v1-charges", "v1/charges"]
  
  // --- Strategy 1: ID matching (highest precision) ---
  // Score: 90-100
  for (const el of querySelectorAll('[id]')) {
    const id = el.getAttribute('id');
    for (const term of terms) {
      if (idMatches(id, term)) {
        candidates.push({
          element: el,
          score: idMatchScore(id, term), // exact=100, contains=90, fuzzy=80
          matchType: 'id',
          matchDetail: `id="${id}" matched term "${term}"`
        });
      }
    }
  }

  // --- Strategy 2: Heading text matching ---
  // Score: 70-85
  for (const heading of querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const text = heading.textContent.toLowerCase().trim();
    for (const term of terms) {
      if (headingMatches(text, term)) {
        candidates.push({
          element: heading,
          score: headingMatchScore(text, term), // exact=85, contains=75, partial=70
          matchType: 'heading',
          matchDetail: `<${heading.tagName}> "${text}" matched term "${term}"`
        });
      }
    }
  }

  // --- Strategy 3: Data attribute matching ---
  // Score: 85-95
  const dataAttrs = [
    'data-endpoint', 'data-path', 'data-operation', 'data-resource',
    'data-method', 'data-url', 'data-api-path'
  ];
  for (const el of querySelectorAll(dataAttrs.map(a => `[${a}]`).join(','))) {
    for (const attr of dataAttrs) {
      const val = el.getAttribute(attr);
      if (val && termsMatchValue(terms, val)) {
        candidates.push({
          element: el,
          score: 90,
          matchType: 'data-attr',
          matchDetail: `${attr}="${val}"`
        });
      }
    }
  }

  // --- Strategy 4: Platform-specific selectors ---
  // Score: 95 (platform selectors are very precise)
  candidates.push(...findPlatformSpecificAnchors(mainContent, terms, endpointPath, platform));

  // --- Strategy 5: Class name matching (lowest precision) ---
  // Score: 50-65
  for (const el of querySelectorAll('[class]')) {
    const classes = el.getAttribute('class');
    for (const term of terms) {
      if (classMatches(classes, term)) {
        candidates.push({
          element: el,
          score: 55,
          matchType: 'class',
          matchDetail: `class="${classes}" matched term "${term}"`
        });
      }
    }
  }

  // Deduplicate: if the same element matched multiple strategies, keep highest score
  return deduplicateByElement(candidates);
}
```

### Phase 2a: Search Term Expansion

```typescript
function expandSearchTerms(resourceNames: string[], endpointPath?: string): string[] {
  const terms = new Set<string>();
  
  for (const name of resourceNames) {
    const lower = name.toLowerCase();
    terms.add(lower);                           // "charges"
    terms.add(lower.replace(/s$/, ''));          // "charge" (singular)
    terms.add(lower + 's');                      // "chargess" → filtered later
    
    // CamelCase variants
    const camel = lower.charAt(0).toUpperCase() + lower.slice(1);
    terms.add(camel);                           // "Charges"
    terms.add('create' + camel);                // "createCharges"
    terms.add('list' + camel);                  // "listCharges"
    terms.add('get' + camel);                   // "getCharges"
    terms.add('update' + camel);                // "updateCharges"
    terms.add('delete' + camel);                // "deleteCharges"
    
    // Kebab-case
    terms.add('create-' + lower);               // "create-charges"
    terms.add('list-' + lower);                 // "list-charges"
  }
  
  if (endpointPath) {
    terms.add(endpointPath);                    // "/v1/charges"
    terms.add(endpointPath.replace(/\//g, '-').replace(/^-/, '')); // "v1-charges"
    // Extract path segments
    const segments = endpointPath.split('/').filter(Boolean);
    for (const seg of segments) {
      if (seg.length > 2) terms.add(seg);       // "charges", "v1"
    }
  }

  // Filter out terms that are too short or too common
  return [...terms].filter(t => t.length >= 3);
}
```

### Phase 2b: ID Matching Logic

```typescript
function idMatches(id: string, term: string): boolean {
  const lower = id.toLowerCase();
  const termLower = term.toLowerCase();
  
  // Exact match
  if (lower === termLower) return true;
  
  // ID contains term as a segment (separated by -, _, /, .)
  const segments = lower.split(/[-_/.]/);
  if (segments.includes(termLower)) return true;
  
  // CamelCase segment match: "createCharge" contains "charge"
  const camelSegments = lower.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().split('-');
  if (camelSegments.includes(termLower)) return true;
  
  // Starts or ends with term
  if (lower.startsWith(termLower) || lower.endsWith(termLower)) return true;
  
  return false;
}

function idMatchScore(id: string, term: string): number {
  const lower = id.toLowerCase();
  const termLower = term.toLowerCase();
  if (lower === termLower) return 100;
  if (lower.split(/[-_/.]/g).includes(termLower)) return 95;
  if (lower.startsWith(termLower) || lower.endsWith(termLower)) return 90;
  return 85; // contains as camelCase segment
}
```

### Phase 3: Extract Section Boundaries

Once we have scored anchor candidates, extract the actual content for the top candidates.

```typescript
function extractSection(anchor: AnchorCandidate): ExtractedSection {
  const el = anchor.element;
  
  // Case 1: Element is a container (section, div, article)
  // → Take the entire element
  if (isContainerElement(el)) {
    return {
      html: el.outerHTML,
      text: extractText(el),
      anchorId: el.getAttribute('id') || undefined,
      heading: findFirstHeading(el)?.textContent || undefined,
      startOffset: getOffset(el, 'start'),
      endOffset: getOffset(el, 'end'),
      matchType: anchor.matchType,
    };
  }
  
  // Case 2: Element is a heading (h1-h6)
  // → Collect everything until next heading of same or higher level
  if (isHeading(el)) {
    return extractHeadingSection(el, anchor);
  }
  
  // Case 3: Element is an anchor tag (<a name="..."> or <a id="...">)
  // → Find nearest parent container, or walk forward to next heading
  if (el.tagName === 'A') {
    const parentContainer = el.closest('section, article, [class*="endpoint"], [class*="operation"]');
    if (parentContainer) {
      return extractFromContainer(parentContainer, anchor);
    }
    // Walk forward from the anchor
    return extractFromAnchorForward(el, anchor);
  }
  
  // Case 4: Any other element
  // → Try parent container, then fall back to sibling walk
  const container = el.closest('section, article, div[id]');
  if (container && container.innerHTML.length < 50000) { // sanity limit
    return extractFromContainer(container, anchor);
  }
  return extractFromSiblingWalk(el, anchor);
}
```

### Phase 3a: Heading Section Extraction

This is the critical algorithm for "everything between this heading and the next same-level heading":

```typescript
function extractHeadingSection(heading: Element, anchor: AnchorCandidate): ExtractedSection {
  const level = parseInt(heading.tagName[1]); // h2 → 2
  const parts: Element[] = [heading];
  
  let current: Node | null = heading.nextSibling;
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      // Stop at a heading of same or higher level
      if (isHeading(el)) {
        const nextLevel = parseInt(el.tagName[1]);
        if (nextLevel <= level) break;
      }
      parts.push(el);
    }
    current = current.nextSibling;
  }
  
  const html = parts.map(p => p.outerHTML).join('\n');
  const text = parts.map(p => extractText(p)).join('\n');
  
  return {
    html,
    text,
    anchorId: heading.getAttribute('id') || undefined,
    heading: heading.textContent?.trim() || undefined,
    startOffset: getOffset(heading, 'start'),
    endOffset: getOffset(parts[parts.length - 1], 'end'),
    matchType: anchor.matchType,
  };
}
```

### Phase 4: Platform-Specific Extractors

Each platform has predictable DOM structures. Using platform-specific selectors dramatically improves precision.

```typescript
function findPlatformSpecificAnchors(
  content: Element,
  terms: string[],
  endpointPath?: string,
  platform?: PlatformType
): AnchorCandidate[] {
  switch (platform) {
    case 'swagger-ui':  return findSwaggerAnchors(content, terms, endpointPath);
    case 'redoc':       return findRedocAnchors(content, terms, endpointPath);
    case 'stoplight':   return findStoplightAnchors(content, terms, endpointPath);
    case 'docusaurus':  return findDocusaurusAnchors(content, terms);
    case 'gitbook':     return findGitBookAnchors(content, terms);
    case 'mintlify':    return findMintlifyAnchors(content, terms, endpointPath);
    default:            return [];
  }
}
```

---

## 5. Platform-Specific HTML Patterns

### 5.1 Swagger UI

**DOM Structure (rendered):**
```html
<div class="swagger-ui">
  <div class="opblock-tag-section">
    <h3 class="opblock-tag" id="operations-tag-Charges">
      <a class="nostyle" href="#/Charges">Charges</a>
    </h3>
    <!-- Individual operations -->
    <div class="opblock opblock-post" id="operations-Charges-createCharge">
      <div class="opblock-summary opblock-summary-post">
        <span class="opblock-summary-path">
          <a class="nostyle">/v1/charges</a>
        </span>
        <span class="opblock-summary-method">POST</span>
        <span class="opblock-summary-description">Create a charge</span>
      </div>
      <div class="opblock-body">
        <!-- Parameters, request body, responses -->
      </div>
    </div>
    <div class="opblock opblock-get" id="operations-Charges-listCharges">
      <!-- ... -->
    </div>
  </div>
</div>
```

**Extraction strategy:**
```typescript
function findSwaggerAnchors(content: Element, terms: string[], endpointPath?: string): AnchorCandidate[] {
  const results: AnchorCandidate[] = [];
  
  // Match tag sections (group level: all charge operations)
  for (const tagSection of content.querySelectorAll('.opblock-tag-section')) {
    const tagName = tagSection.querySelector('.opblock-tag')?.textContent?.trim() || '';
    if (termsMatchText(terms, tagName)) {
      results.push({ element: tagSection, score: 95, matchType: 'class', matchDetail: `Swagger tag section: ${tagName}` });
    }
  }
  
  // Match individual operations
  for (const opblock of content.querySelectorAll('.opblock')) {
    const id = opblock.getAttribute('id') || '';      // "operations-Charges-createCharge"
    const path = opblock.querySelector('.opblock-summary-path')?.textContent?.trim() || '';
    
    if (endpointPath && path.includes(endpointPath)) {
      results.push({ element: opblock, score: 98, matchType: 'id', matchDetail: `Swagger opblock path: ${path}` });
    } else if (termsMatchId(terms, id)) {
      results.push({ element: opblock, score: 95, matchType: 'id', matchDetail: `Swagger opblock id: ${id}` });
    }
  }
  
  return results;
}
```

### 5.2 Redoc

**DOM Structure (rendered):**
```html
<div class="redoc-wrap">
  <div class="menu-content">
    <!-- Sidebar navigation (IGNORE) -->
  </div>
  <div class="api-content">
    <!-- Tag group -->
    <div id="tag/Charges" class="sc-..">
      <h1><a class="sc-.." href="#tag/Charges">Charges</a></h1>
      <div class="sc-..">Tag description text...</div>
    </div>
    <!-- Operations -->
    <div id="tag/Charges/operation/CreateCharge" class="sc-..">
      <h2><a href="#tag/Charges/operation/CreateCharge">Create a charge</a></h2>
      <div class="sc-..">
        <!-- Two-column layout: description + code samples -->
        <div class="sc-..">POST /v1/charges</div>
        <div class="sc-.."><!-- parameters, responses --></div>
      </div>
    </div>
    <div id="tag/Charges/operation/RetrieveCharge" class="sc-..">
      <!-- ... -->
    </div>
  </div>
</div>
```

**Key patterns:**
- Tag groups: `id="tag/Charges"`
- Operations: `id="tag/Charges/operation/CreateCharge"`
- Redoc uses styled-components, so class names are random hashes (`sc-bczRLJ`)
- Must rely on IDs and structure, NOT class names
- Sidebar is in `.menu-content` — must exclude

**Extraction strategy:**
```typescript
function findRedocAnchors(content: Element, terms: string[], endpointPath?: string): AnchorCandidate[] {
  const results: AnchorCandidate[] = [];
  
  // Exclude sidebar
  const apiContent = content.querySelector('.api-content, [role="main"]') || content;
  
  // Match by ID pattern: tag/Resource or tag/Resource/operation/...
  for (const el of apiContent.querySelectorAll('[id]')) {
    const id = el.getAttribute('id') || '';
    
    // Tag group: id="tag/Charges"
    if (id.startsWith('tag/')) {
      const tagName = id.split('/')[1];
      if (termsMatchText(terms, tagName)) {
        results.push({ element: el, score: 95, matchType: 'id', matchDetail: `Redoc tag: ${id}` });
      }
    }
    
    // Operation: id="tag/Charges/operation/CreateCharge"  
    if (id.includes('/operation/')) {
      const opName = id.split('/operation/')[1] || '';
      if (termsMatchText(terms, opName)) {
        results.push({ element: el, score: 97, matchType: 'id', matchDetail: `Redoc operation: ${id}` });
      }
    }
  }
  
  // Match by endpoint path in text content
  if (endpointPath) {
    for (const el of apiContent.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.includes(endpointPath)) {
        const operationDiv = el.closest('[id*="operation/"]') || el.closest('[id*="tag/"]');
        if (operationDiv) {
          results.push({ element: operationDiv, score: 92, matchType: 'text', matchDetail: `Redoc path match: ${endpointPath}` });
        }
      }
    }
  }
  
  return results;
}
```

### 5.3 Stoplight Elements

**DOM Structure:**
```html
<elements-api class="sl-elements">
  <div class="sl-stack">
    <div data-testid="resource-operation" class="sl-panel">
      <div class="sl-panel__title">
        <span class="sl-badge">POST</span>
        <span>/v1/charges</span>
        <span>Create a Charge</span>
      </div>
      <div class="sl-panel__content">
        <!-- Operation details -->
      </div>
    </div>
  </div>
</elements-api>
```

**Extraction strategy:**
- Match `[data-testid="resource-operation"]` panels
- Check panel title text for endpoint path or resource name
- Stoplight uses web components (`<elements-api>`) — may need to pierce shadow DOM in Playwright

### 5.4 Docusaurus

**DOM Structure:**
```html
<main>
  <div class="container">
    <article>
      <h2 id="charges">Charges</h2>
      <p>A Charge object represents a financial transaction...</p>
      
      <h3 id="create-a-charge">Create a charge</h3>
      <p>POST /v1/charges</p>
      <div class="api-params"><!-- ... --></div>
      
      <h3 id="retrieve-a-charge">Retrieve a charge</h3>
      <p>GET /v1/charges/:id</p>
      
      <h2 id="customers">Customers</h2>
      <!-- Different resource section -->
    </article>
  </div>
</main>
```

**Key patterns:**
- Standard heading IDs: `id="charges"`, `id="create-a-charge"`
- Main content in `<article>` inside `<main>`
- Heading-based section extraction works perfectly here
- Table of contents in sidebar (exclude)

### 5.5 GitBook

**DOM Structure:**
```html
<main>
  <div class="page-body">
    <h1 id="charges">Charges</h1>
    <p>...</p>
    
    <h2 id="create-a-charge">Create a charge</h2>
    <div class="hint hint-info">POST /v1/charges</div>
    <table><!-- Parameters --></table>
    
    <h2 id="retrieve-a-charge">Retrieve a charge</h2>
    <!-- ... -->
  </div>
</main>
```

**Key patterns:**
- Heading IDs with custom anchors: `## My heading {#my-anchor}`
- Content in `.page-body` or similar
- H1 and H2 appear in page outline sidebar (exclude sidebar)

### 5.6 Mintlify

**DOM Structure (Next.js rendered):**
```html
<main>
  <article>
    <h1>Charges</h1>
    <div class="openapi-section">
      <div class="openapi-method" data-method="post" data-path="/v1/charges">
        <h2 id="create-a-charge">Create a charge</h2>
        <div class="openapi-content">
          <!-- Auto-generated from OpenAPI spec -->
        </div>
      </div>
    </div>
  </article>
</main>
```

**Key patterns:**
- May have `data-method` and `data-path` attributes on operation containers
- Standard heading IDs
- OpenAPI-generated sections have predictable structure
- Next.js hydration means HTML may differ between SSR and client render

### 5.7 ReadMe.io

**DOM Structure:**
```html
<div class="content-body">
  <div class="endpoint" id="endpoint-create-a-charge">
    <div class="endpoint-header">
      <span class="http-method post">POST</span>
      <span class="endpoint-path">/v1/charges</span>
    </div>
    <div class="endpoint-body">
      <!-- Parameters, description, code samples -->
    </div>
  </div>
</div>
```

**Key patterns:**
- Explicit `.endpoint` containers with IDs
- `data-*` attributes often present
- `.content-body` as main container

### 5.8 Stripe (Custom)

**DOM Structure:**
```html
<div class="main-content">
  <section id="charges" class="method-area">
    <div class="method-header">
      <h2>Charges</h2>
      <p>To charge a credit or debit card...</p>
    </div>
  </section>
  
  <section id="create_charge" class="method-area">
    <div class="method-header">
      <h3>Create a charge</h3>
    </div>
    <div class="method-example">
      <div class="method-description">
        <span class="api-method-type">POST</span>
        <span class="api-method-path">/v1/charges</span>
      </div>
      <div class="method-code"><!-- Code examples --></div>
    </div>
  </section>
</div>
```

**Key patterns:**
- `<section>` elements with descriptive IDs
- Two-column layout (description + code)
- `.method-area`, `.method-example` classes
- Sidebar navigation (exclude `.sidebar`)

---

## 6. Scoring & Ranking

When multiple anchors match, pick the best ones:

```typescript
function selectBestSections(
  candidates: AnchorCandidate[],
  maxSections: number = 10  // cap to prevent extracting entire page
): AnchorCandidate[] {
  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  
  // Deduplicate overlapping sections
  const selected: AnchorCandidate[] = [];
  const coveredRanges: Array<[number, number]> = [];
  
  for (const candidate of candidates) {
    const range = getElementRange(candidate.element);
    
    // Skip if this element is already covered by a higher-scoring selection
    if (coveredRanges.some(([start, end]) => range[0] >= start && range[1] <= end)) {
      continue;
    }
    
    // Skip if this element CONTAINS an already-selected element
    // (prefer more specific over more general, unless score is much higher)
    const containedIndex = coveredRanges.findIndex(
      ([start, end]) => range[0] <= start && range[1] >= end
    );
    if (containedIndex >= 0 && candidate.score <= selected[containedIndex].score + 10) {
      continue;
    }
    
    selected.push(candidate);
    coveredRanges.push(range);
    
    if (selected.length >= maxSections) break;
  }
  
  return selected;
}
```

### Confidence Assignment

```typescript
function assignConfidence(sections: ExtractedSection[], candidates: AnchorCandidate[]): ExtractionConfidence {
  if (sections.length === 0) return 'none';
  
  const bestScore = Math.max(...candidates.map(c => c.score));
  const bestType = candidates.find(c => c.score === bestScore)?.matchType;
  
  if (bestScore >= 90 && (bestType === 'id' || bestType === 'data-attr')) return 'exact';
  if (bestScore >= 70 && bestType === 'heading') return 'heading';
  return 'fuzzy';
}
```

---

## 7. Fallback Chain

The extractor follows a strict fallback chain:

```
1. Platform-specific extraction (score ≥ 95)
   ↓ if no match
2. ID-based extraction (score ≥ 85)
   ↓ if no match  
3. Heading-based extraction (score ≥ 70)
   ↓ if no match
4. Data-attribute / class-based extraction (score ≥ 50)
   ↓ if no match
5. Full page diff (confidence: "none", flagged as "unscoped")
```

When falling back to full page, the extraction result includes `fallbackReason`:

```typescript
// Example fallback reasons:
"No matching anchors found for resource 'charges' on platform 'generic'"
"All candidate anchors scored below threshold (best: 42)"
"Resource name 'status' matched 47 elements — too ambiguous, falling back"
```

---

## 8. Edge Case Handling

### 8.1 Common Word Resources

Resources named "status", "users", "events", "data" etc. will match many elements. Defense:

```typescript
const COMMON_WORD_THRESHOLD = 15; // if more than 15 anchors match, resource name is too generic

function handleCommonWords(candidates: AnchorCandidate[], resourceNames: string[]): AnchorCandidate[] {
  if (candidates.length > COMMON_WORD_THRESHOLD) {
    // Fall back to ONLY high-confidence matches (score ≥ 90)
    const filtered = candidates.filter(c => c.score >= 90);
    if (filtered.length === 0) {
      // Flag: "Resource name too common for section extraction"
      return [];
    }
    return filtered;
  }
  return candidates;
}
```

Additionally, if an `endpointPath` is provided, always prefer path-based matches over name-based matches for common words.

### 8.2 Navigation/Sidebar Pollution

Handled in Phase 1 (main content isolation). Additional defense:

```typescript
function isInNavigation(el: Element): boolean {
  // Walk up to check if element is inside nav, sidebar, or ToC
  let parent: Element | null = el;
  while (parent) {
    const tag = parent.tagName?.toLowerCase();
    const cls = parent.getAttribute('class') || '';
    const role = parent.getAttribute('role') || '';
    
    if (tag === 'nav') return true;
    if (role === 'navigation') return true;
    if (/\b(sidebar|side-bar|toc|table-of-contents|nav|menu|breadcrumb|footer|header)\b/i.test(cls)) return true;
    
    parent = parent.parentElement;
  }
  return false;
}
```

### 8.3 Multiple CRUD Sections

When a resource has separate sections for Create, Read, Update, Delete, we want **all** of them:

```typescript
// In the main extraction function:
const sections = selectBestSections(candidates, 10); // allow up to 10 sections per resource

// Group by operation type in the report
const grouped = {
  overview: sections.filter(s => !s.heading?.match(/create|get|retrieve|list|update|delete/i)),
  operations: sections.filter(s => s.heading?.match(/create|get|retrieve|list|update|delete/i)),
};
```

### 8.4 Dynamic Content (JS-rendered)

If the diff engine uses Playwright (already supported via `--playwright` flag):
- The HTML is already fully rendered when it reaches the section extractor
- No special handling needed — Playwright gives us the post-render DOM

If using raw HTTP fetch:
- Swagger UI and Redoc render client-side — raw HTML is just a shell
- Section extractor returns `confidence: 'none'` with `fallbackReason: "Page appears to be JS-rendered (minimal content in HTML). Consider using --playwright."`
- Detection: if `<body>` has fewer than 500 chars of text content and contains `<script>` tags referencing known frameworks

```typescript
function detectJSRendered(html: string): boolean {
  // Quick heuristic: if body text is very short but has framework scripts
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return false;
  
  const bodyText = bodyMatch[1].replace(/<[^>]+>/g, '').trim();
  const hasFrameworkScripts = /swagger-ui|redoc|react|angular|vue/i.test(html);
  
  return bodyText.length < 500 && hasFrameworkScripts;
}
```

### 8.5 Section Size Sanity

Extracted sections should be neither too small (missed content) nor too large (basically the full page):

```typescript
const MIN_SECTION_CHARS = 100;     // Probably missed the content
const MAX_SECTION_RATIO = 0.8;     // If section is >80% of page, extraction isn't helping

function validateSections(sections: ExtractedSection[], fullPageLength: number): string[] {
  const warnings: string[] = [];
  
  for (const section of sections) {
    if (section.text.length < MIN_SECTION_CHARS) {
      warnings.push(`Section "${section.heading}" is suspiciously small (${section.text.length} chars)`);
    }
  }
  
  const totalSectionChars = sections.reduce((sum, s) => sum + s.text.length, 0);
  if (totalSectionChars > fullPageLength * MAX_SECTION_RATIO) {
    warnings.push(`Extracted sections cover ${Math.round(totalSectionChars / fullPageLength * 100)}% of the page — extraction may not be effective`);
  }
  
  return warnings;
}
```

---

## 9. Caching & Performance

### Section Map Cache

After first extraction, cache the section map (anchor positions) so subsequent diffs are faster:

```typescript
interface SectionMap {
  url: string;
  platform: PlatformType;
  sections: Array<{
    id: string;
    heading: string;
    startOffset: number;
    endOffset: number;
    score: number;
  }>;
  computedAt: number;     // Unix timestamp
  htmlHash: string;       // Hash of the full HTML — invalidate cache if page structure changes
}

// Store in the existing SQLite DB alongside snapshots
// Invalidate when htmlHash changes (page restructured)
```

### Performance Budget

- Section extraction should complete in **< 50ms** for typical pages (< 1MB HTML)
- Use cheerio (already a dependency) for DOM parsing — avoid full JSDOM for this step
- Limit querySelectorAll depth: don't recurse into elements with > 10,000 descendants

---

## 10. Storage & Diff Integration

### Snapshot Storage Changes

Currently snapshots store full page HTML/text. Add section-level storage:

```sql
-- New table for section snapshots
CREATE TABLE IF NOT EXISTS section_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  resource_key TEXT NOT NULL,     -- e.g., "charges" or "/v1/charges"
  section_hash TEXT NOT NULL,     -- Hash of extracted section text
  section_text TEXT NOT NULL,
  section_html TEXT,
  confidence TEXT NOT NULL,       -- 'exact', 'heading', 'fuzzy', 'none'
  platform TEXT,
  fetched_at INTEGER NOT NULL,
  UNIQUE(url, resource_key, fetched_at)
);

CREATE INDEX idx_section_latest ON section_snapshots(url, resource_key, fetched_at DESC);
```

### Diff Logic Changes

```typescript
// In the main pipeline:
async function processSectionDiff(
  url: string,
  resourceKey: string,
  currentHtml: string,
  extraction: ExtractionResult
): Promise<DiffResult | null> {
  const currentText = extraction.sections.map(s => s.text).join('\n---\n');
  const currentHash = hashText(currentText);
  
  // Get previous section snapshot
  const previous = getLatestSectionSnapshot(url, resourceKey);
  
  if (!previous) {
    // First time — store and return no diff
    storeSectionSnapshot(url, resourceKey, currentText, currentHash, extraction);
    return null;
  }
  
  if (previous.section_hash === currentHash) {
    // No change in this section
    return null;
  }
  
  // Section changed — run diff
  const diff = diffAll(previous.section_text, currentText);
  storeSectionSnapshot(url, resourceKey, currentText, currentHash, extraction);
  
  return diff;
}
```

---

## 11. Report Enrichment

When reporting a diff, include section extraction metadata:

```typescript
interface SectionDiffReport extends UrlReport {
  sectionExtraction: {
    confidence: ExtractionConfidence;
    platform: PlatformType;
    sectionsExtracted: number;
    sectionHeadings: string[];
    extractionTimeMs: number;
    warnings: string[];
  };
}
```

Example report output:
```
URL: https://docs.stripe.com/api
Resource: charges (/v1/charges)
Extraction: exact (Stripe custom, 4 sections found)
  - Charges (overview)
  - Create a charge
  - Retrieve a charge
  - List all charges
Changes detected:
  + New parameter: `payment_method_options.card.request_extended_authorization`
  + Description updated for `capture` parameter
```

---

## 12. Test Cases

### Unit Tests

| # | Platform | Test Input | Resource | Expected |
|---|----------|-----------|----------|----------|
| 1 | Swagger UI | Petstore HTML | "pet" | Extract all pet operations (addPet, getPetById, updatePet, deletePet, findByStatus, findByTags) |
| 2 | Swagger UI | Petstore HTML | "store" | Extract store operations only, NOT pet operations |
| 3 | Redoc | Petstore Redoc | "pet" | Match `id="tag/pet"` and `id="tag/pet/operation/*"` |
| 4 | Generic | Simple H2 sections | "charges" | Extract from `<h2 id="charges">` to next `<h2>` |
| 5 | Generic | Nested H3 | "create-charge" | Extract `<h3 id="create-charge">` + content until next `<h3>` or `<h2>` |
| 6 | Generic | No match | "nonexistent" | Return `confidence: 'none'`, fallback to full page |
| 7 | Generic | Sidebar pollution | "charges" | Ignore `<nav>` matches, only match main content |
| 8 | Generic | Common word | "status" | Handle > 15 matches gracefully, prefer high-confidence |
| 9 | Any | Empty/JS-only | "charges" | Detect JS-rendered, warn about Playwright |
| 10 | Any | Section too large | "api" | Warn that extracted section is > 80% of page |

### Integration Tests (Live URLs)

| # | URL | Resource | Expected Confidence |
|---|-----|----------|-------------------|
| 1 | `https://petstore.swagger.io/` (Playwright) | "pet" | exact |
| 2 | `https://redocly.github.io/redoc/` (Playwright) | "pet" | exact |
| 3 | `https://docs.github.com/en/rest/repos/repos` | "repos" | heading |
| 4 | `https://docs.stripe.com/api` (Playwright) | "charges" | exact |
| 5 | `https://developer.twitter.com/en/docs/api-reference-index` | "tweets" | heading or fuzzy |

### Edge Case Tests

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 1 | Overlapping sections | H2 "Charges" contains H3 "Create" and H3 "List" | Return both H3 sub-sections when searching for "charges" |
| 2 | CamelCase ID | `id="createCharge"` | Match resource "charges" |
| 3 | Slash-separated ID | `id="tag/Charges/operation/CreateCharge"` | Match resource "charges" |
| 4 | Data attribute | `data-endpoint="/v1/charges"` | Match with high confidence |
| 5 | Ambiguous: "data" | Resource name "data" on a page with 50+ matches | Fall back to full page with warning |
| 6 | Multiple pages same resource | CRUD on separate sub-pages | Each page extracts its own section independently |

---

## 13. Implementation Plan

### Files to Create/Modify

1. **NEW: `src/section-extractor.ts`** — Main module (~400 lines)
   - `detectPlatform()`
   - `isolateMainContent()`
   - `findAnchors()` + all sub-strategies
   - `extractSection()` + heading/container/sibling variants
   - `selectBestSections()`
   - `extractSections()` (main entry point)

2. **NEW: `src/platform-extractors.ts`** — Platform-specific logic (~300 lines)
   - `findSwaggerAnchors()`
   - `findRedocAnchors()`
   - `findStoplightAnchors()`
   - `findDocusaurusAnchors()`
   - `findGitBookAnchors()`
   - `findMintlifyAnchors()`

3. **MODIFY: `src/index.ts`** — Integration (~30 lines changed)
   - Add `--resource` CLI flag
   - Insert section extraction between normalize and diff
   - Handle fallback logic

4. **MODIFY: `src/snapshot.ts`** — Section snapshot storage (~50 lines)
   - Add `section_snapshots` table
   - `storeSectionSnapshot()` / `getLatestSectionSnapshot()`

5. **MODIFY: `src/report.ts`** — Section extraction metadata in reports (~20 lines)

6. **NEW: `src/__tests__/section-extractor.test.ts`** — Unit tests (~200 lines)
   - Fixtures: sample HTML for each platform
   - All test cases from Section 12

### Dependencies

- **cheerio** (already installed) — HTML parsing without full browser
- No new dependencies needed

### Implementation Order

1. Types and data structures
2. Platform detection
3. Main content isolation
4. Generic anchor finding (ID, heading, data-attr, class)
5. Heading section extraction algorithm
6. Container section extraction
7. Platform-specific extractors (Swagger, Redoc first — most common)
8. Scoring, ranking, deduplication
9. Integration with diff pipeline
10. Section snapshot storage
11. Tests
12. Remaining platform extractors (Docusaurus, GitBook, Mintlify, Stoplight)

---

## 14. Open Questions

1. **Should we store section maps persistently?** Current design caches them per-run. Persistent caching would speed up subsequent runs but adds complexity.

2. **Multi-resource monitoring:** If a user watches both `/v1/charges` and `/v1/customers` on the same page, we fetch the page once but extract two different section sets. Should we batch this?

3. **Section drift detection:** If the page restructures (headings renamed, IDs changed), the section extractor will fail silently and fall back to full page. Should we alert the user that their scoped monitoring degraded?

4. **Shadow DOM:** Stoplight Elements uses web components. Playwright can pierce shadow DOM, but cheerio cannot. For now, Stoplight requires `--playwright`. Worth documenting this limitation.

5. **Content hash for section identity:** Instead of relying on anchor IDs (which may change), should we also hash section content to track section identity across restructures?

---

## 15. Success Metrics

- **Precision:** ≥ 95% of extracted sections contain the target resource content and nothing irrelevant
- **Recall:** ≥ 90% of relevant content is captured (no missing CRUD operations)
- **Fallback rate:** < 20% of monitored single-page docs fall back to full page diff
- **False positive reduction:** ≥ 80% reduction in false positive diffs for single-page docs (compared to full-page diffing)
- **Performance:** < 50ms extraction time for pages under 1MB
