import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

// Netlify's Next.js runtime builds and serves this app (ADR 012). Club and player pages
// are generated on first request (ADRs 014, 015); every other page at build time.
const nextConfig: NextConfig = {
  // Pages keep the /<path>/ URLs they had as a static export.
  trailingSlash: true,
  pageExtensions: ['ts', 'tsx', 'mdx'],
  // Each on-demand page's function reads the published data from disk at request time, so
  // it must carry the files it reads. The club page reads the index, the fixtures and the
  // club files, and never the Locked Seasons, which are most of public/data, nor the player
  // index. The player page also reads the player indexes and, for its past-season tabs,
  // the Locked Seasons.
  outputFileTracingIncludes: {
    '/club/[[]club[]]': ['./public/data/index.json', './public/data/fixtures.json', './public/data/clubs/*.json'],
    '/player/[[]player[]]': [
      './public/data/index.json',
      './public/data/fixtures.json',
      './public/data/players.json',
      './public/data/clubs/*.json',
      './public/data/seasons.json',
      './public/data/seasons/*.json',
    ],
  },
  outputFileTracingExcludes: {
    '/club/[[]club[]]': ['./public/data/seasons/**', './public/data/seasons.json', './public/data/players.json'],
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: { providerImportSource: '@mdx-js/react' },
});

export default withMDX(nextConfig);
