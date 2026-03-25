/**
 * Voting Pipeline — runs all 4 diff strategies, counts votes,
 * and produces a structured result with confidence levels.
 *
 * Integrated layers:
 *   - Layer 1: Volatile Field Learning (strips segments that change >90% of the time)
 *   - Layer 2: Confirmation Recheck (re-fetches after 5s to catch CDN/deploy transients)
 */

import {
  diffRawHtml,
  diffReadability,
  diffStructural,
  diffTextOnly,
  type DiffResult,
} from './differ.js';
import { stripVolatileSegments } from './learning.js';
import { fetchUrl } from './fetcher.js';
import { normalizeText } from './normalizer.js';

export type ChangeType = 'none' | 'content' | 'structural' | 'mixed';

export type VoteVerdict =
  | 'no_change'
  | 'suspicious'
  | 'likely_real'
  | 'definitely_real'
  | 'absolutely_real';

export interface StrategyVote {
  strategy: string;
  votedYes: boolean;
  reason: string;
  diffSize: number;
  noiseEstimate: number;
  addedLines: number;
  removedLines: number;
}

export interface StructuralAnalysis {
  elementsAdded: number;
  elementsRemoved: number;
  textOnlyChange: boolean;
  structuralChange: boolean;
}

export interface VotingResult {
  votes: number;
  totalStrategies: number;
  confidence: number;
  verdict: VoteVerdict;
  changeType: ChangeType;
  strategyVotes: StrategyVote[];
  structuralAnalysis: StructuralAnalysis;
  readabilityDiff: string;
  readyForLlm: boolean;
  diffs: DiffResult[];
  confirmed?: boolean;
  confirmationMessage?: string;
  volatileFieldsStripped?: number;
}

export interface SnapshotData {
  rawHtml: string;
  readabilityText: string;
  structuralDom: string;
  textOnly: string;
}

export interface PipelineOptions {
  url?: string;
  enableVolatileFiltering?: boolean;
  enableConfirmation?: boolean;
  volatilePatterns?: string[];
}

// ─── Vote Counting ──────────────────────────────────────────────────────────

function castVote(diff: DiffResult): StrategyVote {
  const { strategy, diffSize, noiseEstimate, addedLines, removedLines } = diff;

  let votedYes = false;
  let reason = '';

  switch (strategy) {
    case 'raw_html':
      if (diffSize > 2 && noiseEstimate < 0.5) {
        votedYes = true;
        reason = `diffSize=${diffSize}, noise=${(noiseEstimate * 100).toFixed(0)}% (< 50%)`;
      } else if (diffSize > 2) {
        reason = `diffSize=${diffSize} but noise=${(noiseEstimate * 100).toFixed(0)}% >= 50% — suppressed`;
      } else if (diffSize > 0) {
        reason = `diffSize=${diffSize} <= 2 — trivial`;
      } else {
        reason = 'no change';
      }
      break;

    case 'structural':
      if (diffSize > 2) {
        votedYes = true;
        reason = `structural diffSize=${diffSize}, +${addedLines}/-${removedLines} elements`;
      } else if (diffSize > 0) {
        reason = `structural diffSize=${diffSize} <= 2 — trivial`;
      } else {
        reason = 'no structural change';
      }
      break;

    case 'readability':
    case 'text_only':
    default:
      if (diffSize > 2) {
        votedYes = true;
        reason = `diffSize=${diffSize}, noise=${(noiseEstimate * 100).toFixed(0)}%`;
      } else if (diffSize > 0) {
        reason = `diffSize=${diffSize} <= 2 — trivial`;
      } else {
        reason = 'no change';
      }
      break;
  }

  return { strategy, votedYes, reason, diffSize, noiseEstimate, addedLines, removedLines };
}

function getVerdict(votes: number): { verdict: VoteVerdict; confidence: number } {
  switch (votes) {
    case 0: return { verdict: 'no_change', confidence: 0 };
    case 1: return { verdict: 'suspicious', confidence: 0.3 };
    case 2: return { verdict: 'likely_real', confidence: 0.6 };
    case 3: return { verdict: 'definitely_real', confidence: 0.85 };
    case 4: return { verdict: 'absolutely_real', confidence: 1.0 };
    default: return { verdict: votes > 4 ? 'absolutely_real' : 'no_change', confidence: votes > 4 ? 1.0 : 0 };
  }
}

function analyzeStructuralChange(
  structuralDiff: DiffResult,
  readabilityDiff: DiffResult,
): StructuralAnalysis {
  const structChanged = structuralDiff.changed && structuralDiff.diffSize > 2;
  const textChanged = readabilityDiff.changed && readabilityDiff.diffSize > 2;

  let elementsAdded = 0;
  let elementsRemoved = 0;

  if (structuralDiff.patch) {
    const lines = structuralDiff.patch.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        if (/<[a-z]/.test(line) || /\/>/.test(line)) elementsAdded++;
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        if (/<[a-z]/.test(line) || /\/>/.test(line)) elementsRemoved++;
      }
    }
  }

  return {
    elementsAdded,
    elementsRemoved,
    textOnlyChange: textChanged && !structChanged,
    structuralChange: structChanged,
  };
}

function classifyChangeType(
  analysis: StructuralAnalysis,
  votes: StrategyVote[],
): ChangeType {
  const anyVotedYes = votes.some((v) => v.votedYes);
  if (!anyVotedYes) return 'none';
  if (analysis.structuralChange && analysis.textOnlyChange) return 'mixed';
  if (analysis.structuralChange) return 'structural';
  return 'content';
}

function applyVolatileFiltering(
  data: SnapshotData,
  volatilePatterns: string[],
): { filtered: SnapshotData; strippedCount: number } {
  if (volatilePatterns.length === 0) {
    return { filtered: data, strippedCount: 0 };
  }

  const filteredReadability = stripVolatileSegments(data.readabilityText, volatilePatterns);
  const filteredTextOnly = stripVolatileSegments(data.textOnly, volatilePatterns);
  const filteredStructural = stripVolatileSegments(data.structuralDom, volatilePatterns);

  const origLines = data.readabilityText.split('\n').length + data.textOnly.split('\n').length;
  const filtLines = filteredReadability.split('\n').length + filteredTextOnly.split('\n').length;
  const strippedCount = Math.max(0, origLines - filtLines);

  return {
    filtered: {
      rawHtml: data.rawHtml,
      readabilityText: filteredReadability,
      structuralDom: filteredStructural,
      textOnly: filteredTextOnly,
    },
    strippedCount,
  };
}

/**
 * Run the voting pipeline on two snapshots.
 */
export function runVotingPipeline(
  before: SnapshotData,
  after: SnapshotData,
  options?: PipelineOptions,
): VotingResult {
  let effectiveBefore = before;
  let effectiveAfter = after;
  let volatileFieldsStripped = 0;

  // Layer 1: Volatile Field Filtering
  if (options?.volatilePatterns && options.volatilePatterns.length > 0) {
    const beforeResult = applyVolatileFiltering(before, options.volatilePatterns);
    const afterResult = applyVolatileFiltering(after, options.volatilePatterns);
    effectiveBefore = beforeResult.filtered;
    effectiveAfter = afterResult.filtered;
    volatileFieldsStripped = beforeResult.strippedCount + afterResult.strippedCount;
  }

  // Run all 4 strategies
  const diffs: DiffResult[] = [
    diffReadability(effectiveBefore.readabilityText, effectiveAfter.readabilityText),
    diffTextOnly(effectiveBefore.textOnly, effectiveAfter.textOnly),
    diffStructural(effectiveBefore.structuralDom, effectiveAfter.structuralDom),
    diffRawHtml(effectiveBefore.rawHtml, effectiveAfter.rawHtml),
  ];

  const strategyVotes = diffs.map((d) => castVote(d));
  const yesVotes = strategyVotes.filter((v) => v.votedYes).length;
  const { verdict, confidence } = getVerdict(yesVotes);

  const structuralDiff = diffs.find((d) => d.strategy === 'structural')!;
  const readabilityDiff = diffs.find((d) => d.strategy === 'readability')!;
  const structuralAnalysis = analyzeStructuralChange(structuralDiff, readabilityDiff);
  const changeType = classifyChangeType(structuralAnalysis, strategyVotes);
  const readabilityPatch = readabilityDiff.patch || '';

  return {
    votes: yesVotes,
    totalStrategies: 4,
    confidence,
    verdict,
    changeType,
    strategyVotes,
    structuralAnalysis,
    readabilityDiff: readabilityPatch,
    readyForLlm: yesVotes >= 2,
    diffs,
    volatileFieldsStripped: volatileFieldsStripped > 0 ? volatileFieldsStripped : undefined,
  };
}

/**
 * Run the full pipeline with confirmation recheck.
 */
export async function runFullPipeline(
  url: string,
  before: SnapshotData,
  after: SnapshotData,
  options?: PipelineOptions,
): Promise<VotingResult> {
  const result = runVotingPipeline(before, after, options);

  // Layer 2: Confirmation recheck (only if enabled and 2+ votes)
  if (options?.enableConfirmation && result.votes >= 2) {
    // Wait 5 seconds, then re-fetch
    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      const refetch = await fetchUrl(url);
      if (!refetch.error) {
        const normalizedOriginal = normalizeText(before.readabilityText);
        const normalizedNew = normalizeText(refetch.readabilityText);
        const stillChanged = normalizedOriginal !== normalizedNew;

        if (!stillChanged) {
          result.confirmed = false;
          result.confirmationMessage =
            'Change disappeared after 5s recheck — likely CDN edge difference or glitch';
          result.confidence = Math.min(result.confidence, 0.2);
          result.readyForLlm = false;
        } else {
          result.confirmed = true;
          result.confirmationMessage = 'Change persists after 5s recheck — confirmed';
        }
      } else {
        result.confirmed = true;
        result.confirmationMessage = 'Confirmation fetch failed — assuming still changed';
      }
    } catch {
      result.confirmed = true;
      result.confirmationMessage = 'Confirmation fetch error — assuming still changed';
    }
  }

  return result;
}
