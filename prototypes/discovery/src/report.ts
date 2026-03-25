import { DomainResult, DiscoveryResult } from './types.js';
import { RelevanceResult } from './methods/relevance.js';

function formatMethods(d: DiscoveryResult): string {
  if (d.methods && d.methods.length > 1) {
    return `found via: ${d.methods.join(', ')}`;
  }
  return d.method;
}

export function printReport(results: DomainResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('CHIRRI DISCOVERY SERVICE — RESULTS REPORT');
  console.log('='.repeat(80));

  for (const r of results) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📡 ${r.domain}`);
    if (r.total_raw && r.total_raw !== r.total_discovered) {
      console.log(`   Methods: ${r.methods_succeeded}/${r.methods_tried} succeeded | ${r.total_raw} URLs → ${r.total_discovered} unique | ${r.duration_ms}ms`);
    } else {
      console.log(`   Methods: ${r.methods_succeeded}/${r.methods_tried} succeeded | ${r.total_discovered} URLs found | ${r.duration_ms}ms`);
    }

    if (r.platforms.length > 0) {
      console.log(`   Platforms: ${r.platforms.join(', ')}`);
    }

    if (r.discovered.docs.length > 0) {
      console.log(`   📚 Docs (${r.discovered.docs.length}):`);
      for (const d of r.discovered.docs.slice(0, 5)) {
        console.log(`      ${d.url} [${formatMethods(d)}, ${d.confidence}]`);
      }
      if (r.discovered.docs.length > 5) {
        console.log(`      ... and ${r.discovered.docs.length - 5} more`);
      }
    }

    if (r.discovered.changelog.length > 0) {
      console.log(`   📝 Changelog (${r.discovered.changelog.length}):`);
      for (const d of r.discovered.changelog.slice(0, 3)) {
        console.log(`      ${d.url} [${formatMethods(d)}, ${d.confidence}]`);
      }
    }

    if (r.discovered.status.length > 0) {
      console.log(`   🟢 Status (${r.discovered.status.length}):`);
      for (const d of r.discovered.status.slice(0, 3)) {
        console.log(`      ${d.url} [${formatMethods(d)}, ${d.confidence}]`);
      }
    }

    if (r.discovered.openapi.length > 0) {
      console.log(`   🔧 OpenAPI (${r.discovered.openapi.length}):`);
      for (const d of r.discovered.openapi.slice(0, 3)) {
        console.log(`      ${d.url} [${formatMethods(d)}, ${d.confidence}]`);
      }
    }

    if (r.errors.length > 0) {
      console.log(`   ⚠️  Errors: ${r.errors.join('; ')}`);
    }
  }

  // Summary stats
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  const total = results.length;
  const withDocs = results.filter(r => r.discovered.docs.length > 0).length;
  const withChangelog = results.filter(r => r.discovered.changelog.length > 0).length;
  const withStatus = results.filter(r => r.discovered.status.length > 0).length;
  const withOpenapi = results.filter(r => r.discovered.openapi.length > 0).length;
  const avgDuration = Math.round(results.reduce((s, r) => s + r.duration_ms, 0) / total);
  const avgMethods = (results.reduce((s, r) => s + r.methods_succeeded, 0) / total).toFixed(1);
  const totalDiscovered = results.reduce((s, r) => s + r.total_discovered, 0);
  const totalRaw = results.reduce((s, r) => s + (r.total_raw || r.total_discovered), 0);

  console.log(`  Domains tested:        ${total}`);
  console.log(`  Docs found:            ${withDocs}/${total} (${pct(withDocs, total)})`);
  console.log(`  Changelog found:       ${withChangelog}/${total} (${pct(withChangelog, total)})`);
  console.log(`  Status page found:     ${withStatus}/${total} (${pct(withStatus, total)})`);
  console.log(`  OpenAPI spec found:    ${withOpenapi}/${total} (${pct(withOpenapi, total)})`);
  console.log(`  Avg methods succeeded: ${avgMethods}/9`);
  console.log(`  Avg duration:          ${avgDuration}ms`);
  if (totalRaw !== totalDiscovered) {
    console.log(`  Total URLs (raw):      ${totalRaw}`);
    console.log(`  Total URLs (deduped):  ${totalDiscovered}`);
    console.log(`  Dedup reduction:       ${pct(totalRaw - totalDiscovered, totalRaw)} removed`);
  } else {
    console.log(`  Total URLs discovered: ${totalDiscovered}`);
  }
  console.log();
}

export function printFilteredReport(domain: string, r: RelevanceResult) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📡 ${domain} (filtered for ${r.endpointPath})`);
  console.log(`   Resources extracted: ${r.resources.join(', ')}`);

  if (r.changelog.length > 0) {
    console.log(`   📝 Changelog (${r.changelog.length}):`);
    for (const c of r.changelog) {
      console.log(`      ${c.url} [always relevant]`);
    }
  }

  if (r.status.length > 0) {
    console.log(`   🟢 Status (${r.status.length}):`);
    for (const s of r.status) {
      console.log(`      ${s.url} [always relevant]`);
    }
  }

  if (r.openapi.length > 0) {
    console.log(`   🔧 OpenAPI (${r.openapi.length}):`);
    for (const o of r.openapi) {
      console.log(`      ${o.url} [always relevant]`);
    }
  }

  if (r.relevantDocs.length > 0) {
    console.log(`   📚 Relevant Docs (${r.relevantDocs.length}):`);
    for (const d of r.relevantDocs) {
      console.log(`      ${d.url} [score: ${d.score}, matches: ${d.matches}]`);
    }
  } else {
    console.log(`   📚 Relevant Docs: none found with score > 20`);
  }

  console.log(`   ❌ Filtered out: ${r.filteredOut} irrelevant pages`);
  console.log(`   📊 Total before filter: ${r.totalBefore}`);
  console.log();
}

function pct(n: number, total: number): string {
  return `${Math.round(n / total * 100)}%`;
}

export function toJson(results: DomainResult[]): string {
  return JSON.stringify(results, null, 2);
}
