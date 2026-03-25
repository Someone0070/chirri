/**
 * Evaluator: Compare LLM output to ground truth and score results.
 */

import type { ChangelogEntry, PromptResult, StrategyName } from './prompts.js';

export interface EvaluationScore {
  entry_id: string;
  strategy: StrategyName;
  model: string;
  severity_correct: boolean;
  breaking_correct: boolean;
  hallucination_detected: boolean;
  cosmetic_correct: boolean | null; // null if not a cosmetic test case
  action_quality: 'good' | 'partial' | 'wrong' | 'missing';
  json_valid: boolean | null; // only for json strategy
  overall_score: number; // 0-1
  notes: string;
}

export function evaluate(
  entry: ChangelogEntry,
  result: PromptResult
): EvaluationScore {
  const gt = entry.ground_truth;
  const score: EvaluationScore = {
    entry_id: entry.id,
    strategy: result.strategy,
    model: result.model,
    severity_correct: false,
    breaking_correct: false,
    hallucination_detected: false,
    cosmetic_correct: null,
    action_quality: 'missing',
    json_valid: null,
    overall_score: 0,
    notes: '',
  };

  const output = result.raw_output.toLowerCase();

  if (result.strategy === 'json') {
    score.json_valid = result.parsed_output !== null && typeof result.parsed_output === 'object';
    
    if (score.json_valid && result.parsed_output) {
      const p = result.parsed_output;
      
      // Severity check
      score.severity_correct = checkSeverity(p.severity, gt.severity);
      
      // Breaking check
      score.breaking_correct = p.is_breaking === gt.is_breaking;
      
      // Action quality
      if (p.action_required) {
        if (gt.cosmetic_only && (
          p.action_required.toLowerCase().includes('no action') ||
          p.action_required.toLowerCase().includes('none') ||
          p.action_required.toLowerCase().includes('no changes')
        )) {
          score.action_quality = 'good';
        } else if (!gt.cosmetic_only && p.action_required.length > 10) {
          score.action_quality = 'good';
        } else {
          score.action_quality = 'partial';
        }
      }
      
      // Cosmetic detection
      if (gt.cosmetic_only) {
        score.cosmetic_correct = (
          p.severity === 'low' || p.severity === 'none'
        ) && !p.is_breaking;
      }
      
      // Hallucination: check if mentioned endpoints not in ground truth
      if (p.affected_endpoints && gt.affected_endpoints.length > 0) {
        const gtEndpoints = gt.affected_endpoints.map((e: string) => e.toLowerCase());
        const extraEndpoints = (p.affected_endpoints as string[]).filter(
          (e: string) => !gtEndpoints.some((ge: string) => e.toLowerCase().includes(ge) || ge.includes(e.toLowerCase()))
        );
        score.hallucination_detected = extraEndpoints.length > 2; // some tolerance
      }
    }
  } else {
    // For basic and structured strategies, do text-based analysis
    
    // Breaking check via text
    const mentionsBreaking = output.includes('breaking');
    if (gt.is_breaking) {
      score.breaking_correct = mentionsBreaking;
    } else {
      // Non-breaking: should NOT say "breaking" in a definitive way, or should say "not breaking"
      score.breaking_correct = !mentionsBreaking || 
        output.includes('not breaking') || 
        output.includes('non-breaking') || 
        output.includes('not a breaking');
    }
    
    // Severity - approximate from text
    if (gt.severity === 'critical' || gt.severity === 'high') {
      score.severity_correct = output.includes('critical') || output.includes('breaking') || output.includes('urgent') || output.includes('high');
    } else if (gt.severity === 'low' || gt.severity === 'none') {
      score.severity_correct = output.includes('minor') || output.includes('cosmetic') || 
        output.includes('no action') || output.includes('low') ||
        output.includes('formatting') || output.includes('non-breaking');
    } else {
      score.severity_correct = true; // medium is hard to check in free text
    }
    
    // Cosmetic detection
    if (gt.cosmetic_only) {
      score.cosmetic_correct = output.includes('cosmetic') || 
        output.includes('formatting') || 
        output.includes('no action') || 
        output.includes('no functional') ||
        output.includes('whitespace') ||
        output.includes('no impact');
    }
    
    // Action quality - basic check
    if (result.strategy === 'structured') {
      const hasAction = output.includes('action') || output.includes('should') || output.includes('need to') || output.includes('update');
      score.action_quality = hasAction ? 'good' : 'partial';
    } else {
      score.action_quality = output.length > 50 ? 'partial' : 'missing';
    }
    
    // Hallucination: harder to detect in free text, basic heuristic
    score.hallucination_detected = false;
  }

  // Overall score (0-1)
  let total = 0;
  let max = 0;
  
  max += 2;
  if (score.severity_correct) total += 2;
  
  max += 3;
  if (score.breaking_correct) total += 3;
  
  max += 2;
  if (!score.hallucination_detected) total += 2;
  
  if (score.cosmetic_correct !== null) {
    max += 2;
    if (score.cosmetic_correct) total += 2;
  }
  
  max += 1;
  if (score.action_quality === 'good') total += 1;
  else if (score.action_quality === 'partial') total += 0.5;
  
  if (score.json_valid !== null) {
    max += 1;
    if (score.json_valid) total += 1;
  }
  
  score.overall_score = max > 0 ? total / max : 0;
  
  return score;
}

function checkSeverity(predicted: string | undefined, expected: string): boolean {
  if (!predicted) return false;
  const p = predicted.toLowerCase();
  const e = expected.toLowerCase();
  
  // Exact match
  if (p === e) return true;
  
  // Close enough: none ≈ low, high ≈ critical
  const severityMap: Record<string, number> = {
    'none': 0, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4
  };
  const pVal = severityMap[p] ?? -1;
  const eVal = severityMap[e] ?? -1;
  
  return Math.abs(pVal - eVal) <= 1;
}
