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
 *   npx tsx src/index.ts --strategy readability  # Force specific strategy (readability|text_only|raw_html|structural)
 *   npx tsx src/index.ts --pipeline voting       # Use voting pipeline (default)
 *   npx tsx src/index.ts --pipeline legacy        # Use old readability-first approach
 *
 * 6-Layer FP Defense flags:
 *   npx tsx src/index.ts --learn            # Learning mode: collect snapshots, build volatile field list
 *   npx tsx src/index.ts --confirm          # Enable confirmation rechecks (Stage 1: 5s, Stage 2: 30min)
 *   npx tsx src/index.ts --stability        # Show stability scores for all URLs
 *   npx tsx src/index.ts --full-pipeline    # Run all 6 layers
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchUrl, type FetchResult } from './fetcher.js';
import { storeSnapshot, getLatestSnapshot, getSnapshotCount, closeDb } from './snapshot.js';
import { diffAll, shouldReport, getBestDiff, type DiffResult, type DiffStrategy } from './differ.js';
import { generateTextReport, generateJsonReport, type UrlReport, type FullReport } from './report.js';
import { runLearningPhase, getVolatilePatterns, stripVolatileSegments, getVolatileStats } from './learning.js';
import { confirmStage1, computeDiffHash, getConfirmationStats } from './confirmation.js';
import { updateAllStabilityScores, getAllStabilityScores, calculateStability, formatStabilityReport } from './stability.js';
import { correlateSignals } from './correlation.js';
import { getLastNormalizationAudit } from './normalizer.js';
import { extractSections, type ExtractionResult, type ExtractionConfidence } from './section-extractor.js';
import { runVotingPipeline, formatVotingResult, type VotingResult } from './pipeline.js';
import { storeSectionSnapshot, getLatestSectionSnapshot } from './snapshot.js';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface UrlEntry {
  id: number;
  company: string;
  url: string;
  type: string;
}

type PipelineMode = 'voting' | 'legacy';

interface CliArgs {
  limit: number;
  usePlaywright: boolean;
  concurrency: number;
  reportFormat: string;
  learn: boolean;
  confirm: boolean;
  stability: boolean;
  fullPipeline: boolean;
  resource?: string;
  urls?: string[];
  strategy?: DiffStrategy;
  pipeline: PipelineMode;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let usePlaywright = false;
  let concurrency = 3;
  let reportFormat = 'text';
  let learn = false;
  let confirm = false;
  let stability = false;
  let fullPipeline = false;
  let resource: string | undefined;
  let urls: string[] | undefined;
  let strategy: DiffStrategy | undefined;
  let pipeline: PipelineMode = 'voting'; // Default to voting

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--playwright') {
      usePlaywright = true;
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--report' && args[i + 1]) {
      reportFormat = args[i + 1];
      i++;
    } else if (args[i] === '--learn') {
      learn = true;
    } else if (args[i] === '--confirm') {
      confirm = true;
    } else if (args[i] === '--stability') {
      stability = true;
    } else if (args[i] === '--full-pipeline') {
      fullPipeline = true;
    } else if (args[i] === '--resource' && args[i + 1]) {
      resource = args[i + 1];
      i++;
    } else if (args[i] === '--urls' && args[i + 1]) {
      try {
        urls = JSON.parse(args[i + 1]);
      } catch {
        urls = [args[i + 1]];
      }
      i++;
    } else if (args[i] === '--pipeline' && args[i + 1]) {
      const val = args[i + 1].toLowerCase();
      if (val === 'voting' || val === 'legacy') {
        pipeline = val as PipelineMode;
      } else {
        console.error(`Unknown pipeline mode: ${val}. Valid: voting, legacy`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--strategy' && args[i + 1]) {
      const val = args[i + 1] as DiffStrategy;
      if (['readability', 'text_only', 'raw_html', 'structural'].includes(val)) {
        strategy = val;
      } else {
        console.error(`Unknown strategy: ${val}. Valid: readability, text_only, raw_html, structural`);
        process.exit(1);
      }
      i++;
    }
  }

  return { limit, usePlaywright, concurrency, reportFormat, learn, confirm, stability, fullPipeline, resource, urls, strategy, pipeline };
}

/**
 * Process URLs with concurrency control and optional 6-layer FP defense
 */
async function processUrls(
  urls: UrlEntry[],
  usePlaywright: boolean,
  concurrency: number,
  options: { confirm: boolean; fullPipeline: boolean; pipeline: PipelineMode }
): Promise<UrlReport[]> {
  const results: UrlReport[] = [];
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < urls.length) {
      const current = idx++;
      const entry = urls[current];

      console.log(`[${current + 1}/${urls.length}] Fetching ${entry.company} (${entry.type}): ${entry.url}`);

      let fetchResult: FetchResult;
      try {
        fetchResult = await fetchUrl(entry.url, usePlaywright);
      } catch (err: any) {
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

      let diffs: DiffResult[] = [];
      let confirmationStatus: string | undefined;
      let volatileFieldCount: number | undefined;

      if (previousSnapshot) {
        // Layer 1: Get volatile patterns and strip them before diffing
        const volatilePatterns = getVolatilePatterns(entry.url);
        volatileFieldCount = volatilePatterns.length;

        let beforeData = {
          rawHtml: previousSnapshot.rawHtml,
          readabilityText: previousSnapshot.readabilityText,
          structuralDom: previousSnapshot.structuralDom,
          textOnly: previousSnapshot.textOnly,
        };
        let afterData = {
          rawHtml: fetchResult.rawHtml,
          readabilityText: fetchResult.readabilityText,
          structuralDom: fetchResult.structuralDom,
          textOnly: fetchResult.textOnly,
        };

        if (volatilePatterns.length > 0 && options.fullPipeline) {
          // Strip volatile segments from text-based comparisons
          beforeData.readabilityText = stripVolatileSegments(beforeData.readabilityText, volatilePatterns);
          afterData.readabilityText = stripVolatileSegments(afterData.readabilityText, volatilePatterns);
          beforeData.textOnly = stripVolatileSegments(beforeData.textOnly, volatilePatterns);
          afterData.textOnly = stripVolatileSegments(afterData.textOnly, volatilePatterns);
        }

        // Run diff — choose pipeline mode
        if (options.pipeline === 'voting') {
          // ── Voting Pipeline ──
          const votingResult = runVotingPipeline(beforeData, afterData);
          diffs = votingResult.diffs;

          if (votingResult.votes > 0) {
            console.log(`  ${formatVotingResult(votingResult, true)} (${fetchResult.fetchTimeMs}ms)`);
          } else {
            console.log(`  ✨ No changes — 0/4 votes (${fetchResult.fetchTimeMs}ms)`);
          }

          // Store voting metadata on the report
          (results as any)[current] = {
            url: entry.url,
            company: entry.company,
            type: entry.type,
            hasHistory: true,
            fetchMethod: fetchResult.fetchMethod,
            fetchTimeMs: fetchResult.fetchTimeMs,
            diffs,
            votingResult,
          };

        } else {
        // ── Legacy Pipeline ──
        diffs = diffAll(beforeData, afterData);

        const reportDecision = shouldReport(diffs);
        const changedStrategies = diffs.filter(d => d.changed).map(d => d.strategy);
        if (changedStrategies.length > 0) {
          const reportStatus = reportDecision.report ? '📢 REPORTABLE' : '🔇 suppressed (noise)';
          console.log(`  🔄 Changes detected via: ${changedStrategies.join(', ')} [${reportStatus}] (${fetchResult.fetchTimeMs}ms)`);
          if (reportDecision.reasons.length > 0) {
            for (const reason of reportDecision.reasons) {
              console.log(`     → ${reason}`);
            }
          }

          // Layer 4 audit
          const audit = getLastNormalizationAudit();
          if (audit.totalStripped > 0) {
            console.log(`  🧹 Layer 4: Stripped ${audit.totalStripped} volatile patterns (${audit.patternsStripped.map(p => p.name).join(', ')})`);
          }

          // Layer 2: Confirmation recheck (if enabled)
          if (options.confirm || options.fullPipeline) {
            const confirmation = await confirmStage1(
              entry.url,
              previousSnapshot.readabilityText,
              diffs,
              usePlaywright
            );
            confirmationStatus = confirmation.discarded
              ? 'discarded'
              : confirmation.confirmed
                ? 'confirmed'
                : 'pending_stage2';
            console.log(`  ${confirmation.discarded ? '🚫' : '⏳'} ${confirmation.message}`);
          } else {
            confirmationStatus = 'skipped';
          }

          // Layer 5: Cross-source correlation (stub)
          if (options.fullPipeline) {
            const diffHash = computeDiffHash(diffs);
            const correlation = correlateSignals(entry.url, diffHash);
            console.log(`  🔗 Layer 5: ${correlation.message}`);
          }
        } else {
          console.log(`  ✨ No changes (${fetchResult.fetchTimeMs}ms)`);
        }
        } // end legacy pipeline else
      } else {
        console.log(`  📸 First snapshot stored (${fetchResult.fetchTimeMs}ms)`);
      }

      // Layer 3: Calculate stability
      const stability = calculateStability(entry.url);

      results[current] = {
        url: entry.url,
        company: entry.company,
        type: entry.type,
        hasHistory: !!previousSnapshot,
        fetchMethod: fetchResult.fetchMethod,
        fetchTimeMs: fetchResult.fetchTimeMs,
        diffs,
        stabilityScore: stability.score,
        isUnstable: stability.isUnstable,
        volatileFieldCount,
        confirmationStatus,
        filteredAsNoise: diffs.every(d => !d.changed) && volatileFieldCount !== undefined && volatileFieldCount > 0,
        noiseEstimateOverall: diffs.length > 0
          ? diffs.reduce((sum, d) => sum + d.noiseEstimate, 0) / diffs.length
          : 0,
      };
    }
  }

  // Launch concurrent workers
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);

  // Filter out any undefined slots
  return results.filter(Boolean);
}

/**
 * Hash text for section snapshot comparison
 */
function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Run section extraction pipeline for a specific resource on given URLs
 */
async function runSectionExtraction(
  urls: string[],
  resource: string,
  usePlaywright: boolean
): Promise<void> {
  console.log(`\n🔍 Section Extraction Mode`);
  console.log(`   Resource: ${resource}`);
  console.log(`   URLs: ${urls.length}`);
  console.log(`   Playwright: ${usePlaywright ? 'enabled' : 'disabled'}`);
  console.log('');

  const resourceNames = [resource];
  // Also add singular/plural variant
  if (resource.endsWith('s') && resource.length > 3) {
    resourceNames.push(resource.replace(/s$/, ''));
  } else if (!resource.endsWith('s')) {
    resourceNames.push(resource + 's');
  }

  for (const url of urls) {
    console.log(`\n📄 ${url}`);
    console.log(`   Fetching...`);

    let fetchResult;
    try {
      fetchResult = await fetchUrl(url, usePlaywright);
    } catch (err: any) {
      console.log(`   ❌ Fetch error: ${err.message}`);
      continue;
    }

    if (fetchResult.error) {
      console.log(`   ❌ Fetch error: ${fetchResult.error}`);
      continue;
    }

    console.log(`   ✅ Fetched (${fetchResult.fetchMethod}, ${fetchResult.fetchTimeMs}ms, ${(fetchResult.rawHtml.length / 1024).toFixed(0)}KB)`);

    // Run section extraction on raw HTML
    const extraction = extractSections({
      html: fetchResult.rawHtml,
      resourceNames,
    });

    console.log(`   Platform: ${extraction.platform}`);
    console.log(`   Confidence: ${extraction.confidence}`);
    console.log(`   Anchors found: ${extraction.totalAnchorsFound}`);
    console.log(`   Sections extracted: ${extraction.sections.length}`);
    console.log(`   Extraction time: ${extraction.extractionTimeMs}ms`);

    if (extraction.warnings.length > 0) {
      for (const w of extraction.warnings) {
        console.log(`   ⚠️  ${w}`);
      }
    }

    if (extraction.fallbackReason) {
      console.log(`   ⚡ Fallback: ${extraction.fallbackReason}`);
      console.log(`   → Will use full page diff instead`);

      // Store full page snapshot normally
      storeSnapshot({
        url,
        rawHtml: fetchResult.rawHtml,
        readabilityText: fetchResult.readabilityText,
        structuralDom: fetchResult.structuralDom,
        textOnly: fetchResult.textOnly,
        fetchMethod: fetchResult.fetchMethod,
        fetchTimeMs: fetchResult.fetchTimeMs,
      });
      continue;
    }

    // Show extracted sections
    console.log('');
    console.log('   📋 Extracted Sections:');
    for (let i = 0; i < extraction.sections.length; i++) {
      const s = extraction.sections[i];
      const preview = s.text.substring(0, 120).replace(/\n/g, ' ');
      console.log(`   ${i + 1}. ${s.heading || '(no heading)'} [${s.matchType}]`);
      if (s.anchorId) console.log(`      Anchor: #${s.anchorId}`);
      console.log(`      Size: ${s.text.length} chars`);
      console.log(`      Preview: ${preview}...`);
    }

    // Build combined section text for diffing
    const sectionText = extraction.sections.map(s => s.text).join('\n---\n');
    const sectionHtml = extraction.sections.map(s => s.html).join('\n<!-- section-break -->\n');
    const sectionHash = hashText(sectionText);

    // Check for previous section snapshot
    const previous = getLatestSectionSnapshot(url, resource);

    if (previous) {
      if (previous.sectionHash === sectionHash) {
        console.log(`\n   ✨ No changes in "${resource}" section (hash match)`);
      } else {
        console.log(`\n   🔄 CHANGES DETECTED in "${resource}" section!`);
        // Quick diff for display
        const { createPatch } = await import('diff');
        const patch = createPatch(
          `${resource}-section.txt`,
          previous.sectionText,
          sectionText,
          'previous', 'current',
          { context: 3 }
        );
        const patchLines = patch.split('\n');
        const addedLines = patchLines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
        const removedLines = patchLines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;
        console.log(`   Changed lines: +${addedLines} -${removedLines}`);

        // Show first 30 lines of patch
        const display = patchLines.slice(0, 30);
        for (const line of display) {
          console.log(`   ${line}`);
        }
        if (patchLines.length > 30) {
          console.log(`   ... [${patchLines.length - 30} more lines]`);
        }
      }
    } else {
      console.log(`\n   📸 First section snapshot stored for "${resource}"`);
    }

    // Store section snapshot
    storeSectionSnapshot({
      url,
      resourceKey: resource,
      sectionHash,
      sectionText,
      sectionHtml,
      confidence: extraction.confidence,
      platform: extraction.platform,
    });
  }
}

async function main() {
  const { limit, usePlaywright, concurrency, reportFormat, learn, confirm, stability, fullPipeline, resource, urls: cliUrls, pipeline } = parseArgs();

  // --stability: Show stability scores and exit
  if (stability) {
    console.log('\n📊 Calculating stability scores for all URLs...\n');
    const scores = updateAllStabilityScores();
    console.log(formatStabilityReport(scores));
    closeDb();
    return;
  }

  // --resource: Section extraction mode
  if (resource) {
    const targetUrls = cliUrls || [];
    if (targetUrls.length === 0) {
      console.error('Error: --resource requires --urls to be specified');
      process.exit(1);
    }
    await runSectionExtraction(targetUrls, resource, usePlaywright);
    closeDb();
    return;
  }

  // --learn: Run learning phase and exit
  if (learn) {
    console.log('\n🧠 Running learning phase (volatile field detection)...\n');
    const result = runLearningPhase();
    console.log(`URLs analyzed: ${result.urlsAnalyzed}`);
    console.log(`Total volatile fields detected: ${result.totalVolatileFields}`);
    console.log('');

    const withVolatile = result.results.filter(r => r.volatileCount > 0);
    if (withVolatile.length > 0) {
      console.log('URLs with volatile fields:');
      console.log('─────────────────────────────────────────────────────────────');
      for (const r of withVolatile) {
        const shortUrl = r.url.length > 60 ? r.url.substring(0, 60) + '..' : r.url;
        console.log(`  ${shortUrl}: ${r.volatileCount} volatile fields (${r.totalComparisons} comparisons)`);
      }
    } else {
      console.log('No volatile fields detected (may need more snapshots — minimum 3 per URL).');
    }

    // Also update stability scores during learning
    console.log('\n📊 Updating stability scores...\n');
    const scores = updateAllStabilityScores();
    const unstable = scores.filter(s => s.isUnstable);
    console.log(`Stability: ${scores.length} URLs scored, ${unstable.length} unstable (score < 0.5)`);

    closeDb();
    return;
  }

  // Load URLs
  const urlsPath = path.resolve(__dirname, '..', 'urls.json');
  const allUrls: UrlEntry[] = JSON.parse(readFileSync(urlsPath, 'utf-8'));
  const urls = allUrls.slice(0, limit);

  const pipelineMode = pipeline === 'voting' ? 'VOTING PIPELINE' : fullPipeline ? 'FULL 6-LAYER PIPELINE' : confirm ? 'WITH CONFIRMATION' : 'STANDARD';

  console.log(`\n🚀 Chirri Diff Engine - Starting (${pipelineMode})`);
  console.log(`   URLs: ${urls.length}${limit < Infinity ? ` (limited from ${allUrls.length})` : ''}`);
  console.log(`   Playwright: ${usePlaywright ? 'enabled' : 'disabled'}`);
  console.log(`   Concurrency: ${concurrency}`);
  if (fullPipeline) {
    console.log(`   Layers: 1-Volatile filtering, 2-Confirmation, 3-Stability, 4-Proactive FP, 5-Correlation, 6-Feedback`);
  }
  console.log('');

  const startTime = Date.now();
  const results = await processUrls(urls, usePlaywright, concurrency, { confirm, fullPipeline, pipeline });
  const elapsed = Date.now() - startTime;

  // Gather volatile stats
  const volatileStats = getVolatileStats();
  const totalVolatileFields = volatileStats.reduce((sum, s) => sum + s.volatileCount, 0);

  // Update stability scores
  updateAllStabilityScores();

  // Get confirmation stats
  const confirmStats = getConfirmationStats();

  // Calculate FP estimate based on noise estimates
  const changedResults = results.filter(r => r.diffs.some(d => d.changed));
  const avgNoise = changedResults.length > 0
    ? changedResults.reduce((sum, r) => sum + (r.noiseEstimateOverall || 0), 0) / changedResults.length
    : 0;

  // Build report
  const fullReport: FullReport = {
    timestamp: new Date().toISOString(),
    totalUrls: urls.length,
    fetchedUrls: results.filter(r => !r.fetchError).length,
    errorUrls: results.filter(r => r.fetchError).length,
    urlsWithHistory: results.filter(r => r.hasHistory).length,
    changedUrls: changedResults.length,
    results,
    confirmedChanges: confirmStats.confirmed,
    filteredAsNoise: results.filter(r => r.filteredAsNoise).length + confirmStats.discarded,
    avgStabilityScore: results.length > 0
      ? results.reduce((sum, r) => sum + (r.stabilityScore || 1), 0) / results.length
      : 1,
    totalVolatileFields,
    fpEstimate: avgNoise,
  };

  console.log('');
  if (reportFormat === 'json') {
    console.log(generateJsonReport(fullReport));
  } else {
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
