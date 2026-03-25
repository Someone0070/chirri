/**
 * LLM analysis pipeline - uses OpenAI GPT-4o-mini / GPT-4o
 */
import fetch from 'node-fetch';

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

interface LLMResult {
  model: string;
  severity: string;
  is_breaking: boolean;
  what_changed: string;
  confidence: number;
  action_required: string;
  raw_response: string;
  cost: number;
}

// Cost per million tokens
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || { input: 1.0, output: 5.0 };
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const resp = await fetch(OPENAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} ${text}`);
  }

  const data = await resp.json() as any;
  return {
    content: data.choices?.[0]?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

function buildPrompt(diffText: string, beforeText: string, afterText: string): { system: string; user: string } {
  return {
    system: `You are an API change detection system. Analyze diffs of API documentation and produce structured JSON.
Rules:
1) Only report changes explicitly visible in the provided diff.
2) Never infer or speculate about changes not shown.
3) For cosmetic-only changes (whitespace, formatting, copyright year), set severity to "low" and is_breaking to false.
4) Rate your confidence from 0.0 to 1.0.`,
    user: `Analyze this API documentation change.

DIFF:
${diffText.substring(0, 6000)}

BEFORE (text excerpt):
${beforeText.substring(0, 2000)}

AFTER (text excerpt):
${afterText.substring(0, 2000)}

Respond with ONLY valid JSON:
{
  "severity": "critical|high|medium|low",
  "what_changed": "...",
  "is_breaking": true/false,
  "breaking_reason": "..." or null,
  "action_required": "...",
  "confidence": 0.0-1.0
}`,
  };
}

/**
 * Analyze a diff with LLM - starts with gpt-4o-mini, escalates if needed
 */
export async function analyzeDiff(
  apiKey: string,
  diffText: string,
  beforeText: string,
  afterText: string,
): Promise<LLMResult> {
  const { system, user } = buildPrompt(diffText, beforeText, afterText);

  // First pass: gpt-4o-mini
  const miniResult = await callOpenAI(apiKey, 'gpt-4o-mini', system, user);
  const miniCost = estimateCost('gpt-4o-mini', miniResult.inputTokens, miniResult.outputTokens);

  let parsed: any;
  try {
    // Try to extract JSON from response (might have markdown wrapper)
    const jsonMatch = miniResult.content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    parsed = null;
  }

  const needsEscalation = parsed && (
    parsed.is_breaking === true ||
    (parsed.confidence !== undefined && parsed.confidence < 0.8)
  );

  if (needsEscalation) {
    console.log(`  ↑ Escalating to gpt-4o (breaking=${parsed.is_breaking}, confidence=${parsed.confidence})`);
    try {
      const fullResult = await callOpenAI(apiKey, 'gpt-4o', system, user);
      const fullCost = estimateCost('gpt-4o', fullResult.inputTokens, fullResult.outputTokens);

      let fullParsed: any;
      try {
        const jsonMatch = fullResult.content.match(/\{[\s\S]*\}/);
        fullParsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        fullParsed = parsed; // fallback to mini result
      }

      return {
        model: 'gpt-4o',
        severity: fullParsed?.severity || 'unknown',
        is_breaking: fullParsed?.is_breaking || false,
        what_changed: fullParsed?.what_changed || '',
        confidence: fullParsed?.confidence || 0,
        action_required: fullParsed?.action_required || '',
        raw_response: fullResult.content,
        cost: miniCost + fullCost,
      };
    } catch (e) {
      console.log(`  ⚠ Escalation failed: ${e}. Using mini result.`);
    }
  }

  return {
    model: 'gpt-4o-mini',
    severity: parsed?.severity || 'unknown',
    is_breaking: parsed?.is_breaking || false,
    what_changed: parsed?.what_changed || '',
    confidence: parsed?.confidence || 0,
    action_required: parsed?.action_required || '',
    raw_response: miniResult.content,
    cost: miniCost,
  };
}
