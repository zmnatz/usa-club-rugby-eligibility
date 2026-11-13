import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

// Netlify's Next.js runtime builds and serves this app (ADR 012). Club pages are
// generated on first request (ADR 013); every other page at build time.
const nextConfig: NextConfig = {
  // Pages keep the /<path>/ URLs they had as a static export.
  trailingSlash: true,
  pageExtensions: ['ts', 'tsx', 'mdx'],
  // The club page's function reads the published data from disk at request time, so it
  // must carry the files it reads and nothing else: the index, the fixtures and the
  // club files. The Locked Seasons are most of public/data and it never opens them.
  outputFileTracingIncludes: {
    '/club/[[]club[]]': ['./public/data/index.json', './public/data/fixtures.json', './public/data/clubs/*.json'],
  },
  outputFileTracingExcludes: {
    '/club/[[]club[]]': ['./public/data/seasons/**', './public/data/seasons.json'],
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: { providerImportSource: '@mdx-js/react' },
});

export default withMDX(nextConfig);
