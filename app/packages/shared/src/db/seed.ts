import 'dotenv/config';
import { db, pool } from './index.js';
import * as schema from './schema.js';
import { userId, urlId, sharedUrlId, changeId, userChangeId, forecastId, userForecastId, baselineId } from '../utils/id.js';
import { hashUrl, normalizeMonitorUrl, extractDomain, extractPath } from '../utils/url.js';

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create test user
  const testUserId = userId();
  await db.insert(schema.users).values({
    id: testUserId,
    email: 'test@chirri.io',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$placeholder', // not a real hash
    name: 'Test User',
    plan: 'personal',
    emailVerified: true,
    timezone: 'America/New_York',
    notificationDefaults: {
      email: true,
      min_severity: 'medium',
    },
  });
  console.log(`  ✓ Created test user: ${testUserId}`);

  // 2. Create shared URLs + URLs
  const testUrls = [
    { url: 'https://api.stripe.com/v1/charges', name: 'Stripe Charges API' },
    { url: 'https://api.openai.com/v1/models', name: 'OpenAI Models API' },
    { url: 'https://api.github.com/repos/octocat/hello-world', name: 'GitHub Repo API' },
  ];

  const createdUrlIds: string[] = [];

  for (const testUrl of testUrls) {
    const normalized = normalizeMonitorUrl(testUrl.url);
    const hash = hashUrl(normalized);
    const sUrlId = sharedUrlId();
    const uId = urlId();

    await db.insert(schema.sharedUrls).values({
      id: sUrlId,
      urlHash: hash,
      url: normalized,
      domain: extractDomain(normalized),
      effectiveInterval: '24h',
      subscriberCount: 1,
    });

    await db.insert(schema.urls).values({
      id: uId,
      userId: testUserId,
      url: normalized,
      urlHash: hash,
      name: testUrl.name,
      checkInterval: '24h',
      status: 'active',
      sharedUrlId: sUrlId,
      parsedDomain: extractDomain(normalized),
      parsedPath: extractPath(normalized),
    });

    createdUrlIds.push(uId);
    console.log(`  ✓ Created URL: ${testUrl.name} (${uId})`);
  }

  // 3. Create a sample change
  const sampleChangeId = changeId();
  // Get the first shared_url_id for the change
  const firstUrl = await db.query.urls.findFirst({
    where: (t, { eq }) => eq(t.id, createdUrlIds[0]),
  });

  if (firstUrl?.sharedUrlId) {
    await db.insert(schema.changes).values({
      id: sampleChangeId,
      sharedUrlId: firstUrl.sharedUrlId,
      changeType: 'schema',
      severity: 'medium',
      confidence: 85,
      summary: 'New field "payment_method_configuration" added to /v1/charges response',
      diff: {
        added: [{ path: '$.data[0].payment_method_configuration', type: 'string' }],
        removed: [],
        modified: [],
      },
      previousBodyR2Key: 'r2://test/previous.json',
      currentBodyR2Key: 'r2://test/current.json',
      confirmationStatus: 'confirmed',
    });

    await db.insert(schema.userChanges).values({
      id: userChangeId(),
      userId: testUserId,
      changeId: sampleChangeId,
      urlId: createdUrlIds[0],
      workflowState: 'new',
    });

    console.log(`  ✓ Created sample change: ${sampleChangeId}`);
  }

  // 4. Create a sample forecast
  if (firstUrl?.sharedUrlId) {
    const sampleForecastId = forecastId();
    await db.insert(schema.forecasts).values({
      id: sampleForecastId,
      sharedUrlId: firstUrl.sharedUrlId,
      signalType: 'deprecation_header',
      alertLevel: 'forecast',
      severity: 'high',
      title: 'Stripe API v2023-10-16 deprecation announced',
      description: 'Stripe has announced deprecation of API version 2023-10-16. Migrate to 2024-04-10 by July 2025.',
      deadline: new Date('2025-07-01'),
      source: 'header',
      sourceUrl: 'https://stripe.com/docs/upgrades',
      confidence: 90,
      dedupKey: 'stripe-api-v2023-10-16-deprecation',
      status: 'active',
    });

    await db.insert(schema.userForecasts).values({
      id: userForecastId(),
      userId: testUserId,
      forecastId: sampleForecastId,
      urlId: createdUrlIds[0],
    });

    console.log(`  ✓ Created sample forecast: ${sampleForecastId}`);
  }

  console.log('\n🌸 Seed complete!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
