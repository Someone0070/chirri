import type { MethodResult } from '../types.js';
import { safeGet, parallelLimit } from '../utils.js';

const OPENAPI_PATHS = [
  '/openapi.json', '/openapi.yaml', '/swagger.json',
  '/api-docs', '/api/swagger', '/.well-known/openapi.json',
  '/v1/openapi.yaml', '/v1/openapi.json',
  '/v2/api-docs', '/v3/api-docs',
  '/swagger-ui.html',
];

export async function openapiProbe(domain: string, extraHosts: string[] = []): Promise<MethodResult> {
  const results: MethodResult['results'] = [];
  const hosts = [`https://${domain}`, ...extraHosts.map((h) => h.startsWith('https://') ? h : `https://${h}`)];
  const hostsToProbe = hosts.slice(0, 3);

  const tasks: (() => Promise<void>)[] = [];
  for (const host of hostsToProbe) {
    for (const path of OPENAPI_PATHS) {
      tasks.push(async () => {
        const url = `${host}${path}`;
        const res = await safeGet(url);
        if (!res || !res.ok) return;

        const text = res.text.slice(0, 2000);
        const isOpenApi = text.includes('"openapi"') || text.includes('"swagger"') ||
                          text.includes('openapi:') || text.includes('swagger:') ||
                          text.includes('swagger-ui') || text.includes('redoc');

        if (isOpenApi) {
          const meta: Record<string, string> = {};
          try {
            if (text.startsWith('{')) {
              const json = JSON.parse(res.text.slice(0, 10000));
              if (json.info?.title) meta.title = json.info.title;
              if (json.info?.version) meta.version = json.info.version;
            }
          } catch { /* ignore */ }

          results.push({ url, method: 'openapi_probe', confidence: 0.95, type: 'openapi', meta });
        }
      });
    }
  }

  await parallelLimit(tasks, 8);
  return { method: 'openapi_probe', results };
}
