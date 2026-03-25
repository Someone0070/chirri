/**
 * Report generation - output comparison results
 */
import type { DiffResult } from './differ.js';
export interface UrlReport {
    url: string;
    company?: string;
    type?: string;
    hasHistory: boolean;
    fetchError?: string;
    fetchMethod: string;
    fetchTimeMs: number;
    diffs: DiffResult[];
}
export interface FullReport {
    timestamp: string;
    totalUrls: number;
    fetchedUrls: number;
    errorUrls: number;
    urlsWithHistory: number;
    changedUrls: number;
    results: UrlReport[];
}
/**
 * Generate a text report from URL results
 */
export declare function generateTextReport(report: FullReport): string;
/**
 * Generate a JSON report
 */
export declare function generateJsonReport(report: FullReport): string;
