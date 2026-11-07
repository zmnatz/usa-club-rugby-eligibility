import path from 'node:path';
import mdx from '@mdx-js/rollup';
import yaml from '@rollup/plugin-yaml';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves a project site under /<repo>/. BASE_PATH lets a fork or a
// custom domain change it; local dev serves from the root.
const base = process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/usa-club-rugby-eligibility/' : '/');

export default defineConfig({
  base,
  plugins: [{ enforce: 'pre', ...mdx({ providerImportSource: '@mdx-js/react' }) }, react(), yaml()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@config': path.resolve(import.meta.dirname, './config'),
    },
  },
  test: {
    globals: true,
    env: { TZ: 'America/New_York' },
  },
});
