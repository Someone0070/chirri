/**
 * Report: Generate summary reports from evaluation results.
 */

import type { EvaluationScore } from './evaluator.js';
import type { PromptResult, StrategyName } from './prompts.js';

export interface ReportSummary {
  total_tests: number;
  by_model: Record<string, ModelReport>;
  by_strategy: Record<string, StrategyReport>;
  by_model_strategy: Record<string, StrategyReport>;
  adversarial_results: AdversarialReport;
  cost_summary: CostSummary;
}

interface ModelReport {
  total: number;
  avg_score: number;
  severity_accuracy: number;
  breaking_accuracy: number;
  hallucination_rate: number;
  avg_latency_ms: number;
  avg_cost_usd: number;
}

interface StrategyReport {
  total: number;
  avg_score: number;
  severity_accuracy: number;
  breaking_accuracy: number;
  json_validity?: number;
}

interface AdversarialReport {
  total: number;
  cosmetic_correct: number;
  cosmetic_accuracy: number;
}

interface CostSummary {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_cost_per_analysis: number;
}

export function generateReport(
  scores: EvaluationScore[],
  results: PromptResult[]
): ReportSummary {
  const report: ReportSummary = {
    total_tests: scores.length,
    by_model: {},
    by_strategy: {},
    by_model_strategy: {},
    adversarial_results: { total: 0, cosmetic_correct: 0, cosmetic_accuracy: 0 },
    cost_summary: { total_cost_usd: 0, total_input_tokens: 0, total_output_tokens: 0, avg_cost_per_analysis: 0 },
  };

  // Group by model
  const models = new Set(scores.map(s => s.model));
  for (const model of models) {
    const modelScores = scores.filter(s => s.model === model);
    const modelResults = results.filter(r => r.model === model);
    report.by_model[model] = computeModelReport(modelScores, modelResults);
  }

  // Group by strategy
  const strategies = new Set(scores.map(s => s.strategy));
  for (const strategy of strategies) {
    const stratScores = scores.filter(s => s.strategy === strategy);
    report.by_strategy[strategy] = computeStrategyReport(stratScores);
  }

  // Group by model+strategy
  for (const model of models) {
    for (const strategy of strategies) {
      const key = `${model}:${strategy}`;
      const combo = scores.filter(s => s.model === model && s.strategy === strategy);
      if (combo.length > 0) {
        report.by_model_strategy[key] = computeStrategyReport(combo);
      }
    }
  }

  // Adversarial
  const adversarial = scores.filter(s => s.cosmetic_correct !== null);
  report.adversarial_results.total = adversarial.length;
  report.adversarial_results.cosmetic_correct = adversarial.filter(s => s.cosmetic_correct === true).length;
  report.adversarial_results.cosmetic_accuracy = adversarial.length > 0
    ? report.adversarial_results.cosmetic_correct / adversarial.length
    : 0;

  // Cost
  report.cost_summary.total_cost_usd = results.reduce((s, r) => s + r.estimated_cost_usd, 0);
  report.cost_summary.total_input_tokens = results.reduce((s, r) => s + r.input_tokens, 0);
  report.cost_summary.total_output_tokens = results.reduce((s, r) => s + r.output_tokens, 0);
  report.cost_summary.avg_cost_per_analysis = results.length > 0
    ? report.cost_summary.total_cost_usd / results.length
    : 0;

  return report;
}

function computeModelReport(scores: EvaluationScore[], results: PromptResult[]): ModelReport {
  const n = scores.length;
  return {
    total: n,
    avg_score: avg(scores.map(s => s.overall_score)),
    severity_accuracy: ratio(scores, s => s.severity_correct),
    breaking_accuracy: ratio(scores, s => s.breaking_correct),
    hallucination_rate: ratio(scores, s => s.hallucination_detected),
    avg_latency_ms: avg(results.map(r => r.latency_ms)),
    avg_cost_usd: avg(results.map(r => r.estimated_cost_usd)),
  };
}

function computeStrategyReport(scores: EvaluationScore[]): StrategyReport {
  const r: StrategyReport = {
    total: scores.length,
    avg_score: avg(scores.map(s => s.overall_score)),
    severity_accuracy: ratio(scores, s => s.severity_correct),
    breaking_accuracy: ratio(scores, s => s.breaking_correct),
  };
  const jsonScores = scores.filter(s => s.json_valid !== null);
  if (jsonScores.length > 0) {
    r.json_validity = ratio(jsonScores, s => s.json_valid === true);
  }
  return r;
}

function avg(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function ratio<T>(arr: T[], pred: (t: T) => boolean): number {
  return arr.length > 0 ? arr.filter(pred).length / arr.length : 0;
}

export function formatReport(report: ReportSummary): string {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════');
  lines.push('  CHIRRI LLM SUMMARIZER - EVALUATION REPORT');
  lines.push('═══════════════════════════════════════════');
  lines.push(`Total tests: ${report.total_tests}`);
  lines.push('');

  lines.push('── BY MODEL ──');
  for (const [model, r] of Object.entries(report.by_model)) {
    lines.push(`\n  ${model}:`);
    lines.push(`    Tests: ${r.total}`);
    lines.push(`    Avg Score: ${(r.avg_score * 100).toFixed(1)}%`);
    lines.push(`    Severity Accuracy: ${(r.severity_accuracy * 100).toFixed(1)}%`);
    lines.push(`    Breaking Accuracy: ${(r.breaking_accuracy * 100).toFixed(1)}%`);
    lines.push(`    Hallucination Rate: ${(r.hallucination_rate * 100).toFixed(1)}%`);
    lines.push(`    Avg Latency: ${r.avg_latency_ms.toFixed(0)}ms`);
    lines.push(`    Avg Cost: $${r.avg_cost_usd.toFixed(6)}`);
  }
  lines.push('');

  lines.push('── BY STRATEGY ──');
  for (const [strategy, r] of Object.entries(report.by_strategy)) {
    lines.push(`\n  ${strategy}:`);
    lines.push(`    Tests: ${r.total}`);
    lines.push(`    Avg Score: ${(r.avg_score * 100).toFixed(1)}%`);
    lines.push(`    Severity Accuracy: ${(r.severity_accuracy * 100).toFixed(1)}%`);
    lines.push(`    Breaking Accuracy: ${(r.breaking_accuracy * 100).toFixed(1)}%`);
    if (r.json_validity !== undefined) {
      lines.push(`    JSON Validity: ${(r.json_validity * 100).toFixed(1)}%`);
    }
  }
  lines.push('');

  lines.push('── BY MODEL × STRATEGY ──');
  for (const [key, r] of Object.entries(report.by_model_strategy)) {
    lines.push(`\n  ${key}:`);
    lines.push(`    Avg Score: ${(r.avg_score * 100).toFixed(1)}% | Breaking: ${(r.breaking_accuracy * 100).toFixed(1)}%`);
  }
  lines.push('');

  lines.push('── ADVERSARIAL (Anti-Hallucination) ──');
  const adv = report.adversarial_results;
  lines.push(`  Total adversarial tests: ${adv.total}`);
  lines.push(`  Cosmetic correctly identified: ${adv.cosmetic_correct}/${adv.total}`);
  lines.push(`  Cosmetic accuracy: ${(adv.cosmetic_accuracy * 100).toFixed(1)}%`);
  lines.push('');

  lines.push('── COST SUMMARY ──');
  const cost = report.cost_summary;
  lines.push(`  Total cost: $${cost.total_cost_usd.toFixed(4)}`);
  lines.push(`  Total tokens: ${cost.total_input_tokens + cost.total_output_tokens} (${cost.total_input_tokens} in / ${cost.total_output_tokens} out)`);
  lines.push(`  Avg cost per analysis: $${cost.avg_cost_per_analysis.toFixed(6)}`);
  lines.push('');

  return lines.join('\n');
}
