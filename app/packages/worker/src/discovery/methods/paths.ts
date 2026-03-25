import type { MethodResult } from '../types.js';
import { safeHead, classifyUrl, parallelLimit } from '../utils.js';

const PATHS = [
  '/docs', '/documentation', '/api', '/api-docs', '/api-reference', '/reference',
  '/developers', '/developer', '/dev',
  '/changelog', '/changes', '/whats-new', '/release-notes', '/releases', '/updates',
  '/status', '/health', '/system-status',
  '/blog/changelog', '/blog/engineering', '/blog/updates',
  '/guides', '/v1/docs', '/v2/docs',
];

export async function pathProbe(domain: string, extraHosts: string[] = []): Promise<MethodResult> {
  const results: MethodResult['results'] = [];
  const hosts = [`https://${domain}`, ...extraHosts.map((h) => h.startsWith('https://') ? h : `https://${h}`)];
  const hostsToProbe = hosts.slice(0, 4);

  const tasks: (() => Promise<void>)[] = [];
  for (const host of hostsToProbe) {
    for (const path of PATHS) {
      tasks.push(async () => {
        const url = `${host}${path}`;
        const res = await safeHead(url);
        if (res && res.ok) {
          results.push({ url, method: 'path_probe', confidence: 0.7, type: classifyUrl(url) });
        }
      });
    }
  }

  await parallelLimit(tasks, 10);
  return { method: 'path_probe', results };
}
