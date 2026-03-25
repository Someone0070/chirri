import normalizeUrl from 'normalize-url';
import { createHash } from 'node:crypto';

export function normalizeMonitorUrl(input: string): string {
  return normalizeUrl(input, {
    stripHash: true,
    stripWWW: true,
    removeTrailingSlash: true,
    removeSingleSlash: true,
    removeDirectoryIndex: false,
    sortQueryParameters: true,
    removeQueryParameters: false,
  });
}

export function hashUrl(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex');
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '/';
  }
}
