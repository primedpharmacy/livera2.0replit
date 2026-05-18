import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    include: [
      'lib/**/*.test.ts',
      'tests/**/*.test.ts',
      'components/**/*.test.ts',
      'components/**/*.test.tsx',
      'app/**/*.test.ts',
    ],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
