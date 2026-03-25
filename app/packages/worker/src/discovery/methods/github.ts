import type { MethodResult, DiscoveryResult } from '../types.js';
import { safeGet, getCompanyName, getBaseDomain } from '../utils.js';

export async function githubDiscovery(domain: string): Promise<MethodResult> {
  const results: DiscoveryResult[] = [];
  const company = getCompanyName(domain);
  const baseDomain = getBaseDomain(domain);

  const orgUrl = `https://github.com/${company}`;
  const orgRes = await safeGet(orgUrl);

  if (orgRes?.ok) {
    const searchUrl = `https://api.github.com/search/repositories?q=org:${company}+openapi+OR+api-docs+OR+changelog&per_page=5&sort=stars`;
    const searchRes = await safeGet(searchUrl);

    if (searchRes?.ok) {
      try {
        const data = JSON.parse(searchRes.text) as { items?: Array<{ full_name: string; html_url: string; name: string; description?: string }> };
        for (const repo of (data.items || []).slice(0, 5)) {
          results.push({
            url: repo.html_url, method: 'github', confidence: 0.7,
            type: repo.name.includes('openapi') || repo.name.includes('swagger') ? 'openapi' : 'docs',
            meta: { repo: repo.full_name, description: (repo.description || '').slice(0, 200) },
          });
        }
      } catch { /* ignore */ }
    }

    const commonRepos = [`${company}-openapi`, `${company}-api`, 'openapi', 'api-docs', 'docs'];
    for (const repo of commonRepos) {
      const repoUrl = `https://github.com/${company}/${repo}`;
      const repoRes = await safeGet(repoUrl);
      if (repoRes?.ok && repoRes.text.includes(baseDomain)) {
        results.push({
          url: repoUrl, method: 'github', confidence: 0.75,
          type: repo.includes('openapi') ? 'openapi' : 'docs',
          meta: { repo: `${company}/${repo}` },
        });
      }
    }

    const mainReleasesUrl = `https://github.com/${company}/${company}/releases`;
    const mainReleasesRes = await safeGet(mainReleasesUrl);
    if (mainReleasesRes?.ok && mainReleasesRes.text.includes('release')) {
      results.push({
        url: mainReleasesUrl, method: 'github', confidence: 0.6,
        type: 'changelog', meta: { repo: `${company}/${company}` },
      });
    }
  }

  return { method: 'github', results };
}
