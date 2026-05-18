# Web E2E Tests (Playwright)

Browser-driven end-to-end specs for the Next.js web app. They drive a real
Chromium against the running dev server (and, for the Intercom live test,
the running api-server too).

## Running

```bash
pnpm --filter @workspace/web test:e2e
# single spec
pnpm --filter @workspace/web exec playwright test tests/e2e/intercomWebhookLive.spec.ts
```

For the `intercomWebhookLive.spec.ts` (Task-134) spec the `artifacts/web`
**and** `artifacts/api-server` workflows must both be running, and the
base URL must point at the workspace router so `/api/intercom/*` is
proxied to the api-server:

```bash
PLAYWRIGHT_BASE_URL=http://localhost \
  pnpm --filter @workspace/web exec playwright test tests/e2e/intercomWebhookLive.spec.ts
```

## Environment / system libraries

Playwright's bundled Chromium needs a long tail of Linux libraries
(`glib`, `nspr`, `nss`, `libgbm`, `gtk3`, `mesa`, `fontconfig`, and several
`xorg.*` libs). On Replit those are pinned in **`replit.nix`** at the repo
root, and the resolved browser path is exported as
`REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE`. `playwright.config.ts` picks that
up automatically, so a fresh clone does **not** need
`npx playwright install` or `playwright install-deps` — re-entering the
nix shell (or restarting the workflow) is enough.

If you bump `@playwright/test` and hit a "Host system is missing
dependencies" or "libfoo.so not found" error at launch:

1. Confirm `replit.nix` still lists everything Playwright wants
   (`pnpm --filter @workspace/web exec playwright install-deps --dry-run`
   prints the canonical list).
2. Add any new packages to the `deps = [ … ]` block in `replit.nix`
   so the fix is captured for the next contributor.
3. Restart the workflow so the new nix env is picked up.

Do **not** rely on running `playwright install-deps` ad-hoc — those
installs do not persist across container rebuilds, which is exactly what
this README exists to prevent.
