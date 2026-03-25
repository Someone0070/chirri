/**
 * Normalization pipeline - strips noise before diffing
 */
// Strip CSRF tokens, session IDs, nonces
function stripSecurityTokens(html) {
    // Remove input fields with csrf/token/nonce names
    html = html.replace(/<input[^>]*(?:name|id)=["'][^"']*(?:csrf|_token|nonce|session|authenticity)[^"']*["'][^>]*\/?>/gi, '');
    // Remove nonce attributes
    html = html.replace(/\s+nonce=["'][^"']*["']/gi, '');
    // Remove csrf-token meta tags
    html = html.replace(/<meta[^>]*(?:csrf|_token)[^>]*\/?>/gi, '');
    return html;
}
// Normalize timestamps
function normalizeTimestamps(text) {
    // ISO dates: 2024-03-24T12:34:56Z, 2024-03-24T12:34:56.789Z, 2024-03-24T12:34:56+00:00
    text = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '[TIMESTAMP]');
    // Date strings: 2024-03-24, 03/24/2024, March 24, 2024
    text = text.replace(/\d{4}-\d{2}-\d{2}/g, '[DATE]');
    text = text.replace(/\d{2}\/\d{2}\/\d{4}/g, '[DATE]');
    text = text.replace(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi, '[DATE]');
    text = text.replace(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}/gi, '[DATE]');
    // Unix timestamps (10 or 13 digits)
    text = text.replace(/\b1[6-9]\d{8,11}\b/g, '[UNIX_TS]');
    // Relative times: "5 minutes ago", "Updated 2 hours ago", "Last modified X ago"
    text = text.replace(/(?:updated|modified|changed|published|posted|edited)?\s*\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago/gi, '[RELATIVE_TIME]');
    // "Last updated: ..." patterns
    text = text.replace(/(?:last\s+)?(?:updated|modified)\s*:?\s*[^\n<]{0,50}/gi, '[LAST_UPDATED]');
    return text;
}
// Strip cache-buster query params from URLs
function stripCacheBusters(text) {
    // Remove common cache-buster params: ?v=, ?cb=, ?_=, ?ver=, ?hash=, ?t=
    text = text.replace(/([?&])(?:v|cb|_|ver|hash|t|cachebust|rev|build)=[^&"'\s)>]*/gi, '$1__CB__');
    // Clean up resulting ?__CB__& or &__CB__& artifacts
    text = text.replace(/[?&]__CB__(?=[&"'\s)>])/g, '');
    text = text.replace(/__CB__/g, '');
    return text;
}
// Remove tracking pixels and analytics scripts
function stripAnalytics(html) {
    // Remove script tags containing known analytics
    const analyticsPatterns = [
        /google-analytics\.com/i,
        /googletagmanager\.com/i,
        /gtag/i,
        /analytics/i,
        /segment\.com/i,
        /hotjar/i,
        /mixpanel/i,
        /amplitude/i,
        /heap\.io/i,
        /fullstory/i,
        /intercom/i,
        /drift/i,
        /hubspot/i,
        /facebook.*pixel/i,
        /fbevents/i,
    ];
    // Remove entire script blocks with analytics
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
        for (const pattern of analyticsPatterns) {
            if (pattern.test(match))
                return '';
        }
        return match;
    });
    // Remove tracking pixels (1x1 images)
    html = html.replace(/<img[^>]*(?:width|height)=["']?1["']?[^>]*(?:width|height)=["']?1["']?[^>]*\/?>/gi, '');
    return html;
}
// Normalize whitespace
function normalizeWhitespace(text) {
    // Collapse multiple spaces to single
    text = text.replace(/[ \t]+/g, ' ');
    // Collapse multiple newlines to double
    text = text.replace(/\n{3,}/g, '\n\n');
    // Trim lines
    text = text.split('\n').map(line => line.trim()).join('\n');
    return text.trim();
}
// Strip common ad network div classes
function stripAds(html) {
    const adPatterns = [
        /class=["'][^"']*(?:ad-|ads-|advert|banner-ad|sponsor|promo-banner|google-ad|adsense)[^"']*["']/i
    ];
    // Simple approach: remove elements with ad-related classes
    for (const _pattern of adPatterns) {
        html = html.replace(/<div[^>]*class=["'][^"']*(?:ad-container|ads-|advert|banner-ad|sponsor|promo-banner|google-ad|adsense)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
    }
    return html;
}
// Remove dynamic element IDs (ember123, data-reactid, etc.)
function stripDynamicIds(html) {
    // ember IDs
    html = html.replace(/\s+id=["']ember\d+["']/gi, '');
    // data-reactid
    html = html.replace(/\s+data-reactid=["'][^"']*["']/gi, '');
    // data-react-* attributes
    html = html.replace(/\s+data-react[a-z-]*=["'][^"']*["']/gi, '');
    // Random hash-like IDs (hex strings > 8 chars)
    html = html.replace(/\s+id=["'][a-f0-9]{8,}["']/gi, '');
    // data-testid (often dynamic)
    html = html.replace(/\s+data-testid=["'][^"']*["']/gi, '');
    // Angular ng-* attributes
    html = html.replace(/\s+(?:ng-|_ng)[a-z-]*(?:=["'][^"']*["'])?/gi, '');
    // Svelte-style class hashes
    html = html.replace(/\s+class=["']svelte-[a-z0-9]+["']/gi, '');
    return html;
}
// Remove script and style tags entirely
function stripScriptsAndStyles(html) {
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*\/?>/gi, '');
    return html;
}
// Strip HTML comments
function stripComments(html) {
    return html.replace(/<!--[\s\S]*?-->/g, '');
}
/**
 * Full normalization pipeline for HTML content
 */
export function normalizeHtml(html) {
    let result = html;
    result = stripScriptsAndStyles(result);
    result = stripComments(result);
    result = stripSecurityTokens(result);
    result = stripAnalytics(result);
    result = stripAds(result);
    result = stripDynamicIds(result);
    result = stripCacheBusters(result);
    result = normalizeTimestamps(result);
    result = normalizeWhitespace(result);
    return result;
}
/**
 * Full normalization pipeline for text content
 */
export function normalizeText(text) {
    let result = text;
    result = stripCacheBusters(result);
    result = normalizeTimestamps(result);
    result = normalizeWhitespace(result);
    return result;
}
