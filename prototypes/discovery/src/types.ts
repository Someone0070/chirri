export interface DiscoveryResult {
  url: string;
  method: string;
  confidence: number;
  type: 'docs' | 'changelog' | 'status' | 'openapi' | 'blog' | 'unknown';
  meta?: Record<string, string>;
  /** All methods that discovered this URL (populated after dedup) */
  methods?: string[];
  /** The canonical (normalized + redirect-resolved) URL */
  canonicalUrl?: string;
}

export interface DedupStats {
  totalBefore: number;
  totalAfter: number;
  redirectsResolved: number;
  redirectsFailed: number;
  redirectsCached: number;
}

export interface DomainResult {
  domain: string;
  discovered: {
    docs: DiscoveryResult[];
    changelog: DiscoveryResult[];
    status: DiscoveryResult[];
    openapi: DiscoveryResult[];
  };
  platforms: string[];
  methods_tried: number;
  methods_succeeded: number;
  total_discovered: number;
  /** Total URLs before deduplication */
  total_raw?: number;
  dedup_stats?: DedupStats;
  duration_ms: number;
  errors: string[];
}

export interface MethodResult {
  method: string;
  results: DiscoveryResult[];
  error?: string;
}

export type DiscoveryMethod = (domain: string) => Promise<MethodResult>;
