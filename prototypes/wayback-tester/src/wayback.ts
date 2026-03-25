/**
 * Wayback Machine CDX API + snapshot fetching
 */
import fetch from 'node-fetch';

const CDX_API = 'http://web.archive.org/cdx/search/cdx';
const WAYBACK_URL = 'http://web.archive.org/web';

/** Sleep helper */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch CDX index for a URL - returns all available timestamps with status 200
 */
export async function fetchCdxIndex(url: string): Promise<string[]> {
  const params = new URLSearchParams({
    url,
    output: 'json',
    fl: 'timestamp,statuscode',
    'filter': 'statuscode:200',
  });

  const cdxUrl = `${CDX_API}?${params}`;
  console.log(`  Fetching CDX index for ${url}...`);

  const resp = await fetch(cdxUrl, {
    headers: { 'User-Agent': 'ChirriBot/1.0 (API docs research)' },
  });

  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get('Retry-After') || '30', 10);
    console.log(`  Rate limited. Waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return fetchCdxIndex(url); // retry
  }

  if (!resp.ok) {
    throw new Error(`CDX API error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as string[][];
  if (!data || data.length < 2) return [];

  // First row is header [timestamp, statuscode], rest are data
  return data.slice(1).map(row => row[0]);
}

/**
 * Select pairs from timestamps - pick pairs 2-4 weeks apart, aim for 10-20 pairs
 */
export function selectPairs(timestamps: string[], maxPairs = 20): [string, string][] {
  if (timestamps.length < 2) return [];

  // Parse timestamps to dates for comparison
  const parsed = timestamps.map(ts => ({
    ts,
    date: new Date(
      parseInt(ts.slice(0, 4)),
      parseInt(ts.slice(4, 6)) - 1,
      parseInt(ts.slice(6, 8)),
      parseInt(ts.slice(8, 10) || '0'),
      parseInt(ts.slice(10, 12) || '0'),
      parseInt(ts.slice(12, 14) || '0')
    ),
  })).sort((a, b) => a.date.getTime() - b.date.getTime());

  const pairs: [string, string][] = [];
  const MIN_GAP_DAYS = 14; // 2 weeks minimum
  const MAX_GAP_DAYS = 60; // ~2 months max

  let i = 0;
  while (i < parsed.length - 1 && pairs.length < maxPairs) {
    const current = parsed[i];

    // Find next snapshot that's at least MIN_GAP_DAYS away
    let j = i + 1;
    while (j < parsed.length) {
      const gap = (parsed[j].date.getTime() - current.date.getTime()) / (1000 * 60 * 60 * 24);
      if (gap >= MIN_GAP_DAYS) break;
      j++;
    }

    if (j < parsed.length) {
      const gap = (parsed[j].date.getTime() - current.date.getTime()) / (1000 * 60 * 60 * 24);
      if (gap <= MAX_GAP_DAYS) {
        pairs.push([current.ts, parsed[j].ts]);
      }
      i = j;
    } else {
      i++;
    }
  }

  return pairs;
}

/**
 * Fetch a Wayback Machine snapshot and strip the toolbar
 */
export async function fetchSnapshot(timestamp: string, url: string): Promise<string> {
  const snapshotUrl = `${WAYBACK_URL}/${timestamp}id_/${url}`;

  const resp = await fetch(snapshotUrl, {
    headers: { 'User-Agent': 'ChirriBot/1.0 (API docs research)' },
    redirect: 'follow',
  });

  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get('Retry-After') || '30', 10);
    console.log(`  Rate limited. Waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return fetchSnapshot(timestamp, url); // retry
  }

  if (!resp.ok) {
    throw new Error(`Wayback fetch error: ${resp.status} for ${snapshotUrl}`);
  }

  let html = await resp.text();
  return stripWaybackToolbar(html);
}

/**
 * Strip Wayback Machine toolbar and injected scripts
 */
function stripWaybackToolbar(html: string): string {
  // Remove the toolbar insert block
  html = html.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, '');

  // Remove Wayback Machine's script injections
  html = html.replace(/<script[^>]*src=["'][^"']*\/_static\/[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*src=["'][^"']*web\.archive\.org[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove the wm-ipp-* elements
  html = html.replace(/<div[^>]*id=["']wm-ipp[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');

  // Remove wayback_css link
  html = html.replace(/<link[^>]*href=["'][^"']*\/_static\/[^"']*["'][^>]*\/?>/gi, '');

  // Remove FILE ARCHIVED ON comment blocks
  html = html.replace(/<!--\s*FILE ARCHIVED ON[\s\S]*?-->/gi, '');

  // Remove playback.archive.org references
  html = html.replace(/<script[^>]*>[\s\S]*?playback\.archive\.org[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*>[\s\S]*?__wm\.init[\s\S]*?<\/script>/gi, '');

  // Remove /web/ URL rewrites in href/src (restore original URLs)
  html = html.replace(/(?:https?:)?\/\/web\.archive\.org\/web\/\d+(?:id_)?\/(?:https?:\/\/)?/gi, '');

  return html;
}
