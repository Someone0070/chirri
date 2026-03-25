import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary
        sakura: '#FFB7C5',
        snow: '#FAFAFA',
        night: '#0F0F0F',
        ink: '#1A1A1A',

        // Secondary
        blossom: '#FFD4DE',
        petal: '#FF8FA3',
        stone: '#6B7280',
        mist: '#F3F4F6',
        charcoal: '#1C1C1C',
        ash: '#2A2A2A',

        // Semantic
        bamboo: '#10B981',
        amber: '#F59E0B',
        vermillion: '#EF4444',
        sky: '#3B82F6',
        orchid: '#8B5CF6',

        // Severity
        severity: {
          critical: '#EF4444',
          high: '#F97316',
          medium: '#F59E0B',
          low: '#10B981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        jp: ['Noto Sans JP', 'sans-serif'],
      },
      fontSize: {
        display: ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        h1: ['2rem', { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        h3: ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.005em', fontWeight: '500' }],
        h4: ['1rem', { lineHeight: '1.5', fontWeight: '500' }],
        body: ['0.875rem', { lineHeight: '1.6' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5' }],
        caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        code: ['0.8125rem', { lineHeight: '1.5' }],
        'code-sm': ['0.75rem', { lineHeight: '1.4' }],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 6px -1px rgba(0,0,0,0.1)',
        lg: '0 10px 15px -3px rgba(0,0,0,0.1)',
        glow: '0 0 20px rgba(255,183,197,0.3)',
      },
      spacing: {
        '0': '0px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
      },
    },
  },
  plugins: [],
};

export default config;
