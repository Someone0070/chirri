/**
 * Diff strategies - compare snapshots using different approaches
 */
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
/**
 * Strategy 1: Raw HTML diff (with normalization)
 */
export declare function diffRawHtml(before: string, after: string): DiffResult;
/**
 * Strategy 2: Readability-extracted text diff
 */
export declare function diffReadability(before: string, after: string): DiffResult;
/**
 * Strategy 3: Structural DOM diff
 */
export declare function diffStructural(before: string, after: string): DiffResult;
/**
 * Strategy 4: Text-only diff
 */
export declare function diffTextOnly(before: string, after: string): DiffResult;
/**
 * Run all 4 diff strategies
 */
export declare function diffAll(before: {
    rawHtml: string;
    readabilityText: string;
    structuralDom: string;
    textOnly: string;
}, after: {
    rawHtml: string;
    readabilityText: string;
    structuralDom: string;
    textOnly: string;
}): DiffResult[];
