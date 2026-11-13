import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

// Netlify's Next.js runtime builds and serves this app (ADR 012). Every page is
// still generated at build time.
const nextConfig: NextConfig = {
  // Pages keep the /<path>/ URLs they had as a static export.
  trailingSlash: true,
  pageExtensions: ['ts', 'tsx', 'mdx'],
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: { providerImportSource: '@mdx-js/react' },
});

export default withMDX(nextConfig);
