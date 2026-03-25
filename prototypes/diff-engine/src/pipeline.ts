/**
 * Voting Pipeline — runs all 4 diff strategies in parallel, counts votes,
 * and produces a structured result with confidence levels.
 *
 * Vote thresholds:
 *   0/4: NO CHANGE
 *   1/4: SUSPICIOUS (store, flag for learning, don't notify)
 *   2/4: LIKELY REAL (confidence 0.6)
 *   3/4: DEFINITELY REAL (confidence 0.85)
 *   4/4: ABSOLUTELY REAL (confidence 1.0)
 */

import { createPatch } from 'diff';
import { diffRawHtml, diffReadability, diffStructural, diffTextOnly, type DiffResult } from './differ.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChangeType = 'none' | 'content' | 'structural' | 'mixed';

export type VoteVerdict =
  | 'no_change'      // 0/4
  | 'suspicious'     // 1/4
  | 'likely_real'    // 2/4
  | 'definitely_real' // 3/4
  | 'absolutely_real'; // 4/4

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
  sectionDiff?: string;
  inUserSection?: boolean;
  readyForLlm: boolean;

  // Raw diff results for further processing
  diffs: DiffResult[];
}

export interface SnapshotData {
  rawHtml: string;
  readabilityText: string;
  structuralDom: string;
  textOnly: string;
}

// ─── Vote Counting ──────────────────────────────────────────────────────────

/**
 * Determine if a strategy votes YES for a change.
 *
 * Rules:
 *   - General: diffSize > 2 (ignore trivial 1-2 char changes)
 *   - raw_html: also requires noise < 50% (too noisy otherwise)
 *   - structural: votes YES if elements were added OR removed (structural change)
 */
function castVote(diff: DiffResult): StrategyVote {
  const { strategy, diffSize, noiseEstimate, addedLines, removedLines } = diff;

  let votedYes = false;
  let reason = '';

  switch (strategy) {
    case 'raw_html':
      if (diffSize > 2 && noiseEstimate < 0.5) {
        votedYes = true;
        reason = `diffSize=${diffSize}, noise=${(noiseEstimate * 100).toFixed(0)}% (< 50% threshold)`;
      } else if (diffSize > 2) {
        reason = `diffSize=${diffSize} but noise=${(noiseEstimate * 100).toFixed(0)}% >= 50% — suppressed`;
      } else if (diffSize > 0) {
        reason = `diffSize=${diffSize} <= 2 — trivial`;
      } else {
        reason = 'no change';
      }
      break;

    case 'structural':
      // Structural votes YES if elements were structurally changed (added/removed),
      // not just text content edits
      if (diffSize > 2) {
        // Check if the structural diff shows added/removed elements (lines with < or >)
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

  return {
    strategy,
    votedYes,
    reason,
    diffSize,
    noiseEstimate,
    addedLines,
    removedLines,
  };
}

/**
 * Map vote count to verdict and confidence.
 */
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

// ─── Structural Analysis ────────────────────────────────────────────────────

/**
 * Analyze the structural diff to determine what KIND of change occurred.
 */
function analyzeStructuralChange(structuralDiff: DiffResult, readabilityDiff: DiffResult): StructuralAnalysis {
  const structChanged = structuralDiff.changed && structuralDiff.diffSize > 2;
  const textChanged = readabilityDiff.changed && readabilityDiff.diffSize > 2;

  // Count element-level changes from the structural diff patch
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

/**
 * Determine the overall change type.
 */
function classifyChangeType(analysis: StructuralAnalysis, votes: StrategyVote[]): ChangeType {
  const anyVotedYes = votes.some(v => v.votedYes);
  if (!anyVotedYes) return 'none';

  if (analysis.structuralChange && analysis.textOnlyChange) return 'mixed';
  if (analysis.structuralChange) return 'structural';
  return 'content';
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

/**
 * Run the full voting pipeline on two snapshots.
 *
 * All 4 strategies run on the same HTML. Each votes independently.
 * The aggregate vote count determines confidence and whether to proceed.
 */
export function runVotingPipeline(
  before: SnapshotData,
  after: SnapshotData,
): VotingResult {
  // Run all 4 strategies
  const diffs: DiffResult[] = [
    diffReadability(before.readabilityText, after.readabilityText),
    diffTextOnly(before.textOnly, after.textOnly),
    diffStructural(before.structuralDom, after.structuralDom),
    diffRawHtml(before.rawHtml, after.rawHtml),
  ];

  // Cast votes
  const strategyVotes = diffs.map(d => castVote(d));
  const yesVotes = strategyVotes.filter(v => v.votedYes).length;

  // Get verdict
  const { verdict, confidence } = getVerdict(yesVotes);

  // Structural analysis (only meaningful for 2+ votes)
  const structuralDiff = diffs.find(d => d.strategy === 'structural')!;
  const readabilityDiff = diffs.find(d => d.strategy === 'readability')!;
  const structuralAnalysis = analyzeStructuralChange(structuralDiff, readabilityDiff);

  // Classify change type
  const changeType = classifyChangeType(structuralAnalysis, strategyVotes);

  // Get the readability diff text for LLM consumption
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
  };
}

/**
 * Format a voting result for console display.
 */
export function formatVotingResult(result: VotingResult, compact = false): string {
  const lines: string[] = [];

  const verdictEmoji: Record<VoteVerdict, string> = {
    no_change: '✅',
    suspicious: '🔍',
    likely_real: '⚡',
    definitely_real: '🔥',
    absolutely_real: '💯',
  };

  const emoji = verdictEmoji[result.verdict];

  if (compact) {
    const voteSummary = result.strategyVotes
      .map(v => `${v.strategy[0].toUpperCase()}:${v.votedYes ? '✓' : '✗'}`)
      .join(' ');
    lines.push(`${emoji} ${result.votes}/4 votes | ${result.verdict} | conf=${result.confidence} | ${voteSummary}`);
    return lines.join('\n');
  }

  lines.push(`${emoji} Voting Result: ${result.votes}/${result.totalStrategies} votes → ${result.verdict}`);
  lines.push(`   Confidence: ${result.confidence}`);
  lines.push(`   Change type: ${result.changeType}`);
  lines.push(`   Ready for LLM: ${result.readyForLlm}`);
  lines.push('   Strategy votes:');

  for (const v of result.strategyVotes) {
    lines.push(`     ${v.votedYes ? '✓' : '✗'} ${v.strategy}: ${v.reason}`);
  }

  if (result.structuralAnalysis.structuralChange) {
    lines.push(`   Structural: +${result.structuralAnalysis.elementsAdded}/-${result.structuralAnalysis.elementsRemoved} elements`);
  }

  return lines.join('\n');
}
