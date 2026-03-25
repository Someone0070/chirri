/**
 * Diff strategies - compare snapshots using different approaches
 */
import { createPatch } from 'diff';
import { normalizeHtml, normalizeText } from './normalizer.js';
/**
 * Count diff stats from a unified patch
 */
function analyzePatch(patch) {
    const lines = patch.split('\n');
    let addedLines = 0;
    let removedLines = 0;
    for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++'))
            addedLines++;
        if (line.startsWith('-') && !line.startsWith('---'))
            removedLines++;
    }
    return { addedLines, removedLines, totalChangedLines: addedLines + removedLines };
}
/**
 * Estimate noise level of a diff (0 = all signal, 1 = all noise)
 * Heuristic based on diff characteristics
 */
function estimateNoise(patch, _strategy) {
    if (!patch || patch.trim() === '')
        return 0;
    const lines = patch.split('\n');
    let noiseLines = 0;
    let totalDiffLines = 0;
    const noisePatterns = [
        /\[TIMESTAMP\]/,
        /\[DATE\]/,
        /\[UNIX_TS\]/,
        /\[RELATIVE_TIME\]/,
        /\[LAST_UPDATED\]/,
        /^\s*$/, // whitespace-only changes
        /^\s*[+-]\s*$/, // empty diff lines
    ];
    for (const line of lines) {
        if ((line.startsWith('+') && !line.startsWith('+++')) ||
            (line.startsWith('-') && !line.startsWith('---'))) {
            totalDiffLines++;
            for (const pattern of noisePatterns) {
                if (pattern.test(line)) {
                    noiseLines++;
                    break;
                }
            }
        }
    }
    if (totalDiffLines === 0)
        return 0;
    return noiseLines / totalDiffLines;
}
/**
 * Strategy 1: Raw HTML diff (with normalization)
 */
export function diffRawHtml(before, after) {
    const normBefore = normalizeHtml(before);
    const normAfter = normalizeHtml(after);
    const patch = createPatch('page.html', normBefore, normAfter, '', '', { context: 3 });
    const stats = analyzePatch(patch);
    const totalLines = normAfter.split('\n').length;
    return {
        strategy: 'raw_html',
        changed: stats.totalChangedLines > 0,
        diffSize: stats.totalChangedLines,
        totalLines,
        noiseEstimate: estimateNoise(patch, 'raw_html'),
        patch: patch.length > 5000 ? patch.substring(0, 5000) + '\n... [truncated]' : patch,
        addedLines: stats.addedLines,
        removedLines: stats.removedLines,
    };
}
/**
 * Strategy 2: Readability-extracted text diff
 */
export function diffReadability(before, after) {
    const normBefore = normalizeText(before);
    const normAfter = normalizeText(after);
    const patch = createPatch('readability.txt', normBefore, normAfter, '', '', { context: 3 });
    const stats = analyzePatch(patch);
    const totalLines = normAfter.split('\n').length;
    return {
        strategy: 'readability',
        changed: stats.totalChangedLines > 0,
        diffSize: stats.totalChangedLines,
        totalLines,
        noiseEstimate: estimateNoise(patch, 'readability'),
        patch: patch.length > 5000 ? patch.substring(0, 5000) + '\n... [truncated]' : patch,
        addedLines: stats.addedLines,
        removedLines: stats.removedLines,
    };
}
/**
 * Strategy 3: Structural DOM diff
 */
export function diffStructural(before, after) {
    const normBefore = normalizeText(before);
    const normAfter = normalizeText(after);
    const patch = createPatch('structure.dom', normBefore, normAfter, '', '', { context: 3 });
    const stats = analyzePatch(patch);
    const totalLines = normAfter.split('\n').length;
    return {
        strategy: 'structural',
        changed: stats.totalChangedLines > 0,
        diffSize: stats.totalChangedLines,
        totalLines,
        noiseEstimate: estimateNoise(patch, 'structural'),
        patch: patch.length > 5000 ? patch.substring(0, 5000) + '\n... [truncated]' : patch,
        addedLines: stats.addedLines,
        removedLines: stats.removedLines,
    };
}
/**
 * Strategy 4: Text-only diff
 */
export function diffTextOnly(before, after) {
    const normBefore = normalizeText(before);
    const normAfter = normalizeText(after);
    const patch = createPatch('text.txt', normBefore, normAfter, '', '', { context: 3 });
    const stats = analyzePatch(patch);
    const totalLines = normAfter.split('\n').length;
    return {
        strategy: 'text_only',
        changed: stats.totalChangedLines > 0,
        diffSize: stats.totalChangedLines,
        totalLines,
        noiseEstimate: estimateNoise(patch, 'text_only'),
        patch: patch.length > 5000 ? patch.substring(0, 5000) + '\n... [truncated]' : patch,
        addedLines: stats.addedLines,
        removedLines: stats.removedLines,
    };
}
/**
 * Run all 4 diff strategies
 */
export function diffAll(before, after) {
    return [
        diffRawHtml(before.rawHtml, after.rawHtml),
        diffReadability(before.readabilityText, after.readabilityText),
        diffStructural(before.structuralDom, after.structuralDom),
        diffTextOnly(before.textOnly, after.textOnly),
    ];
}
