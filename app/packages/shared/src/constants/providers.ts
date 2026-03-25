export interface ProviderProfile {
  slug: string;
  name: string;
  company?: string;
  domains: string[];
  sources: {
    type: string;
    name: string;
    url: string;
    monitoring_method: string;
    default_interval: string;
    bundled: boolean;
  }[];
  packages?: {
    npm?: string[];
    pypi?: string[];
  };
}

export const PROVIDER_PROFILES: ProviderProfile[] = [
  {
    slug: 'stripe',
    name: 'Stripe',
    domains: ['api.stripe.com', 'stripe.com'],
    sources: [
      {
        type: 'openapi_spec',
        name: 'Stripe OpenAPI Spec',
        url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
        monitoring_method: 'spec_diff',
        default_interval: '6h',
        bundled: true,
      },
      {
        type: 'changelog',
        name: 'Stripe Changelog',
        url: 'https://stripe.com/docs/changelog',
        monitoring_method: 'html_diff',
        default_interval: '2h',
        bundled: true,
      },
      {
        type: 'status_page',
        name: 'Stripe Status',
        url: 'https://status.stripe.com/api/v2/status.json',
        monitoring_method: 'json_field',
        default_interval: '5m',
        bundled: true,
      },
    ],
    packages: { npm: ['stripe'], pypi: ['stripe'] },
  },
  {
    slug: 'openai',
    name: 'OpenAI',
    domains: ['api.openai.com'],
    sources: [
      {
        type: 'changelog',
        name: 'OpenAI Changelog',
        url: 'https://platform.openai.com/docs/changelog',
        monitoring_method: 'html_diff',
        default_interval: '2h',
        bundled: true,
      },
      {
        type: 'status_page',
        name: 'OpenAI Status',
        url: 'https://status.openai.com/api/v2/status.json',
        monitoring_method: 'json_field',
        default_interval: '5m',
        bundled: true,
      },
    ],
    packages: { npm: ['openai'], pypi: ['openai'] },
  },
  {
    slug: 'github',
    name: 'GitHub',
    domains: ['api.github.com', 'github.com'],
    sources: [
      {
        type: 'changelog',
        name: 'GitHub Changelog',
        url: 'https://github.blog/changelog/',
        monitoring_method: 'html_diff',
        default_interval: '2h',
        bundled: true,
      },
      {
        type: 'status_page',
        name: 'GitHub Status',
        url: 'https://www.githubstatus.com/api/v2/status.json',
        monitoring_method: 'json_field',
        default_interval: '5m',
        bundled: true,
      },
    ],
    packages: { npm: ['@octokit/rest', 'octokit'], pypi: ['PyGithub'] },
  },
];
