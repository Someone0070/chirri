#!/usr/bin/env node

import { discoverDomain } from './orchestrator.js';
import { printReport, printFilteredReport, toJson } from './report.js';
import { DomainResult } from './types.js';
import { filterByRelevance } from './methods/relevance.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function usage() {
  console.log(`
Chirri Discovery Service — Find docs, changelogs, status pages & OpenAPI specs

Usage:
  chirri-discovery <domain> [domain2] ...     Discover for specific domains
  chirri-discovery --file <domains.json>      Discover from JSON file (array of strings)
  chirri-discovery --test                     Run against 5 test domains
  chirri-discovery --test50                   Run against 50 test domains

Options:
  --endpoint <url>  Filter results by relevance to this endpoint
  --json            Output results as JSON
  --out <file>      Write JSON results to file
  --concurrency <n> Max concurrent domains (default: 3)
  `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    usage();
    process.exit(0);
  }

  let domains: string[] = [];
  let outputJson = args.includes('--json');
  let outFile: string | undefined;
  let concurrency = 3;
  let endpoint: string | undefined;

  // Parse args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') continue;
    if (arg === '--out' && args[i + 1]) {
      outFile = args[++i];
      continue;
    }
    if (arg === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[++i]) || 3;
      continue;
    }
    if (arg === '--endpoint' && args[i + 1]) {
      endpoint = args[++i];
      continue;
    }
    if (arg === '--file' && args[i + 1]) {
      const filePath = resolve(args[++i]);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      domains.push(...(Array.isArray(data) ? data : Object.keys(data)));
      continue;
    }
    if (arg === '--test') {
      domains = ['stripe.com', 'github.com', 'twilio.com', 'vercel.com', 'supabase.com'];
      continue;
    }
    if (arg === '--test50') {
      const domainsFile = resolve(__dirname, '..', 'domains.json');
      if (existsSync(domainsFile)) {
        domains = JSON.parse(readFileSync(domainsFile, 'utf-8'));
      } else {
        console.error('domains.json not found. Run with specific domains or create domains.json');
        process.exit(1);
      }
      continue;
    }
    // Treat as domain
    domains.push(arg);
  }

  if (domains.length === 0) {
    console.error('No domains specified');
    usage();
    process.exit(1);
  }

  console.log(`🔍 Discovering ${domains.length} domain(s)...\n`);

  const results: DomainResult[] = [];

  // Process domains with concurrency limit
  for (let i = 0; i < domains.length; i += concurrency) {
    const batch = domains.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (domain) => {
        console.log(`\n▶ ${domain}`);
        try {
          return await discoverDomain(domain);
        } catch (err: any) {
          console.error(`  ❌ Failed: ${err.message}`);
          return {
            domain,
            discovered: { docs: [], changelog: [], status: [], openapi: [] },
            platforms: [],
            methods_tried: 9,
            methods_succeeded: 0,
            total_discovered: 0,
            duration_ms: 0,
            errors: [err.message],
          } as DomainResult;
        }
      })
    );
    results.push(...batchResults);
  }

  if (endpoint) {
    // Apply relevance filtering
    for (const result of results) {
      console.log(`\n🔍 Filtering results for endpoint: ${endpoint}`);
      const filtered = await filterByRelevance(endpoint, result);
      if (outputJson) {
        console.log(JSON.stringify(filtered, null, 2));
      } else {
        printFilteredReport(result.domain, filtered);
      }
    }
  } else if (outputJson) {
    console.log(toJson(results));
  } else {
    printReport(results);
  }

  if (outFile) {
    writeFileSync(outFile, toJson(results));
    console.log(`\n💾 Results saved to ${outFile}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
