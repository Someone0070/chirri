/**
 * Fetcher - HTTP fetch + Playwright fallback for JS-rendered pages
 */
export interface FetchResult {
    url: string;
    rawHtml: string;
    readabilityText: string;
    structuralDom: string;
    textOnly: string;
    fetchMethod: 'http' | 'playwright';
    fetchTimeMs: number;
    error?: string;
}
/**
 * Fetch a URL and generate all 4 snapshot types
 */
export declare function fetchUrl(url: string, usePlaywright?: boolean): Promise<FetchResult>;
