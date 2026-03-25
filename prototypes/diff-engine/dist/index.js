#!/usr/bin/env node
/**
 * Chirri Diff Engine - Main CLI entry point
 *
 * Usage:
 *   npx tsx src/index.ts                    # Run against all 100 URLs
 *   npx tsx src/index.ts --limit 5          # Run against first 5 URLs
 *   npx tsx src/index.ts --playwright       # Enable Playwright for JS-heavy pages
 *   npx tsx src/index.ts --concurrency 5    # Concurrent fetches (default: 3)
 *   npx tsx src/index.ts --report json      # Output JSON instead of text
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchUrl } from './fetcher.js';
import { storeSnapshot, getLatestSnapshot, getSnapshotCount, closeDb } from './snapshot.js';
import { diffAll } from './differ.js';
import { generateTextReport, generateJsonReport } from './report.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function parseArgs() {
    const args = process.argv.slice(2);
    let limit = Infinity;
    let usePlaywright = false;
    let concurrency = 3;
    let reportFormat = 'text';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--limit' && args[i + 1]) {
            limit = parseInt(args[i + 1], 10);
            i++;
        }
        else if (args[i] === '--playwright') {
            usePlaywright = true;
        }
        else if (args[i] === '--concurrency' && args[i + 1]) {
            concurrency = parseInt(args[i + 1], 10);
            i++;
        }
        else if (args[i] === '--report' && args[i + 1]) {
            reportFormat = args[i + 1];
            i++;
        }
    }
    return { limit, usePlaywright, concurrency, reportFormat };
}
/**
 * Process URLs with concurrency control
 */
async function processUrls(urls, usePlaywright, concurrency) {
    const results = [];
    let idx = 0;
    async function worker() {
        while (idx < urls.length) {
            const current = idx++;
            const entry = urls[current];
            console.log(`[${current + 1}/${urls.length}] Fetching ${entry.company} (${entry.type}): ${entry.url}`);
            let fetchResult;
            try {
                fetchResult = await fetchUrl(entry.url, usePlaywright);
            }
            catch (err) {
                results[current] = {
                    url: entry.url,
                    company: entry.company,
                    type: entry.type,
                    hasHistory: false,
                    fetchError: err.message,
                    fetchMethod: 'http',
                    fetchTimeMs: 0,
                    diffs: [],
                };
                console.log(`  ❌ Error: ${err.message}`);
                continue;
            }
            if (fetchResult.error) {
                results[current] = {
                    url: entry.url,
                    company: entry.company,
                    type: entry.type,
                    hasHistory: false,
                    fetchError: fetchResult.error,
                    fetchMethod: fetchResult.fetchMethod,
                    fetchTimeMs: fetchResult.fetchTimeMs,
                    diffs: [],
                };
                console.log(`  ❌ Error: ${fetchResult.error}`);
                continue;
            }
            // Get previous snapshot before storing new one
            const snapshotCount = getSnapshotCount(entry.url);
            const previousSnapshot = snapshotCount > 0 ? getLatestSnapshot(entry.url) : null;
            // Store new snapshot
            storeSnapshot({
                url: entry.url,
                rawHtml: fetchResult.rawHtml,
                readabilityText: fetchResult.readabilityText,
                structuralDom: fetchResult.structuralDom,
                textOnly: fetchResult.textOnly,
                fetchMethod: fetchResult.fetchMethod,
                fetchTimeMs: fetchResult.fetchTimeMs,
                error: fetchResult.error,
            });
            let diffs = [];
            if (previousSnapshot) {
                diffs = diffAll({
                    rawHtml: previousSnapshot.rawHtml,
                    readabilityText: previousSnapshot.readabilityText,
                    structuralDom: previousSnapshot.structuralDom,
                    textOnly: previousSnapshot.textOnly,
                }, {
                    rawHtml: fetchResult.rawHtml,
                    readabilityText: fetchResult.readabilityText,
                    structuralDom: fetchResult.structuralDom,
                    textOnly: fetchResult.textOnly,
                });
                const changedStrategies = diffs.filter(d => d.changed).map(d => d.strategy);
                if (changedStrategies.length > 0) {
                    console.log(`  🔄 Changes detected via: ${changedStrategies.join(', ')} (${fetchResult.fetchTimeMs}ms)`);
                }
                else {
                    console.log(`  ✨ No changes (${fetchResult.fetchTimeMs}ms)`);
                }
            }
            else {
                console.log(`  📸 First snapshot stored (${fetchResult.fetchTimeMs}ms)`);
            }
            results[current] = {
                url: entry.url,
                company: entry.company,
                type: entry.type,
                hasHistory: !!previousSnapshot,
                fetchMethod: fetchResult.fetchMethod,
                fetchTimeMs: fetchResult.fetchTimeMs,
                diffs,
            };
        }
    }
    // Launch concurrent workers
    const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
    await Promise.all(workers);
    // Filter out any undefined slots
    return results.filter(Boolean);
}
async function main() {
    const { limit, usePlaywright, concurrency, reportFormat } = parseArgs();
    // Load URLs
    const urlsPath = path.resolve(__dirname, '..', 'urls.json');
    const allUrls = JSON.parse(readFileSync(urlsPath, 'utf-8'));
    const urls = allUrls.slice(0, limit);
    console.log(`\n🚀 Chirri Diff Engine - Starting`);
    console.log(`   URLs: ${urls.length}${limit < Infinity ? ` (limited from ${allUrls.length})` : ''}`);
    console.log(`   Playwright: ${usePlaywright ? 'enabled' : 'disabled'}`);
    console.log(`   Concurrency: ${concurrency}`);
    console.log('');
    const startTime = Date.now();
    const results = await processUrls(urls, usePlaywright, concurrency);
    const elapsed = Date.now() - startTime;
    // Build report
    const fullReport = {
        timestamp: new Date().toISOString(),
        totalUrls: urls.length,
        fetchedUrls: results.filter(r => !r.fetchError).length,
        errorUrls: results.filter(r => r.fetchError).length,
        urlsWithHistory: results.filter(r => r.hasHistory).length,
        changedUrls: results.filter(r => r.diffs.some(d => d.changed)).length,
        results,
    };
    console.log('');
    if (reportFormat === 'json') {
        console.log(generateJsonReport(fullReport));
    }
    else {
        console.log(generateTextReport(fullReport));
    }
    console.log(`\n⏱️  Total time: ${(elapsed / 1000).toFixed(1)}s`);
    closeDb();
}
main().catch(err => {
    console.error('Fatal error:', err);
    closeDb();
    process.exit(1);
});
