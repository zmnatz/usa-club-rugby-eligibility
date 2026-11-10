import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

// GitHub Pages serves a project site under /<repo>/. BASE_PATH lets a fork or a
// custom domain change it; local dev serves from the root.
const basePath = process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/usa-club-rugby-eligibility' : '');

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  // With output: 'export', a custom distDir is the export destination.
  distDir: 'dist',
  // Pages serves /<club-key>/ from <club-key>/index.html.
  trailingSlash: true,
  images: { unoptimized: true },
  pageExtensions: ['ts', 'tsx', 'mdx'],
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: { providerImportSource: '@mdx-js/react' },
});

export default withMDX(nextConfig);
