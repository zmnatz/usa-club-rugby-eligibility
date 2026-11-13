import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

// Netlify's Next.js runtime builds and serves this app (ADR 012). Club and player pages
// are generated on first request (ADRs 014, 015), and so are a Locked Season's pages
// (ADR 016); every other page at build time.

// A Locked Season's page and its clubs' read the list of seasons and that season's file,
// and nothing of the current season's nor the seasons' player indexes.
const SEASON_PAGE_FILES = ['./public/data/seasons.json', './public/data/seasons/*.json'];
// A player's pages read the player indexes to find the seasons and clubs they're in, then
// those clubs' files and Locked Seasons.
const PLAYER_PAGE_FILES = [
  './public/data/index.json',
  './public/data/fixtures.json',
  './public/data/players.json',
  './public/data/clubs/*.json',
  ...SEASON_PAGE_FILES,
];
const SEASON_PAGE_EXCLUDES = [
  './public/data/index.json',
  './public/data/fixtures.json',
  './public/data/players.json',
  './public/data/clubs/**',
  './public/data/seasons/*.players.json',
];

const nextConfig: NextConfig = {
  // Pages keep the /<path>/ URLs they had as a static export.
  trailingSlash: true,
  pageExtensions: ['ts', 'tsx', 'mdx'],
  // Each on-demand page's function reads the published data from disk at request time, so
  // it must carry the files it reads. The club page reads the index, the fixtures and the
  // club files, and never the Locked Seasons, which are most of public/data, nor the player
  // index. The player pages also read the player indexes and the Locked Seasons.
  outputFileTracingIncludes: {
    '/club/[[]club[]]': ['./public/data/index.json', './public/data/fixtures.json', './public/data/clubs/*.json'],
    '/player/[[]player[]]': PLAYER_PAGE_FILES,
    '/player/[[]player[]]/[[]season[]]': PLAYER_PAGE_FILES,
    '/season/[[]season[]]': SEASON_PAGE_FILES,
    '/season/[[]season[]]/[[]club[]]': SEASON_PAGE_FILES,
  },
  outputFileTracingExcludes: {
    '/club/[[]club[]]': ['./public/data/seasons/**', './public/data/seasons.json', './public/data/players.json'],
    '/season/[[]season[]]': SEASON_PAGE_EXCLUDES,
    '/season/[[]season[]]/[[]club[]]': SEASON_PAGE_EXCLUDES,
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: { providerImportSource: '@mdx-js/react' },
});

export default withMDX(nextConfig);
