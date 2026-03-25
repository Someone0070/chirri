/**
 * Normalization pipeline - strips noise before diffing
 *
 * Layer 4 (Proactive FP Detection) integrated: scans for ~30 known volatile
 * patterns and auto-strips them before any diff strategy runs.
 */

export interface NormalizationAudit {
  patternsStripped: Array<{ name: string; count: number }>;
  totalStripped: number;
}

let _lastAudit: NormalizationAudit = { patternsStripped: [], totalStripped: 0 };

export function getLastNormalizationAudit(): NormalizationAudit {
  return _lastAudit;
}

const KNOWN_VOLATILE_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  // Build & Deploy identifiers
  { name: 'build_hash', regex: /(?:build|commit|revision|sha|git[_-]?hash)\s*[:=]\s*["']?[a-f0-9]{7,40}["']?/gi, replacement: '[BUILD_HASH]' },
  { name: 'deploy_id', regex: /(?:deploy[_-]?id|deployment[_-]?id|release[_-]?id)\s*[:=]\s*["']?[A-Za-z0-9_-]{8,}["']?/gi, replacement: '[DEPLOY_ID]' },
  { name: 'version_hash', regex: /(?:v|ver|version)\s*[:=]?\s*["']?\d+\.\d+\.\d+[-+][a-f0-9]{6,}["']?/gi, replacement: '[VERSION_HASH]' },
  { name: 'bundle_hash', regex: /[a-z]+\.[a-f0-9]{8,20}\.(?:js|css|chunk\.js|chunk\.css)/gi, replacement: '[BUNDLE_FILE]' },

  // Request & Session identifiers
  { name: 'request_id', regex: /(?:request[_-]?id|req[_-]?id|x-request-id)\s*[:=]\s*["']?[a-f0-9-]{8,36}["']?/gi, replacement: '[REQUEST_ID]' },
  { name: 'trace_id', regex: /(?:trace[_-]?id|span[_-]?id|correlation[_-]?id)\s*[:=]\s*["']?[a-f0-9-]{8,36}["']?/gi, replacement: '[TRACE_ID]' },
  { name: 'session_id', regex: /(?:session[_-]?id|sid|PHPSESSID|JSESSIONID)\s*[:=]\s*["']?[A-Za-z0-9._-]{16,}["']?/gi, replacement: '[SESSION_ID]' },
  { name: 'csrf_token_value', regex: /(?:csrf[_-]?token|_token|authenticity_token)\s*[:=]\s*["']?[A-Za-z0-9+/=_-]{16,}["']?/gi, replacement: '[CSRF_TOKEN]' },

  // CDN & Cache
  { name: 'cdn_cache_header', regex: /(?:x-cache|cf-ray|x-served-by|x-amz-request-id)\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/gi, replacement: '[CDN_HEADER]' },
  { name: 'etag_value', regex: /(?:etag|e-tag)\s*[:=]\s*["']?[A-Za-z0-9+/=_"-]{8,}["']?/gi, replacement: '[ETAG]' },
  { name: 'cache_buster_param', regex: /[?&](?:_|cb|cachebust|t|ts|timestamp|v|ver|rev|build)=[a-zA-Z0-9._-]+/gi, replacement: '' },
  { name: 'cache_control_dynamic', regex: /(?:age|max-age)\s*[:=]\s*\d+/gi, replacement: '[CACHE_AGE]' },

  // Timestamps & Dates
  { name: 'copyright_year', regex: /©\s*(?:20[0-9]{2}[-–]\s*)?20[0-9]{2}/g, replacement: '© [YEAR]' },
  { name: 'generated_at', regex: /(?:generated|rendered|compiled|built)\s+(?:at|on)\s*:?\s*[^\n<]{5,40}/gi, replacement: '[GENERATED_AT]' },
  { name: 'last_updated_date', regex: /(?:last\s+)?(?:updated|modified|edited|changed)\s*:?\s*(?:\d{4}[-/]\d{2}[-/]\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2})/gi, replacement: '[LAST_UPDATED]' },
  { name: 'time_ago', regex: /\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago/gi, replacement: '[TIME_AGO]' },
  { name: 'server_time', regex: /(?:server[_-]?time|current[_-]?time)\s*[:=]\s*["']?[^\n"']{5,30}["']?/gi, replacement: '[SERVER_TIME]' },
  { name: 'page_load_time', regex: /(?:page\s+)?(?:load|render)\s*(?:time|in)\s*[:=]?\s*\d+(?:\.\d+)?\s*(?:ms|milliseconds|seconds|s)/gi, replacement: '[LOAD_TIME]' },

  // Dynamic content
  { name: 'nonce_attr', regex: /\s+nonce=["'][A-Za-z0-9+/=]{8,}["']/gi, replacement: '' },
  { name: 'data_reactroot', regex: /\s+data-reactroot(?:=["'][^"']*["'])?/gi, replacement: '' },
  { name: 'data_turbo_track', regex: /\s+data-turbo-track=["'][^"']*["']/gi, replacement: '' },
  { name: 'sri_hash', regex: /integrity=["']sha\d+-[A-Za-z0-9+/=]+["']/gi, replacement: 'integrity="[SRI]"' },
  { name: 'random_uuid', regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replacement: '[UUID]' },

  // API response noise
  { name: 'rate_limit_headers', regex: /(?:x-ratelimit-[a-z]+|x-rate-limit-[a-z]+)\s*[:=]\s*\d+/gi, replacement: '[RATE_LIMIT]' },
  { name: 'response_time', regex: /(?:x-response-time|x-runtime)\s*[:=]\s*["']?\d+(?:\.\d+)?["']?/gi, replacement: '[RESPONSE_TIME]' },
  { name: 'server_header', regex: /(?:x-powered-by|server)\s*[:=]\s*["']?[^\n"']{3,40}["']?/gi, replacement: '[SERVER]' },
  { name: 'content_length_dynamic', regex: /content-length\s*[:=]\s*\d+/gi, replacement: '[CONTENT_LENGTH]' },

  // Misc
  { name: 'google_analytics_id', regex: /(?:UA-\d{4,10}-\d{1,4}|G-[A-Z0-9]{10,}|GTM-[A-Z0-9]{6,})/g, replacement: '[GA_ID]' },
  { name: 'hotjar_id', regex: /hjid\s*[:=]\s*\d+/gi, replacement: '[HOTJAR_ID]' },
  { name: 'intercom_id', regex: /intercomSettings\s*[:=]\s*\{[^}]*app_id\s*[:=]\s*["'][^"']+["']/gi, replacement: '[INTERCOM]' },

  // Wayback Machine artifacts
  { name: 'wayback_toolbar', regex: /<!--\s*BEGIN\s+WAYBACK\s+TOOLBAR[\s\S]*?END\s+WAYBACK\s+TOOLBAR\s*-->/gi, replacement: '' },
  { name: 'wayback_banner', regex: /<div\s+id=["']?wm-ipp-base["']?[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, replacement: '' },
  { name: 'wayback_script', regex: /<script[^>]*(?:web\.archive\.org|archive\.org\/includes|playback)[^>]*>[\s\S]*?<\/script>/gi, replacement: '' },
  { name: 'wayback_link', regex: /<link[^>]*(?:web\.archive\.org|archive\.org)[^>]*\/?>/gi, replacement: '' },
  { name: 'wayback_comment', regex: /<!--\s*(?:FILE ARCHIVED ON|saved from url)[^>]*-->/gi, replacement: '' },
  { name: 'gtm_iframe', regex: /<iframe[^>]*googletagmanager\.com[^>]*>[\s\S]*?<\/iframe>/gi, replacement: '' },
  { name: 'nav_breadcrumb', regex: /(?:Skip to (?:main )?content|Find anything\/)/gi, replacement: '' },
  { name: 'footer_social_links', regex: /(?:Twitter|Discord|GitHub|LinkedIn|Mastodon|Bluesky|Facebook)(?=(?:Twitter|Discord|GitHub|LinkedIn|Mastodon|Bluesky|Facebook|©))/gi, replacement: '' },
  { name: 'rendered_with', regex: /Rendered with (?:Jekyll|Hugo|Gatsby|Next\.js|Docusaurus|MkDocs|Sphinx|GitBook)[^\n]*/gi, replacement: '[RENDERED_WITH]' },
  { name: 'feedback_widget', regex: /(?:Was this (?:page|article|section) helpful|Give us your feedback|Rate this page|How did we do)[^\n]{0,200}/gi, replacement: '[FEEDBACK_WIDGET]' },
];

function stripSecurityTokens(html: string): string {
  html = html.replace(/<input[^>]*(?:name|id)=["'][^"']*(?:csrf|_token|nonce|session|authenticity)[^"']*["'][^>]*\/?>/gi, '');
  html = html.replace(/\s+nonce=["'][^"']*["']/gi, '');
  html = html.replace(/<meta[^>]*(?:csrf|_token)[^>]*\/?>/gi, '');
  return html;
}

function normalizeTimestamps(text: string): string {
  text = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '[TIMESTAMP]');
  text = text.replace(/\d{4}-\d{2}-\d{2}/g, '[DATE]');
  text = text.replace(/\d{2}\/\d{2}\/\d{4}/g, '[DATE]');
  text = text.replace(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi, '[DATE]');
  text = text.replace(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}/gi, '[DATE]');
  text = text.replace(/\b1[6-9]\d{8,11}\b/g, '[UNIX_TS]');
  text = text.replace(/(?:updated|modified|changed|published|posted|edited)?\s*\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago/gi, '[RELATIVE_TIME]');
  text = text.replace(/(?:last\s+)?(?:updated|modified)\s*:?\s*[^\n<]{0,50}/gi, '[LAST_UPDATED]');
  return text;
}

function stripCacheBusters(text: string): string {
  text = text.replace(/([?&])(?:v|cb|_|ver|hash|t|cachebust|rev|build)=[^&"'\s)>]*/gi, '$1__CB__');
  text = text.replace(/[?&]__CB__(?=[&"'\s)>])/g, '');
  text = text.replace(/__CB__/g, '');
  return text;
}

function stripAnalytics(html: string): string {
  const analyticsPatterns = [
    /google-analytics\.com/i, /googletagmanager\.com/i, /gtag/i, /analytics/i,
    /segment\.com/i, /hotjar/i, /mixpanel/i, /amplitude/i, /heap\.io/i,
    /fullstory/i, /intercom/i, /drift/i, /hubspot/i, /facebook.*pixel/i, /fbevents/i,
  ];

  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    for (const pattern of analyticsPatterns) {
      if (pattern.test(match)) return '';
    }
    return match;
  });

  html = html.replace(/<img[^>]*(?:width|height)=["']?1["']?[^>]*(?:width|height)=["']?1["']?[^>]*\/?>/gi, '');
  return html;
}

function normalizeWhitespace(text: string): string {
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.split('\n').map((line) => line.trim()).join('\n');
  return text.trim();
}

function stripAds(html: string): string {
  html = html.replace(/<div[^>]*class=["'][^"']*(?:ad-container|ads-|advert|banner-ad|sponsor|promo-banner|google-ad|adsense)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  return html;
}

function stripDynamicIds(html: string): string {
  html = html.replace(/\s+id=["']ember\d+["']/gi, '');
  html = html.replace(/\s+data-reactid=["'][^"']*["']/gi, '');
  html = html.replace(/\s+data-react[a-z-]*=["'][^"']*["']/gi, '');
  html = html.replace(/\s+id=["'][a-f0-9]{8,}["']/gi, '');
  html = html.replace(/\s+data-testid=["'][^"']*["']/gi, '');
  html = html.replace(/\s+(?:ng-|_ng)[a-z-]*(?:=["'][^"']*["'])?/gi, '');
  html = html.replace(/\s+class=["']svelte-[a-z0-9]+["']/gi, '');
  return html;
}

function stripScriptsAndStyles(html: string): string {
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*\/?>/gi, '');
  return html;
}

function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function proactiveFPDetection(text: string): string {
  const audit: NormalizationAudit = { patternsStripped: [], totalStripped: 0 };
  let result = text;

  for (const pattern of KNOWN_VOLATILE_PATTERNS) {
    const matches = result.match(pattern.regex);
    if (matches && matches.length > 0) {
      audit.patternsStripped.push({ name: pattern.name, count: matches.length });
      audit.totalStripped += matches.length;
      result = result.replace(pattern.regex, pattern.replacement);
    }
  }

  _lastAudit = audit;
  return result;
}

function stripWaybackArtifacts(html: string): string {
  html = html.replace(/<div\s+id=["']?wm-ipp-base["']?[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '');
  html = html.replace(/<!--\s*(?:BEGIN|END)\s+WAYBACK\s+TOOLBAR[\s\S]*?-->/gi, '');
  html = html.replace(/<!--\s*(?:FILE ARCHIVED ON|saved from url)[^>]*-->/gi, '');
  html = html.replace(/<script[^>]*(?:web\.archive\.org|archive\.org\/includes|playback)[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<link[^>]*(?:web\.archive\.org|archive\.org)[^>]*\/?>/gi, '');
  html = html.replace(/<iframe[^>]*googletagmanager\.com[^>]*>[\s\S]*?<\/iframe>/gi, '');
  return html;
}

export function normalizeHtml(html: string): string {
  let result = html;
  result = stripWaybackArtifacts(result);
  result = stripScriptsAndStyles(result);
  result = stripComments(result);
  result = stripSecurityTokens(result);
  result = stripAnalytics(result);
  result = stripAds(result);
  result = stripDynamicIds(result);
  result = stripCacheBusters(result);
  result = normalizeTimestamps(result);
  result = proactiveFPDetection(result);
  result = normalizeWhitespace(result);
  return result;
}

export function normalizeText(text: string): string {
  let result = text;
  result = stripCacheBusters(result);
  result = normalizeTimestamps(result);
  result = proactiveFPDetection(result);
  result = normalizeWhitespace(result);
  return result;
}
