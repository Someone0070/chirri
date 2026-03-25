/**
 * Diff engine - reuses normalizer logic from chirri diff-engine
 */
import { createPatch } from 'diff';

export interface DiffResult {
  strategy: string;
  changed: boolean;
  diffSize: number;
  totalLines: number;
  noiseEstimate: number;
  patch: string;
  addedLines: number;
  removedLines: number;
}

// === Normalization (inline from diff-engine) ===

const KNOWN_VOLATILE_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  { name: 'build_hash', regex: /(?:build|commit|revision|sha|git[_-]?hash)\s*[:=]\s*["']?[a-f0-9]{7,40}["']?/gi, replacement: '[BUILD_HASH]' },
  { name: 'deploy_id', regex: /(?:deploy[_-]?id|deployment[_-]?id|release[_-]?id)\s*[:=]\s*["']?[A-Za-z0-9_-]{8,}["']?/gi, replacement: '[DEPLOY_ID]' },
  { name: 'bundle_hash', regex: /[a-z]+\.[a-f0-9]{8,20}\.(?:js|css|chunk\.js|chunk\.css)/gi, replacement: '[BUNDLE_FILE]' },
  { name: 'copyright_year', regex: /©\s*(?:20[0-9]{2}[-–]\s*)?20[0-9]{2}/g, replacement: '© [YEAR]' },
  { name: 'generated_at', regex: /(?:generated|rendered|compiled|built)\s+(?:at|on)\s*:?\s*[^\n<]{5,40}/gi, replacement: '[GENERATED_AT]' },
  { name: 'last_updated_date', regex: /(?:last\s+)?(?:updated|modified|edited|changed)\s*:?\s*(?:\d{4}[-/]\d{2}[-/]\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2})/gi, replacement: '[LAST_UPDATED]' },
  { name: 'time_ago', regex: /\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago/gi, replacement: '[TIME_AGO]' },
  { name: 'nonce_attr', regex: /\s+nonce=["'][A-Za-z0-9+/=]{8,}["']/gi, replacement: '' },
  { name: 'sri_hash', regex: /integrity=["']sha\d+-[A-Za-z0-9+/=]+["']/gi, replacement: 'integrity="[SRI]"' },
  { name: 'random_uuid', regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replacement: '[UUID]' },
  { name: 'google_analytics_id', regex: /(?:UA-\d{4,10}-\d{1,4}|G-[A-Z0-9]{10,}|GTM-[A-Z0-9]{6,})/g, replacement: '[GA_ID]' },
  { name: 'cache_buster_param', regex: /[?&](?:_|cb|cachebust|t|ts|timestamp|v|ver|rev|build)=[a-zA-Z0-9._-]+/gi, replacement: '' },
];

function normalizeTimestamps(text: string): string {
  text = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '[TIMESTAMP]');
  text = text.replace(/\d{4}-\d{2}-\d{2}/g, '[DATE]');
  text = text.replace(/\d{2}\/\d{2}\/\d{4}/g, '[DATE]');
  text = text.replace(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi, '[DATE]');
  text = text.replace(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}/gi, '[DATE]');
  text = text.replace(/\b1[6-9]\d{8,11}\b/g, '[UNIX_TS]');
  text = text.replace(/(?:updated|modified|changed|published|posted|edited)?\s*\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago/gi, '[RELATIVE_TIME]');
  return text;
}

function normalizeHtml(html: string): string {
  // Strip scripts, styles, comments
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  // Strip security tokens
  html = html.replace(/<input[^>]*(?:name|id)=["'][^"']*(?:csrf|_token|nonce|session|authenticity)[^"']*["'][^>]*\/?>/gi, '');
  html = html.replace(/<meta[^>]*(?:csrf|_token)[^>]*\/?>/gi, '');
  // Strip analytics
  html = html.replace(/<img[^>]*(?:width|height)=["']?1["']?[^>]*(?:width|height)=["']?1["']?[^>]*\/?>/gi, '');
  // Strip dynamic IDs
  html = html.replace(/\s+id=["']ember\d+["']/gi, '');
  html = html.replace(/\s+data-reactid=["'][^"']*["']/gi, '');
  html = html.replace(/\s+data-react[a-z-]*=["'][^"']*["']/gi, '');
  html = html.replace(/\s+data-testid=["'][^"']*["']/gi, '');
  // Normalize timestamps
  html = normalizeTimestamps(html);
  // Apply volatile patterns
  for (const p of KNOWN_VOLATILE_PATTERNS) {
    html = html.replace(p.regex, p.replacement);
  }
  // Normalize whitespace
  html = html.replace(/[ \t]+/g, ' ');
  html = html.replace(/\n{3,}/g, '\n\n');
  html = html.split('\n').map(l => l.trim()).join('\n').trim();
  return html;
}

function normalizeText(text: string): string {
  text = normalizeTimestamps(text);
  for (const p of KNOWN_VOLATILE_PATTERNS) {
    text = text.replace(p.regex, p.replacement);
  }
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.split('\n').map(l => l.trim()).join('\n').trim();
  return text;
}

function analyzePatch(patch: string): { addedLines: number; removedLines: number; totalChangedLines: number } {
  const lines = patch.split('\n');
  let addedLines = 0, removedLines = 0;
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) addedLines++;
    if (line.startsWith('-') && !line.startsWith('---')) removedLines++;
  }
  return { addedLines, removedLines, totalChangedLines: addedLines + removedLines };
}

function estimateNoise(patch: string): number {
  const lines = patch.split('\n');
  let noiseLines = 0, totalDiffLines = 0;
  const noisePatterns = [
    /\[TIMESTAMP\]/, /\[DATE\]/, /\[UNIX_TS\]/, /\[RELATIVE_TIME\]/, /\[LAST_UPDATED\]/,
    /\[BUILD_HASH\]/, /\[DEPLOY_ID\]/, /\[BUNDLE_FILE\]/, /\[GENERATED_AT\]/,
    /\[UUID\]/, /\[GA_ID\]/, /\[YEAR\]/, /\[TIME_AGO\]/,
    /^\s*$/, /^\s*[+-]\s*$/,
  ];
  for (const line of lines) {
    if ((line.startsWith('+') && !line.startsWith('+++')) || (line.startsWith('-') && !line.startsWith('---'))) {
      totalDiffLines++;
      for (const p of noisePatterns) { if (p.test(line)) { noiseLines++; break; } }
    }
  }
  return totalDiffLines === 0 ? 0 : noiseLines / totalDiffLines;
}

/** Strategy 1: Normalized HTML diff */
export function diffRawHtml(before: string, after: string): DiffResult {
  const a = normalizeHtml(before), b = normalizeHtml(after);
  const patch = createPatch('page.html', a, b, '', '', { context: 3 });
  const stats = analyzePatch(patch);
  return {
    strategy: 'raw_html', changed: stats.totalChangedLines > 0,
    diffSize: stats.totalChangedLines, totalLines: b.split('\n').length,
    noiseEstimate: estimateNoise(patch),
    patch: patch.length > 10000 ? patch.substring(0, 10000) + '\n... [truncated]' : patch,
    addedLines: stats.addedLines, removedLines: stats.removedLines,
  };
}

/** Strategy 2: Readability text diff */
export function diffReadability(before: string, after: string): DiffResult {
  const a = normalizeText(before), b = normalizeText(after);
  const patch = createPatch('readability.txt', a, b, '', '', { context: 3 });
  const stats = analyzePatch(patch);
  return {
    strategy: 'readability', changed: stats.totalChangedLines > 0,
    diffSize: stats.totalChangedLines, totalLines: b.split('\n').length,
    noiseEstimate: estimateNoise(patch),
    patch: patch.length > 10000 ? patch.substring(0, 10000) + '\n... [truncated]' : patch,
    addedLines: stats.addedLines, removedLines: stats.removedLines,
  };
}

/** Strategy 3: Text-only diff */
export function diffTextOnly(before: string, after: string): DiffResult {
  const a = normalizeText(before), b = normalizeText(after);
  const patch = createPatch('text.txt', a, b, '', '', { context: 3 });
  const stats = analyzePatch(patch);
  return {
    strategy: 'text_only', changed: stats.totalChangedLines > 0,
    diffSize: stats.totalChangedLines, totalLines: b.split('\n').length,
    noiseEstimate: estimateNoise(patch),
    patch: patch.length > 10000 ? patch.substring(0, 10000) + '\n... [truncated]' : patch,
    addedLines: stats.addedLines, removedLines: stats.removedLines,
  };
}
