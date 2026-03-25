import type { MethodResult } from '../types.js';
import { safeHead, getBaseDomain, classifyUrl, parallelLimit } from '../utils.js';

const SUBDOMAINS = ['docs', 'developer', 'developers', 'api', 'dev', 'reference', 'status', 'changelog'];

export async function subdomainProbe(domain: string): Promise<MethodResult> {
  const baseDomain = getBaseDomain(domain);
  const results: MethodResult['results'] = [];

  const tasks = SUBDOMAINS.map((sub) => async () => {
    const url = `https://${sub}.${baseDomain}`;
    const res = await safeHead(url);
    if (res && res.ok) {
      results.push({ url, method: 'subdomain', confidence: 0.9, type: classifyUrl(url) });
    }
  });

  await parallelLimit(tasks, 6);
  return { method: 'subdomain', results };
}
