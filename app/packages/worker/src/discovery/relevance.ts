import * as cheerio from 'cheerio';
import type { DiscoveryResult, DomainResult } from './types.js';
import { safeGet, safeHead, classifyUrl, parallelLimit } from './utils.js';

export interface RelevanceEntry {
  url: string;
  type: DiscoveryResult['type'];
  score: number;
  matches: number;
  alwaysRelevant: boolean;
  reason?: string;
}

export interface RelevanceResult {
  endpoint: string;
  endpointPath: string;
  resources: string[];
  changelog: RelevanceEntry[];
  status: RelevanceEntry[];
  openapi: RelevanceEntry[];
  relevantDocs: RelevanceEntry[];
  filteredOut: number;
  totalBefore: number;
}

export function extractResources(endpointUrl: string): { path: string; resources: string[] } {
  let urlPath: string;
  try {
    const parsed = new URL(endpointUrl.startsWith('http') ? endpointUrl : `https://${endpointUrl}`);
    urlPath = parsed.pathname;
  } catch {
    urlPath = endpointUrl.includes('/') ? '/' + endpointUrl.split('/').slice(1).join('/') : endpointUrl;
  }

  const stripped = urlPath.replace(/^\/(v\d+|api)\//i, '/').replace(/^\//, '');
  const segments = stripped.split('/').filter(Boolean);
  const resources: string[] = [];

  for (const seg of segments) {
    const lower = seg.toLowerCase();
    resources.push(lower);
    if (lower.endsWith('s') && lower.length > 2) {
      if (lower.endsWith('ies')) resources.push(lower.slice(0, -3) + 'y');
      else if (lower.endsWith('ses') || lower.endsWith('xes') || lower.endsWith('zes')) resources.push(lower.slice(0, -2));
      else resources.push(lower.slice(0, -1));
    } else {
      if (lower.endsWith('y') && !['ay', 'ey', 'oy', 'uy'].some((e) => lower.endsWith(e))) resources.push(lower.slice(0, -1) + 'ies');
      else if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z')) resources.push(lower + 'es');
      else resources.push(lower + 's');
    }
    if (lower.includes('-')) {
      for (const p of lower.split('-')) {
        if (p.length > 2) { resources.push(p); resources.push(p.endsWith('s') && p.length > 2 ? p.slice(0, -1) : p + 's'); }
      }
    }
  }
  return { path: urlPath, resources: [...new Set(resources)] };
}

function urlPathScore(discoveredUrl: string, endpointPath: string, resources: string[]): number {
  let score = 0;
  let urlPath: string;
  try { urlPath = new URL(discoveredUrl).pathname.toLowerCase(); } catch { urlPath = discoveredUrl.toLowerCase(); }
  const fullUrl = discoveredUrl.toLowerCase();
  const endpointSegments = endpointPath.replace(/^\//, '').toLowerCase();
  if (urlPath.includes('/' + endpointSegments) || urlPath.includes(endpointSegments)) score += 50;
  for (const resource of resources) {
    if (urlPath.includes('/' + resource) || urlPath.includes(resource + '/') || urlPath.endsWith('/' + resource) || fullUrl.includes('/' + resource)) { score += 40; break; }
  }
  return score;
}

function contentScore(text: string, endpointPath: string, resources: string[]): { score: number; matches: number } {
  let score = 0;
  let matches = 0;
  const lowerText = text.toLowerCase();
  const endpointLower = endpointPath.toLowerCase();
  const endpointCount = countOccurrences(lowerText, endpointLower);
  if (endpointCount > 0) { score += Math.min(endpointCount * 30, 90); matches += endpointCount; }
  for (const resource of resources) {
    const resourceCount = countOccurrences(lowerText, resource);
    if (resourceCount > 0) { score += Math.min(resourceCount * 10, 50); matches += resourceCount; break; }
  }
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const methodCount = countOccurrences(lowerText, `${method.toLowerCase()} ${endpointLower}`);
    if (methodCount > 0) { score += methodCount * 40; matches += methodCount; }
  }
  const codePatterns = ['```', 'curl ', 'fetch(', 'requests.', 'axios.', 'http.'];
  if (codePatterns.some((p) => lowerText.includes(p)) && endpointCount > 0) score += 20;
  return { score, matches };
}

function countOccurrences(text: string, search: string): number {
  if (!search) return 0;
  let count = 0, pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) { count++; pos += search.length; }
  return count;
}

export async function filterByRelevance(
  endpointUrl: string,
  domainResult: DomainResult,
): Promise<RelevanceResult> {
  const { path: endpointPath, resources } = extractResources(endpointUrl);
  const totalBefore = [...domainResult.discovered.docs, ...domainResult.discovered.changelog, ...domainResult.discovered.status, ...domainResult.discovered.openapi].length;

  const changelog: RelevanceEntry[] = domainResult.discovered.changelog.map((r) => ({ url: r.url, type: r.type, score: 100, matches: 0, alwaysRelevant: true, reason: 'changelog' }));
  const status: RelevanceEntry[] = domainResult.discovered.status.map((r) => ({ url: r.url, type: r.type, score: 100, matches: 0, alwaysRelevant: true, reason: 'status page' }));
  const openapi: RelevanceEntry[] = domainResult.discovered.openapi.map((r) => ({ url: r.url, type: r.type, score: 100, matches: 0, alwaysRelevant: true, reason: 'openapi spec' }));

  const docEntries: RelevanceEntry[] = [];
  const docsToScore = domainResult.discovered.docs;
  const pathScored = docsToScore.map((r) => ({ result: r, pathScore: urlPathScore(r.url, endpointPath, resources) }));
  const sorted = pathScored.sort((a, b) => b.pathScore - a.pathScore);
  const withPathScore = sorted.filter((s) => s.pathScore > 0);
  const apiRefPages = sorted.filter((s) => s.pathScore === 0).filter((s) => { const l = s.result.url.toLowerCase(); return l.includes('/api') || l.includes('/reference'); }).slice(0, 5);
  const needsFetch = [...withPathScore, ...apiRefPages].slice(0, 20);

  for (const item of needsFetch) {
    let totalScore = item.pathScore;
    let totalMatches = 0;
    const fetched = await safeGet(item.result.url);
    if (fetched?.ok && fetched.text) {
      const { score: cScore, matches } = contentScore(fetched.text, endpointPath, resources);
      totalScore += cScore;
      totalMatches = matches;
    }
    docEntries.push({ url: item.result.url, type: item.result.type, score: totalScore, matches: totalMatches, alwaysRelevant: false });
  }

  for (const item of pathScored) {
    if (!needsFetch.includes(item) && item.pathScore > 0) {
      docEntries.push({ url: item.result.url, type: item.result.type, score: item.pathScore, matches: 0, alwaysRelevant: false });
    }
  }

  const relevantDocs = docEntries.sort((a, b) => b.score - a.score).filter((e) => e.score > 20).slice(0, 3);
  const alwaysRelevantCount = changelog.length + status.length + openapi.length;
  const filteredOut = totalBefore - alwaysRelevantCount - relevantDocs.length;

  return { endpoint: endpointUrl, endpointPath, resources, changelog, status, openapi, relevantDocs, filteredOut: Math.max(0, filteredOut), totalBefore };
}
