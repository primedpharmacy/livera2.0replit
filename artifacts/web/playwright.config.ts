import { defineConfig, devices } from '@playwright/test';

const PORT = process.env['PORT'] ?? '22333';
const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? `http://localhost:${PORT}`;

// On Replit, the Chromium browser binary + its system libraries are provided
// by the nix shell (see `replit.nix`) and the path is exposed via the
// `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE` env var. Using it bypasses the
// `~/.cache/ms-playwright` download flow entirely, so a fresh clone can run
// `pnpm --filter @workspace/web test:e2e` without `npx playwright install`
// and without re-fetching matching system libs every time Playwright bumps.
// See `tests/e2e/README.md` for setup details.
const NIX_CHROMIUM = process.env['REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE'];

// Early, actionable warning so a missing nix-provided browser shows up at
// config-load time instead of as an opaque "Executable doesn't exist" trace
// halfway through the run. Only nag on Replit (REPL_ID is always set there).
if (process.env['REPL_ID'] && !NIX_CHROMIUM) {
  // eslint-disable-next-line no-console
  console.warn(
    '[playwright] REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE is unset — ' +
      'Playwright will look in ~/.cache/ms-playwright and likely fail. ' +
      'Re-enter the nix shell / restart the workflow so replit.nix takes effect. ' +
      'See artifacts/web/tests/e2e/README.md.',
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(NIX_CHROMIUM ? { launchOptions: { executablePath: NIX_CHROMIUM } } : {}),
      },
    },
  ],
});
