#!/usr/bin/env node
/**
 * Chirri LLM Summarizer Prototype
 * 
 * Runs changelog entries through different LLM models and prompt strategies,
 * evaluates results against ground truth, and generates a report.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildPrompt, estimateCost, type ChangelogEntry, type PromptResult, type StrategyName } from './prompts.js';
import { evaluate, type EvaluationScore } from './evaluator.js';
import { generateReport, formatReport } from './report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURES_DIR = join(ROOT, 'fixtures', 'changelog-entries');
const RESULTS_DIR = join(ROOT, 'results');

// Models to test
const MODELS = [
  'claude-3-5-haiku-20241022',
  'claude-sonnet-4-5-20250514',
];

const STRATEGIES: StrategyName[] = ['basic', 'structured', 'json'];

// Parse CLI args
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;
const modelFilter = args.includes('--model') ? args[args.indexOf('--model') + 1] : null;
const strategyFilter = args.includes('--strategy') ? args[args.indexOf('--strategy') + 1] as StrategyName : null;
const dryRun = args.includes('--dry-run');

function loadFixtures(): ChangelogEntry[] {
  const files = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json')).sort();
  return files.map(f => {
    const raw = readFileSync(join(FIXTURES_DIR, f), 'utf-8');
    return JSON.parse(raw) as ChangelogEntry;
  });
}

async function runLLM(
  client: Anthropic,
  model: string,
  entry: ChangelogEntry,
  strategy: StrategyName
): Promise<PromptResult> {
  const prompt = buildPrompt(strategy, entry);
  const start = Date.now();
  
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });
  
  const latency = Date.now() - start;
  const rawOutput = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text)
    .join('');
  
  let parsed: any = null;
  if (strategy === 'json') {
    try {
      // Try to extract JSON from the response
      const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = null;
    }
  }
  
  return {
    strategy,
    model,
    entry_id: entry.id,
    raw_output: rawOutput,
    parsed_output: parsed,
    latency_ms: latency,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    estimated_cost_usd: estimateCost(model, response.usage.input_tokens, response.usage.output_tokens),
    timestamp: new Date().toISOString(),
  };
}

function generateMockResult(entry: ChangelogEntry, strategy: StrategyName, model: string): PromptResult {
  const gt = entry.ground_truth;
  // Simulate realistic LLM output based on ground truth (for pipeline testing)
  const latency = model.includes('haiku') ? 300 + Math.random() * 500 : 800 + Math.random() * 1500;
  const inputTokens = Math.floor(entry.diff_text.length / 3.5);
  const outputTokens = strategy === 'json' ? 200 : strategy === 'structured' ? 300 : 100;
  
  let rawOutput: string;
  let parsed: any = null;
  
  if (strategy === 'basic') {
    if (gt.cosmetic_only) {
      rawOutput = `This change is purely cosmetic, involving only formatting and whitespace adjustments. No functional changes were made to the API. No action is needed by developers.`;
    } else if (gt.is_breaking) {
      rawOutput = `This is a breaking change. ${gt.breaking_reason || 'The API behavior has changed in a way that may affect existing integrations.'} Developers using this API should ${gt.action_required}`;
    } else {
      rawOutput = `A new feature or minor update was added. ${gt.action_required} This is a non-breaking change with ${gt.severity} severity.`;
    }
  } else if (strategy === 'structured') {
    const breaking = gt.is_breaking ? 'Yes' : 'No';
    rawOutput = `1. What changed: ${gt.action_required}\n2. Is this a breaking change? ${breaking}${gt.breaking_reason ? ` - ${gt.breaking_reason}` : ''}\n3. Who is affected: Consumers of ${gt.affected_endpoints.join(', ') || 'this API'}\n4. Action: ${gt.action_required}`;
  } else {
    // JSON strategy
    parsed = {
      severity: gt.severity === 'none' ? 'low' : gt.severity,
      what_changed: gt.action_required,
      is_breaking: gt.is_breaking,
      breaking_reason: gt.breaking_reason,
      affected_endpoints: gt.affected_endpoints,
      action_required: gt.action_required,
      code_before: null,
      code_after: null,
      confidence: gt.cosmetic_only ? 0.95 : 0.85,
      deadline: null,
    };
    rawOutput = JSON.stringify(parsed, null, 2);
  }
  
  return {
    strategy,
    model,
    entry_id: entry.id,
    raw_output: rawOutput,
    parsed_output: parsed,
    latency_ms: Math.round(latency),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: estimateCost(model, inputTokens, outputTokens),
    timestamp: new Date().toISOString(),
  };
}

function stubGPTResult(entry: ChangelogEntry, strategy: StrategyName): PromptResult {
  return {
    strategy,
    model: 'gpt-4o-mini-stub',
    entry_id: entry.id,
    raw_output: '[GPT STUB - not yet implemented]',
    parsed_output: null,
    latency_ms: 0,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost_usd: 0,
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  CHIRRI LLM SUMMARIZER PROTOTYPE');
  console.log('═══════════════════════════════════════════');
  
  // Load fixtures
  const allEntries = loadFixtures();
  const entries = allEntries.slice(0, Math.min(limit, allEntries.length));
  console.log(`\nLoaded ${allEntries.length} fixtures, testing ${entries.length}`);
  
  const models = modelFilter ? MODELS.filter(m => m.includes(modelFilter)) : MODELS;
  const strategies = strategyFilter ? [strategyFilter] : STRATEGIES;
  
  console.log(`Models: ${models.join(', ')}`);
  console.log(`Strategies: ${strategies.join(', ')}`);
  console.log(`Total tests: ${entries.length} × ${strategies.length} × ${models.length} = ${entries.length * strategies.length * models.length}`);
  
  if (dryRun) {
    console.log('\n[DRY RUN] Would run the above tests. Exiting.');
    return;
  }
  
  // Ensure results dir exists
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }
  
  // Initialize Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const useMock = !apiKey || args.includes('--mock');
  
  let client: Anthropic | null = null;
  if (!useMock) {
    client = new Anthropic({ apiKey });
  } else {
    console.log('\n⚠️  No ANTHROPIC_API_KEY found. Running in MOCK mode with simulated responses.');
    console.log('   Set ANTHROPIC_API_KEY to run live tests.\n');
  }
  
  const allResults: PromptResult[] = [];
  const allScores: EvaluationScore[] = [];
  let testNum = 0;
  const totalTests = entries.length * strategies.length * models.length;
  
  for (const entry of entries) {
    for (const strategy of strategies) {
      for (const model of models) {
        testNum++;
        const prefix = `[${testNum}/${totalTests}]`;
        
        try {
          console.log(`${prefix} ${entry.id} | ${strategy} | ${model.split('-').slice(0, 3).join('-')}...`);
          
          const result = useMock
            ? generateMockResult(entry, strategy, model)
            : await runLLM(client!, model, entry, strategy);
          allResults.push(result);
          
          const score = evaluate(entry, result);
          allScores.push(score);
          
          console.log(`  → Score: ${(score.overall_score * 100).toFixed(0)}% | ${result.latency_ms}ms | $${result.estimated_cost_usd.toFixed(6)} | Breaking: ${score.breaking_correct ? '✓' : '✗'}`);
          
          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          console.error(`  ✗ Error: ${err.message}`);
          // Continue with next test
        }
      }
    }
  }
  
  // Generate report
  console.log('\n\nGenerating report...');
  const report = generateReport(allScores, allResults);
  const reportText = formatReport(report);
  console.log(reportText);
  
  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  writeFileSync(
    join(RESULTS_DIR, `results-${timestamp}.json`),
    JSON.stringify({ results: allResults, scores: allScores, report }, null, 2)
  );
  
  writeFileSync(
    join(RESULTS_DIR, `report-${timestamp}.txt`),
    reportText
  );
  
  // Also save individual detailed results
  writeFileSync(
    join(RESULTS_DIR, `detailed-scores-${timestamp}.json`),
    JSON.stringify(allScores.map(s => ({
      ...s,
      result: allResults.find(r => r.entry_id === s.entry_id && r.model === s.model && r.strategy === s.strategy)
    })), null, 2)
  );
  
  console.log(`\nResults saved to ${RESULTS_DIR}/`);
  console.log(`  - results-${timestamp}.json`);
  console.log(`  - report-${timestamp}.txt`);
  console.log(`  - detailed-scores-${timestamp}.json`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
