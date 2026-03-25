import type { MethodResult } from '../types.js';
import { safeGet } from '../utils.js';

interface PlatformMatch { name: string; confidence: number; }

const PLATFORM_CHECKS: { name: string; check: (html: string, headers: Headers) => boolean }[] = [
  { name: 'readme.io', check: (html, headers) => html.includes('readme.io') || html.includes('Readme.io') || [...headers.keys()].some((k) => k.toLowerCase().startsWith('x-readme')) },
  { name: 'gitbook', check: (html, headers) => html.includes('gitbook.io') || html.includes('GitBook') || [...headers.keys()].some((k) => k.toLowerCase().startsWith('x-gitbook')) },
  { name: 'mintlify', check: (html) => html.includes('mintlify') || html.includes('Mintlify') },
  { name: 'docusaurus', check: (html) => html.includes('__docusaurus') || html.includes('Docusaurus') },
  { name: 'stoplight', check: (html) => html.includes('stoplight.io') || html.includes('Stoplight') },
  { name: 'redoc', check: (html) => html.includes('redoc.standalone') || html.includes('ReDoc') },
  { name: 'swagger-ui', check: (html) => html.includes('swagger-ui') || html.includes('SwaggerUI') },
];

export async function platformFingerprint(domain: string, extraUrls: string[] = []): Promise<MethodResult> {
  const results: MethodResult['results'] = [];
  const urlsToCheck = [`https://${domain}`, ...extraUrls.slice(0, 3)];
  const detectedPlatforms: PlatformMatch[] = [];

  for (const url of urlsToCheck) {
    const res = await safeGet(url);
    if (!res || !res.ok) continue;
    for (const { name, check } of PLATFORM_CHECKS) {
      if (check(res.text, res.headers)) {
        if (!detectedPlatforms.some((p) => p.name === name)) {
          detectedPlatforms.push({ name, confidence: 0.85 });
        }
      }
    }
  }

  for (const platform of detectedPlatforms) {
    results.push({
      url: urlsToCheck[0], method: 'platform_fingerprint', confidence: platform.confidence,
      type: 'docs', meta: { platform: platform.name },
    });
  }

  return { method: 'platform_fingerprint', results };
}
