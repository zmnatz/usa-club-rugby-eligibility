import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

// Netlify's Next.js runtime builds and serves this app (ADR 012). Club and player pages
// are generated on first request (ADRs 014, 015), and so are a Locked Season's pages and
// its stats page (ADR 016). The all-seasons stats page is rendered on request and cached
// by the CDN until the next deploy (ADR 018); every other page at build time.

// A deployed page's function reads the published data over HTTP from its own deploy's copy
// of public/data on the CDN, so the function doesn't carry it (ADR 019). Next's trace finds
// the directory the build reads it from and would bundle all of it, so every route excludes
// it. DEPLOY_URL is the deploy's permalink, set by Netlify at build time, so a function reads
// its own deploy's data, never a later one's. A build without it (local, CI) reads the disk.
const DEPLOY_URL = process.env.DEPLOY_URL ?? '';

const nextConfig: NextConfig = {
  // Pages keep the /<path>/ URLs they had as a static export.
  trailingSlash: true,
  pageExtensions: ['ts', 'tsx', 'mdx'],
  env: { PUBLISHED_DATA_URL: DEPLOY_URL ? `${DEPLOY_URL.replace(/\/+$/, '')}/data` : '' },
  outputFileTracingExcludes: { '/**': ['./public/data/**'] },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: { providerImportSource: '@mdx-js/react' },
});

export default withMDX(nextConfig);
