import path from 'node:path';
import yaml from '@rollup/plugin-yaml';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [yaml()],
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
