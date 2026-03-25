/**
 * Snapshot storage using SQLite
 */
export interface Snapshot {
    id: number;
    url: string;
    timestamp: string;
    rawHtml: string;
    readabilityText: string;
    structuralDom: string;
    textOnly: string;
    fetchMethod: string;
    fetchTimeMs: number;
    error: string | null;
}
/**
 * Store a new snapshot
 */
export declare function storeSnapshot(data: {
    url: string;
    rawHtml: string;
    readabilityText: string;
    structuralDom: string;
    textOnly: string;
    fetchMethod: string;
    fetchTimeMs: number;
    error?: string | null;
}): number;
/**
 * Get the latest snapshot for a URL
 */
export declare function getLatestSnapshot(url: string): Snapshot | null;
/**
 * Get the previous snapshot for a URL (second most recent)
 */
export declare function getPreviousSnapshot(url: string): Snapshot | null;
/**
 * Get snapshot count for a URL
 */
export declare function getSnapshotCount(url: string): number;
/**
 * Close the database connection
 */
export declare function closeDb(): void;
