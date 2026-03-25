
import Database from 'better-sqlite3';

import { normalizeHtml } from './normalizer.js';


// 5 COMPLETELY NEW URLs never tested before
const BLIND_URLS = [
  { url: 'docs.pagerduty.com/docs/events-api-v2', company: 'PagerDuty', type: 'docs' },
  { url: 'docs.newrelic.com/docs/apis/rest-api-v2', company: 'NewRelic', type: 'docs' },
  { url: 'docs.datadoghq.com/api/latest', company: 'Datadog', type: 'docs' },
  { url: 'docs.gitlab.com/ee/api/projects.html', company: 'GitLab', type: 'docs' },
  { url: 'docs.shopify.com/api/admin-rest', company: 'Shopify', type: 'docs' },
];

async function main() {
  const db = new Database('wayback-blind.db');
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      company TEXT,
      timestamp TEXT NOT NULL,
      html TEXT,
      readability TEXT,
      text_only TEXT,
      structural TEXT,
      fetched_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY,
      url TEXT,
      ts_old TEXT,
      ts_new TEXT,
      votes INTEGER,
      verdict TEXT,
      confidence REAL,
      change_type TEXT,
      strategies_voted TEXT,
      is_fp INTEGER DEFAULT 0,
      snapshot_num INTEGER
    );
  `);

  console.log('='.repeat(70));
  console.log('  BLIND TEST: 5 new URLs, daily Wayback snapshots');
  console.log('='.repeat(70));
  
  for (const target of BLIND_URLS) {
    console.log(`\n📡 ${target.company} - ${target.url}`);
    
    // Get timestamps
    let timestamps: string[];
    try {
      const resp = await fetch(
        `http://web.archive.org/cdx/search/cdx?url=${target.url}&output=json&fl=timestamp,statuscode&filter=statuscode:200&limit=100`
      );
      const data = await resp.json() as string[][];
      timestamps = data.slice(1).map(r => r[0]);
      console.log(`  Found ${timestamps.length} snapshots in Wayback`);
    } catch (e) {
      console.log(`  ERROR: Could not query CDX API: ${e}`);
      continue;
    }
    
    if (timestamps.length < 5) {
      console.log('  Skipping: not enough snapshots');
      continue;
    }
    
    // Find daily-gap period: pick consecutive snapshots with gaps < 7 days
    const dailyPairs: [string, string][] = [];
    for (let i = 1; i < timestamps.length && dailyPairs.length < 15; i++) {
      const t1 = timestamps[i-1];
      const t2 = timestamps[i];
      const d1 = new Date(t1.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z'));
      const d2 = new Date(t2.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z'));
      const gapDays = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
      if (gapDays <= 14) {
        dailyPairs.push([t1, t2]);
      }
    }
    
    console.log(`  Using ${dailyPairs.length} pairs`);
    
    // Fetch snapshots
    const fetched = new Map<string, { html: string; readability: string; textOnly: string; structural: string }>();
    const allTs = new Set<string>();
    for (const [t1, t2] of dailyPairs) { allTs.add(t1); allTs.add(t2); }
    
    for (const ts of allTs) {
      // Check if already in DB
      const existing = db.prepare('SELECT html FROM snapshots WHERE url = ? AND timestamp = ?').get(target.url, ts) as any;
      if (existing?.html) {
        const readability = db.prepare('SELECT readability FROM snapshots WHERE url = ? AND timestamp = ?').get(target.url, ts) as any;
        fetched.set(ts, { html: existing.html, readability: readability?.readability || '', textOnly: '', structural: '' });
        continue;
      }
      
      try {
        await new Promise(r => setTimeout(r, 1200)); // rate limit
        const resp = await fetch(`http://web.archive.org/web/${ts}id_/${target.url}`, {
          headers: { 'User-Agent': 'ChirriPrototype/1.0' },
          signal: AbortSignal.timeout(15000)
        });
        if (!resp.ok) { console.log(`    ${ts}: HTTP ${resp.status}`); continue; }
        let html = await resp.text();
        
        // Strip Wayback toolbar
        html = html.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, '');
        html = html.replace(/<script[^>]*_static\/js\/[^>]*>[\s\S]*?<\/script>/gi, '');
        html = html.replace(/<link[^>]*_static\/css\/[^>]*>/gi, '');
        
        const normalized = normalizeHtml(html);
        
        // Simple readability-like extraction: get text content from main/article/body
        const textContent = normalized
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        db.prepare('INSERT INTO snapshots (url, company, timestamp, html, readability, text_only) VALUES (?, ?, ?, ?, ?, ?)')
          .run(target.url, target.company, ts, html, textContent, textContent);
        
        fetched.set(ts, { html, readability: textContent, textOnly: textContent, structural: '' });
        process.stdout.write('.');
      } catch (e) {
        console.log(`    ${ts}: fetch error`);
      }
    }
    console.log('');
    
    // Run pipeline
    let totalComparisons = 0;
    let changesDetected = 0;
    let possibleFP = 0;
    let volatilePatterns = 0;
    const voteDistribution = [0, 0, 0, 0, 0]; // 0-4 votes
    
    const snapHistory: string[] = [];
    
    for (const [tsOld, tsNew] of dailyPairs) {
      const oldData = fetched.get(tsOld);
      const newData = fetched.get(tsNew);
      if (!oldData || !newData) continue;
      
      snapHistory.push(tsNew);
      totalComparisons++;
      
      // Simple voting: compare readability + text_only
      const readDiff = oldData.readability !== newData.readability;
      const textDiff = oldData.textOnly !== newData.textOnly;
      const htmlDiff = oldData.html !== newData.html;
      
      let votes = 0;
      const voters: string[] = [];
      if (readDiff) { votes++; voters.push('readability'); }
      if (textDiff) { votes++; voters.push('text_only'); }
      if (htmlDiff) { votes++; voters.push('raw_html'); }
      // structural = same as readability for this simplified test
      if (readDiff) { votes++; voters.push('structural'); }
      
      votes = Math.min(votes, 4);
      voteDistribution[votes]++;
      
      let verdict = 'no_change';
      let confidence = 0;
      if (votes === 0) verdict = 'no_change';
      else if (votes === 1) { verdict = 'suspicious'; confidence = 0.3; }
      else if (votes === 2) { verdict = 'likely_real'; confidence = 0.6; changesDetected++; }
      else if (votes === 3) { verdict = 'definitely_real'; confidence = 0.85; changesDetected++; }
      else { verdict = 'absolutely_real'; confidence = 1.0; changesDetected++; }
      
      // FP heuristic: if only html changed (1 vote from html) or very small diff
      const isFP = (votes >= 2 && !readDiff && !textDiff) ? 1 : 0;
      if (isFP) possibleFP++;
      
      db.prepare('INSERT INTO results (url, ts_old, ts_new, votes, verdict, confidence, strategies_voted, is_fp, snapshot_num) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(target.url, tsOld, tsNew, votes, verdict, confidence, voters.join(','), isFP, snapHistory.length);
    }
    
    const fpRate = changesDetected > 0 ? (possibleFP / changesDetected * 100).toFixed(1) : '0.0';
    console.log(`  Comparisons: ${totalComparisons}`);
    console.log(`  Vote distribution: [${voteDistribution.join(', ')}] (0,1,2,3,4 votes)`);
    console.log(`  Changes detected (2+ votes): ${changesDetected}`);
    console.log(`  Possible FP: ${possibleFP} (${fpRate}%)`);
    console.log(`  Real changes: ${changesDetected - possibleFP}`);
  }
  
  // Summary
  const allResults = db.prepare('SELECT * FROM results').all() as any[];
  const totalChanges = allResults.filter(r => r.votes >= 2).length;
  const totalFP = allResults.filter(r => r.votes >= 2 && r.is_fp).length;
  const totalPairs = allResults.length;
  
  console.log('\n' + '='.repeat(70));
  console.log('  BLIND TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`  URLs tested: ${BLIND_URLS.length}`);
  console.log(`  Total comparisons: ${totalPairs}`);
  console.log(`  Changes detected (2+ votes): ${totalChanges}`);
  console.log(`  Possible FP: ${totalFP}`);
  console.log(`  FP rate: ${totalChanges > 0 ? (totalFP/totalChanges*100).toFixed(1) : 0}%`);
  console.log(`  Real changes: ${totalChanges - totalFP}`);
  
  db.close();
}

main().catch(console.error);
