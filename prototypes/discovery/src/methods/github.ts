import { MethodResult, DiscoveryResult } from '../types.js';
import { safeGet, getCompanyName, getBaseDomain } from '../utils.js';

export async function githubDiscovery(domain: string): Promise<MethodResult> {
  const results: DiscoveryResult[] = [];
  const company = getCompanyName(domain);
  const baseDomain = getBaseDomain(domain);

  // 1. Check if github.com/{company} org exists
  const orgUrl = `https://github.com/${company}`;
  const orgRes = await safeGet(orgUrl);
  
  if (orgRes?.ok) {
    // 2. Search for repos with "api", "docs", "openapi" in the name via GitHub search
    const searchUrl = `https://api.github.com/search/repositories?q=org:${company}+openapi+OR+api-docs+OR+changelog&per_page=5&sort=stars`;
    const searchRes = await safeGet(searchUrl);

    if (searchRes?.ok) {
      try {
        const data = JSON.parse(searchRes.text);
        for (const repo of (data.items || []).slice(0, 5)) {
          // Check for releases
          const releasesUrl = `https://github.com/${repo.full_name}/releases`;
          results.push({
            url: repo.html_url,
            method: 'github',
            confidence: 0.7,
            type: repo.name.includes('openapi') || repo.name.includes('swagger') ? 'openapi' : 'docs',
            meta: { repo: repo.full_name, description: (repo.description || '').slice(0, 200) },
          });
        }
      } catch {}
    }

    // 3. Also try common repo names
    const commonRepos = [`${company}-openapi`, `${company}-api`, 'openapi', 'api-docs', 'docs'];
    for (const repo of commonRepos) {
      const repoUrl = `https://github.com/${company}/${repo}`;
      const repoRes = await safeGet(repoUrl);
      if (repoRes?.ok && repoRes.text.includes(baseDomain)) {
        results.push({
          url: repoUrl,
          method: 'github',
          confidence: 0.75,
          type: repo.includes('openapi') ? 'openapi' : 'docs',
          meta: { repo: `${company}/${repo}` },
        });
      }
    }

    // 4. Check for releases page on main repo
    const mainReleasesUrl = `https://github.com/${company}/${company}/releases`;
    const mainReleasesRes = await safeGet(mainReleasesUrl);
    if (mainReleasesRes?.ok && mainReleasesRes.text.includes('release')) {
      results.push({
        url: mainReleasesUrl,
        method: 'github',
        confidence: 0.6,
        type: 'changelog',
        meta: { repo: `${company}/${company}` },
      });
    }
  }

  return { method: 'github', results };
}
