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
      '@workspace/db': path.resolve(__dirname, '../../lib/db/src/index.ts'),
      // `audit.server.ts` carries `import "server-only"`, which throws when
      // resolved outside a React-server bundle. Tests run under jsdom, so
      // alias the marker to a no-op shim to keep unit coverage intact.
      'server-only': path.resolve(__dirname, 'lib/api/__test-shims__/server-only.ts'),
    },
  },
});
