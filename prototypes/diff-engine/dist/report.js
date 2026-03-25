/**
 * Report generation - output comparison results
 */
/**
 * Generate a text report from URL results
 */
export function generateTextReport(report) {
    const lines = [];
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('  CHIRRI DIFF ENGINE - Snapshot Comparison Report');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`  Timestamp: ${report.timestamp}`);
    lines.push(`  Total URLs: ${report.totalUrls}`);
    lines.push(`  Successfully fetched: ${report.fetchedUrls}`);
    lines.push(`  Errors: ${report.errorUrls}`);
    lines.push(`  URLs with history: ${report.urlsWithHistory}`);
    lines.push(`  URLs with changes detected: ${report.changedUrls}`);
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    // Summary table for URLs with changes
    const changed = report.results.filter(r => r.diffs.some(d => d.changed));
    if (changed.length > 0) {
        lines.push('📊 CHANGES DETECTED:');
        lines.push('─────────────────────────────────────────────────────────────');
        lines.push(padRight('URL', 50) +
            padRight('raw_html', 10) +
            padRight('readable', 10) +
            padRight('struct', 10) +
            padRight('text', 10));
        lines.push('─────────────────────────────────────────────────────────────');
        for (const result of changed) {
            const shortUrl = result.url.length > 48 ? result.url.substring(0, 48) + '..' : result.url;
            const diffs = result.diffs;
            const cols = diffs.map(d => {
                if (!d.changed)
                    return '  ·';
                const noise = d.noiseEstimate > 0.5 ? '🔇' : d.noiseEstimate > 0.2 ? '⚠️' : '✅';
                return `${noise}${d.diffSize}`;
            });
            lines.push(padRight(shortUrl, 50) + cols.map(c => padRight(c, 10)).join(''));
        }
        lines.push('');
        lines.push('Legend: ✅ = low noise, ⚠️ = moderate noise, 🔇 = high noise, · = no change');
        lines.push('Numbers = changed lines count');
        lines.push('');
    }
    // Summary for first-time snapshots
    const firstTime = report.results.filter(r => !r.hasHistory && !r.fetchError);
    if (firstTime.length > 0) {
        lines.push(`📸 FIRST SNAPSHOT (${firstTime.length} URLs - no comparison yet):`);
        lines.push('─────────────────────────────────────────────────────────────');
        for (const result of firstTime) {
            const shortUrl = result.url.length > 60 ? result.url.substring(0, 60) + '..' : result.url;
            lines.push(`  ${shortUrl} (${result.fetchMethod}, ${result.fetchTimeMs}ms)`);
        }
        lines.push('');
    }
    // Errors
    const errors = report.results.filter(r => r.fetchError);
    if (errors.length > 0) {
        lines.push(`❌ ERRORS (${errors.length} URLs):`);
        lines.push('─────────────────────────────────────────────────────────────');
        for (const result of errors) {
            const shortUrl = result.url.length > 50 ? result.url.substring(0, 50) + '..' : result.url;
            lines.push(`  ${shortUrl}`);
            lines.push(`    Error: ${result.fetchError}`);
        }
        lines.push('');
    }
    // No changes
    const noChange = report.results.filter(r => r.hasHistory && r.diffs.every(d => !d.changed) && !r.fetchError);
    if (noChange.length > 0) {
        lines.push(`✨ NO CHANGES (${noChange.length} URLs):`);
        lines.push('─────────────────────────────────────────────────────────────');
        for (const result of noChange) {
            const shortUrl = result.url.length > 60 ? result.url.substring(0, 60) + '..' : result.url;
            lines.push(`  ${shortUrl}`);
        }
        lines.push('');
    }
    // Detailed diffs for changed URLs
    if (changed.length > 0) {
        lines.push('');
        lines.push('═══════════════════════════════════════════════════════════════');
        lines.push('  DETAILED DIFFS');
        lines.push('═══════════════════════════════════════════════════════════════');
        for (const result of changed) {
            lines.push('');
            lines.push(`🔍 ${result.url}`);
            lines.push(`   Company: ${result.company || 'unknown'} | Type: ${result.type || 'unknown'}`);
            lines.push(`   Fetch: ${result.fetchMethod} (${result.fetchTimeMs}ms)`);
            lines.push('');
            for (const diff of result.diffs) {
                if (!diff.changed)
                    continue;
                lines.push(`   Strategy: ${diff.strategy}`);
                lines.push(`   Changed lines: +${diff.addedLines} -${diff.removedLines} (${diff.diffSize} total)`);
                lines.push(`   Noise estimate: ${(diff.noiseEstimate * 100).toFixed(0)}%`);
                lines.push('   ---');
                // Show first 20 lines of patch
                const patchLines = diff.patch.split('\n').slice(0, 20);
                for (const pl of patchLines) {
                    lines.push(`   ${pl}`);
                }
                if (diff.patch.split('\n').length > 20) {
                    lines.push('   ... [truncated]');
                }
                lines.push('');
            }
        }
    }
    return lines.join('\n');
}
function padRight(str, len) {
    return str.length >= len ? str : str + ' '.repeat(len - str.length);
}
/**
 * Generate a JSON report
 */
export function generateJsonReport(report) {
    return JSON.stringify(report, null, 2);
}
