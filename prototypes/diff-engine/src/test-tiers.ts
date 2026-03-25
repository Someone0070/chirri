#!/usr/bin/env node
/**
 * Test the 3-tier fetch strategy against 10 target URLs
 */

import { fetchUrl, tier3Needed } from './fetcher.js';

const TEST_URLS = [
  'https://docs.stripe.com/api/charges',
  'https://docs.github.com/en/rest/repos',
  'https://developers.cloudflare.com/api',
  'https://docs.sendgrid.com/api-reference/mail-send/mail-send',
  'https://docs.anthropic.com/en/api',
  'https://docs.pinecone.io/reference/api',
  'https://platform.openai.com/docs/api-reference',
  'https://docs.shopify.com/api/admin-rest',
  'https://docs.pagerduty.com/docs/events-api-v2',
  'https://docs.datadoghq.com/api/latest',
];

interface Result {
  url: string;
  tier: number;
  textChars: number;
  success: boolean;
  timeMs: number;
  error?: string;
}

async function main() {
  console.log('🔍 3-Tier Fetch Strategy Test\n');
  console.log('─'.repeat(100));
  console.log(
    'URL'.padEnd(55) +
    'Tier'.padEnd(6) +
    'Text Chars'.padEnd(12) +
    'Time'.padEnd(10) +
    'Status'
  );
  console.log('─'.repeat(100));

  const results: Result[] = [];
  const tierCounts = { 1: 0, 2: 0, 3: 0 };

  for (const url of TEST_URLS) {
    try {
      const result = await fetchUrl(url);
      const textLen = result.textOnly.length;
      const tier = result.fetchTier;
      const success = textLen > 500 && !result.error;

      tierCounts[tier]++;
      results.push({ url, tier, textChars: textLen, success, timeMs: result.fetchTimeMs, error: result.error });

      const shortUrl = url.replace('https://', '').substring(0, 53);
      console.log(
        shortUrl.padEnd(55) +
        `T${tier}`.padEnd(6) +
        `${textLen}`.padEnd(12) +
        `${result.fetchTimeMs}ms`.padEnd(10) +
        (success ? '✅' : `❌ ${result.error || 'too short'}`)
      );
    } catch (err: any) {
      results.push({ url, tier: 3, textChars: 0, success: false, timeMs: 0, error: err.message });
      const shortUrl = url.replace('https://', '').substring(0, 53);
      console.log(
        shortUrl.padEnd(55) +
        'T3'.padEnd(6) +
        '0'.padEnd(12) +
        '-'.padEnd(10) +
        `❌ ${err.message}`
      );
    }
  }

  console.log('─'.repeat(100));
  console.log(`\n📊 Tier Summary:`);
  console.log(`   Tier 1 (basic fetch):    ${tierCounts[1]} URLs`);
  console.log(`   Tier 2 (browser fetch):  ${tierCounts[2]} URLs`);
  console.log(`   Tier 3 (render needed):  ${tierCounts[3]} URLs`);

  const successCount = results.filter(r => r.success).length;
  console.log(`\n   Success rate: ${successCount}/${results.length} (${((successCount / results.length) * 100).toFixed(0)}%)`);

  if (tier3Needed.length > 0) {
    console.log(`\n⚠️  URLs needing Tier 3 rendering:`);
    for (const t of tier3Needed) {
      console.log(`   ${t.url} (${t.textLength} chars)`);
    }
  }
}

main().catch(console.error);
