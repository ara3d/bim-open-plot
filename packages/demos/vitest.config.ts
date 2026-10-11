import { defineConfig } from 'vitest/config';
import { viewerAlias } from './viewer-alias.mjs';

export default defineConfig({
  resolve: { alias: viewerAlias() },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'demos/*/*.test.ts'],
    testTimeout: 30_000,
  },
});
