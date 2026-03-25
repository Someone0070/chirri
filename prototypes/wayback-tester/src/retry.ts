/**
 * Retry fetching URLs that failed due to Wayback Machine 503/504 errors
 */
import { fetchCdxIndex, selectPairs, fetchSnapshot, sleep } from './wayback.js';
import { extractReadability, extractTextOnly } from './extractor.js';
import { getDb, closeDb } from './db.js';

const retryUrls = [
  'docs.github.com/en/rest/repos',
  'docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html',
  'cloud.google.com/storage/docs/json_api',
  'www.twilio.com/docs/messaging/api/message-resource',
  'plaid.com/docs/api/transactions',
  'docs.supersaas.com',
  'docs.brieflyai.com',
];

async function main() {
  const db = getDb();
  const insertCdx = db.prepare('INSERT OR IGNORE INTO cdx_index (url, timestamp, status_code) VALUES (?, ?, ?)');
  const insertSnap = db.prepare('INSERT OR IGNORE INTO snapshots (url, timestamp, html, readability_text, text_only) VALUES (?, ?, ?, ?, ?)');
  const checkSnap = db.prepare('SELECT 1 FROM snapshots WHERE url = ? AND timestamp = ? AND html IS NOT NULL');

  for (const url of retryUrls) {
    console.log('Retrying CDX: ' + url);
    try {
      await sleep(2000);
      const timestamps = await fetchCdxIndex(url);
      console.log('  Found ' + timestamps.length + ' snapshots');
      if (timestamps.length === 0) continue;
      for (const ts of timestamps) insertCdx.run(url, ts, '200');
      const pairs = selectPairs(timestamps, 15);
      console.log('  Selected ' + pairs.length + ' pairs');
      const uniqueTs = new Set<string>();
      for (const [a, b] of pairs) { uniqueTs.add(a); uniqueTs.add(b); }
      let fetched = 0;
      for (const ts of uniqueTs) {
        if (checkSnap.get(url, ts)) { fetched++; continue; }
        try {
          console.log('  Fetching ' + ts + '...');
          const html = await fetchSnapshot(ts, url);
          const readText = extractReadability(html, url);
          const textOnly = extractTextOnly(html);
          insertSnap.run(url, ts, html, readText, textOnly);
          fetched++;
          await sleep(1200);
        } catch (e: any) { console.log('  Error: ' + e.message); await sleep(2000); }
      }
      console.log('  Done: ' + fetched + '/' + uniqueTs.size);
    } catch (e: any) { console.log('  CDX error: ' + e.message); }
  }
  closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
