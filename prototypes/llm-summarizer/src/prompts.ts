/**
 * Three prompt strategies for LLM-based API changelog summarization.
 */

export interface ChangelogEntry {
  id: string;
  source: string;
  title: string;
  date: string;
  raw_changelog: string;
  before_text: string;
  after_text: string;
  diff_text: string;
  ground_truth: {
    severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
    is_breaking: boolean;
    breaking_reason: string | null;
    affected_endpoints: string[];
    action_required: string;
    cosmetic_only: boolean;
    confidence_notes: string;
  };
}

export type StrategyName = 'basic' | 'structured' | 'json';

export interface PromptResult {
  strategy: StrategyName;
  model: string;
  entry_id: string;
  raw_output: string;
  parsed_output: any;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  timestamp: string;
}

// Cost per million tokens
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-5-20250514': { input: 3.00, output: 15.00 },
  'gpt-4o-mini-stub': { input: 0.15, output: 0.60 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || { input: 1.0, output: 5.0 };
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

export function buildPrompt(strategy: StrategyName, entry: ChangelogEntry): { system: string; user: string } {
  switch (strategy) {
    case 'basic':
      return buildBasicPrompt(entry);
    case 'structured':
      return buildStructuredPrompt(entry);
    case 'json':
      return buildJsonPrompt(entry);
  }
}

function buildBasicPrompt(entry: ChangelogEntry): { system: string; user: string } {
  return {
    system: 'You are analyzing a change to API documentation.',
    user: `Here is the diff:\n\n${entry.diff_text}\n\nSummarize what changed in 2-3 sentences for a developer who uses this API.`,
  };
}

function buildStructuredPrompt(entry: ChangelogEntry): { system: string; user: string } {
  return {
    system: 'You are analyzing a change to API documentation.',
    user: `Here is the diff:\n\n${entry.diff_text}\n\nAnalyze this change and respond with:\n1. What changed (specific, technical)\n2. Is this a breaking change? (yes/no/maybe, with reasoning)\n3. Who is affected? (which API consumers)\n4. What action should a consumer take?`,
  };
}

function buildJsonPrompt(entry: ChangelogEntry): { system: string; user: string } {
  return {
    system: `You are an API change detection system. Analyze diffs and produce structured JSON. Rules:
1) Only report changes explicitly visible in the provided diff.
2) Never infer or speculate about changes not shown.
3) For cosmetic-only changes, set severity to "low" and action_required to "No action needed".
4) Rate your confidence from 0.0 to 1.0.`,
    user: `Analyze this API documentation diff.

BEFORE:
${entry.before_text}

AFTER:
${entry.after_text}

Respond with ONLY valid JSON:
{
  "severity": "critical|high|medium|low",
  "what_changed": "...",
  "is_breaking": true/false,
  "breaking_reason": "..." or null,
  "affected_endpoints": ["..."],
  "action_required": "...",
  "code_before": "..." or null,
  "code_after": "..." or null,
  "confidence": 0.0-1.0,
  "deadline": "..." or null
}`,
  };
}
