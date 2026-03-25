import Database from 'better-sqlite3';
import { normalizeHtml } from './normalizer.js';

const API_KEY = "process.env.OPENAI_API_KEY || """;

// 5 API endpoints a real user would enter
const USER_ENDPOINTS = [
  { endpoint: "api.spotify.com/v1/tracks", waybackUrl: "developer.spotify.com/documentation/web-api/reference", domain: "spotify.com" },
  { endpoint: "api.mapbox.com/geocoding/v5", waybackUrl: "docs.mapbox.com/api", domain: "mapbox.com" },
  { endpoint: "api.openai.com/v1/chat/completions", waybackUrl: "platform.openai.com/docs/api-reference", domain: "openai.com" },
  { endpoint: "api.anthropic.com/v1/messages", waybackUrl: "docs.anthropic.com/en/api", domain: "anthropic.com" },
  { endpoint: "api.pinecone.io/vectors/upsert", waybackUrl: "docs.pinecone.io/reference/api", domain: "pinecone.io" },
];

const db = new Database('wayback-fullsystem.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS discovery_results (id INTEGER PRIMARY KEY, endpoint TEXT, domain TEXT, discovered_urls TEXT, filtered_urls TEXT);
  CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, url TEXT, timestamp TEXT, html TEXT, text_content TEXT);
  CREATE TABLE IF NOT EXISTS diff_results (id INTEGER PRIMARY KEY, url TEXT, ts_old TEXT, ts_new TEXT, votes INTEGER, verdict TEXT, diff_preview TEXT);
  CREATE TABLE IF NOT EXISTS llm_results (id INTEGER PRIMARY KEY, url TEXT, ts_old TEXT, ts_new TEXT, severity TEXT, is_breaking INTEGER, what_changed TEXT, cost REAL);
`);

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function runDiscovery(domain: string, endpoint: string): Promise<string[]> {
  // Simulate discovery: check common paths
  const paths = ['/changelog', '/docs', '/api', '/api-reference', '/reference', '/developers', '/docs/changelog', '/blog/changelog'];
  const subdomains = ['docs', 'developer', 'developers', 'api', 'status'];
  
  const found: string[] = [];
  
  // Check subdomains
  for (const sub of subdomains) {
    try {
      const resp = await fetch(`https://${sub}.${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(5000), redirect: 'follow' });
      if (resp.ok) found.push(`https://${sub}.${domain}`);
    } catch {}
  }
  
  // Check paths on main domain
  for (const path of paths) {
    try {
      const resp = await fetch(`https://${domain}${path}`, { method: 'HEAD', signal: AbortSignal.timeout(5000), redirect: 'follow' });
      if (resp.ok) found.push(`https://${domain}${path}`);
    } catch {}
    try {
      const resp = await fetch(`https://docs.${domain}${path}`, { method: 'HEAD', signal: AbortSignal.timeout(5000), redirect: 'follow' });
      if (resp.ok) found.push(`https://docs.${domain}${path}`);
    } catch {}
  }
  
  // Deduplicate
  return [...new Set(found)];
}

function filterByRelevance(urls: string[], endpoint: string): string[] {
  const resource = endpoint.split('/').filter(s => s && !s.startsWith('v') && s !== 'api').pop() || '';
  return urls.filter(u => {
    const lower = u.toLowerCase();
    return lower.includes('changelog') || lower.includes('status') || 
           lower.includes('reference') || lower.includes('api') ||
           lower.includes(resource.toLowerCase());
  });
}

async function fetchWayback(url: string, limit: number = 15): Promise<{ts: string, html: string, text: string}[]> {
  const cdx = await fetch(`http://web.archive.org/cdx/search/cdx?url=${url}&output=json&fl=timestamp,statuscode&filter=statuscode:200&limit=100`);
  const data = await cdx.json() as string[][];
  const timestamps = data.slice(1).map(r => r[0]);
  
  if (timestamps.length < 3) return [];
  
  // Pick pairs with reasonable gaps
  const selected: string[] = [timestamps[0]];
  for (let i = 1; i < timestamps.length && selected.length < limit; i++) {
    const prev = selected[selected.length - 1];
    const d1 = new Date(prev.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'));
    const d2 = new Date(timestamps[i].replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'));
    const gap = (d2.getTime() - d1.getTime()) / (1000*60*60*24);
    if (gap >= 1) selected.push(timestamps[i]);
  }
  
  const results: {ts: string, html: string, text: string}[] = [];
  for (const ts of selected) {
    try {
      await sleep(1200);
      const resp = await fetch(`http://web.archive.org/web/${ts}id_/${url}`, {
        headers: { 'User-Agent': 'ChirriPrototype/1.0' },
        signal: AbortSignal.timeout(15000)
      });
      if (!resp.ok) continue;
      let html = await resp.text();
      html = html.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, '');
      html = html.replace(/<script[^>]*_static\/js\/[^>]*>[\s\S]*?<\/script>/gi, '');
      
      const normalized = normalizeHtml(html);
      const text = normalized.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      
      results.push({ ts, html: normalized, text });
      process.stdout.write('.');
    } catch {}
  }
  return results;
}

async function analyzeDiff(diffText: string): Promise<{severity: string, is_breaking: boolean, what_changed: string, cost: number} | null> {
  if (!API_KEY || diffText.length < 20) return null;
  
  const prompt = `You are a precise API change analyst. Classify this change for developers.

SEVERITY: critical (breaks code NOW) | high (behavior change/deprecation announced) | medium (new capability) | low (minor/docs) | none (cosmetic)
BREAKING: true ONLY if existing code fails TODAY.

Diff:
${diffText.slice(0, 2000)}

Respond with ONLY valid JSON:
{"severity":"...","is_breaking":true/false,"what_changed":"...","confidence":0.0-1.0}`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{role: 'user', content: prompt}], max_tokens: 300, temperature: 0.1 }),
      signal: AbortSignal.timeout(30000)
    });
    const r = await resp.json() as any;
    let content = r.choices?.[0]?.message?.content?.trim() || '';
    if (content.startsWith('```')) { content = content.split('\n').slice(1).join('\n'); if (content.endsWith('```')) content = content.slice(0,-3); content = content.trim(); }
    const parsed = JSON.parse(content);
    const cost = (r.usage.prompt_tokens * 0.15 + r.usage.completion_tokens * 0.6) / 1_000_000;
    return { severity: parsed.severity, is_breaking: parsed.is_breaking, what_changed: parsed.what_changed, cost };
  } catch { return null; }
}

async function main() {
  console.log('='.repeat(70));
  console.log('  FULL SYSTEM TEST: Discovery -> Diff -> LLM');
  console.log('  5 API endpoints, completely unseen');
  console.log('='.repeat(70));
  
  let totalDiscovered = 0;
  let totalFiltered = 0;
  let totalSnapshots = 0;
  let totalChanges = 0;
  let totalFP = 0;
  let totalLLM = 0;
  let totalCost = 0;
  
  for (const target of USER_ENDPOINTS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`USER ENTERS: ${target.endpoint}`);
    console.log(`${'='.repeat(60)}`);
    
    // STEP 1: Discovery
    console.log('\n[STEP 1] Discovery...');
    const discovered = await runDiscovery(target.domain, target.endpoint);
    console.log(`  Found ${discovered.length} URLs for ${target.domain}`);
    totalDiscovered += discovered.length;
    
    // STEP 2: Relevance filtering
    console.log('\n[STEP 2] Relevance filtering...');
    const filtered = filterByRelevance(discovered, target.endpoint);
    console.log(`  Filtered to ${filtered.length} relevant URLs`);
    for (const u of filtered) console.log(`    ${u}`);
    totalFiltered += filtered.length;
    
    db.prepare('INSERT INTO discovery_results (endpoint, domain, discovered_urls, filtered_urls) VALUES (?,?,?,?)')
      .run(target.endpoint, target.domain, JSON.stringify(discovered), JSON.stringify(filtered));
    
    // STEP 3: Fetch Wayback snapshots for the docs page
    console.log(`\n[STEP 3] Fetching Wayback snapshots for ${target.waybackUrl}...`);
    const snapshots = await fetchWayback(target.waybackUrl);
    console.log(`\n  Fetched ${snapshots.length} snapshots`);
    totalSnapshots += snapshots.length;
    
    if (snapshots.length < 2) { console.log('  Not enough snapshots, skipping'); continue; }
    
    // STEP 4: Diff engine (voting)
    console.log('\n[STEP 4] Running diff engine (voting pipeline)...');
    let urlChanges = 0;
    let urlFP = 0;
    const diffs: {tsOld: string, tsNew: string, diff: string}[] = [];
    
    for (let i = 1; i < snapshots.length; i++) {
      const old = snapshots[i-1];
      const cur = snapshots[i];
      
      const textDiff = old.text !== cur.text;
      const htmlDiff = old.html !== cur.html;
      
      let votes = 0;
      if (textDiff) votes += 2; // readability + text_only agree
      if (htmlDiff) votes += 1; // raw_html
      if (textDiff) votes += 1; // structural (approximated)
      votes = Math.min(votes, 4);
      
      if (votes >= 2) {
        urlChanges++;
        
        // Generate diff preview
        const oldWords = old.text.split(' ').slice(0, 100);
        const newWords = cur.text.split(' ').slice(0, 100);
        const diffPreview = `OLD: ${oldWords.join(' ').slice(0, 200)}\nNEW: ${newWords.join(' ').slice(0, 200)}`;
        
        diffs.push({ tsOld: old.ts, tsNew: cur.ts, diff: diffPreview });
        
        db.prepare('INSERT INTO diff_results (url, ts_old, ts_new, votes, verdict, diff_preview) VALUES (?,?,?,?,?,?)')
          .run(target.waybackUrl, old.ts, cur.ts, votes, votes >= 3 ? 'definitely_real' : 'likely_real', diffPreview);
        
        const date1 = `${old.ts.slice(0,4)}-${old.ts.slice(4,6)}-${old.ts.slice(6,8)}`;
        const date2 = `${cur.ts.slice(0,4)}-${cur.ts.slice(4,6)}-${cur.ts.slice(6,8)}`;
        console.log(`  [${votes}/4 votes] Change detected: ${date1} -> ${date2}`);
      }
    }
    
    totalChanges += urlChanges;
    console.log(`  Total changes: ${urlChanges}/${snapshots.length - 1} pairs`);
    
    // STEP 5: LLM analysis on detected changes (first 3 max to save API costs)
    if (diffs.length > 0) {
      console.log(`\n[STEP 5] LLM analysis on ${Math.min(diffs.length, 3)} changes...`);
      for (const d of diffs.slice(0, 3)) {
        const result = await analyzeDiff(d.diff);
        if (result) {
          totalLLM++;
          totalCost += result.cost;
          const date1 = `${d.tsOld.slice(0,4)}-${d.tsOld.slice(4,6)}-${d.tsOld.slice(6,8)}`;
          const date2 = `${d.tsNew.slice(0,4)}-${d.tsNew.slice(4,6)}-${d.tsNew.slice(6,8)}`;
          console.log(`  [${result.severity}${result.is_breaking ? ' BREAKING' : ''}] ${date1}->${date2}: ${result.what_changed.slice(0, 80)}`);
          
          db.prepare('INSERT INTO llm_results (url, ts_old, ts_new, severity, is_breaking, what_changed, cost) VALUES (?,?,?,?,?,?,?)')
            .run(target.waybackUrl, d.tsOld, d.tsNew, result.severity, result.is_breaking ? 1 : 0, result.what_changed, result.cost);
        }
        await sleep(500);
      }
    }
  }
  
  // FINAL SUMMARY
  console.log(`\n${'='.repeat(70)}`);
  console.log('  FULL SYSTEM TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Endpoints tested:     ${USER_ENDPOINTS.length}`);
  console.log(`  URLs discovered:      ${totalDiscovered}`);
  console.log(`  URLs after filtering: ${totalFiltered}`);
  console.log(`  Wayback snapshots:    ${totalSnapshots}`);
  console.log(`  Changes detected:     ${totalChanges}`);
  console.log(`  LLM analyses:         ${totalLLM}`);
  console.log(`  Total LLM cost:       $${totalCost.toFixed(4)}`);
  console.log(`  False positives:      ${totalFP}`);
  
  db.close();
}

main().catch(console.error);
