/**
 * Visual regression — Task-67
 *
 * Catches UI regressions in the cancel + refund flow by snapshotting three
 * locator-scoped regions:
 *   1. Cancelled order banner on ORD-00450 (red banner, ban icon, reason).
 *   2. Unlocked refund authority panel on AMEND-003 as Qadir (can_refund=true).
 *   3. Locked refund authority panel on AMEND-003 as Olwyn (can_refund=false),
 *      reached by seeding the `livera:demo-current-user-id` localStorage key
 *      that the CurrentUserProvider in lib/current-user-context.tsx reads.
 *
 * Each region is screenshotted with `toHaveScreenshot()` so baselines live
 * next to this file in `cancelRefundFlow.visual.spec.ts-snapshots/`.
 *
 * Refreshing baselines (e.g. after an intentional design change):
 *   pnpm --filter @workspace/web run test:visual:update
 *
 * Running the check (CI / local verification):
 *   pnpm --filter @workspace/web run test:visual
 */

import { test, expect } from '@playwright/test';

const CLINIC = 'feeltru';
const CANCELLED_ORDER_ID = 'ORD-00450';
const REFUND_AMENDMENT_ID = 'AMEND-003';
const LOCKED_DEMO_USER = 'user_olwyn'; // Coach — no can_refund flag
const DEMO_USER_STORAGE_KEY = 'livera:demo-current-user-id';

test.describe('Visual baselines — cancel + refund flow', () => {
  test.use({
    // Stable viewport so layout shifts surface as diffs, not noise.
    viewport: { width: 1280, height: 800 },
  });

  test('cancelled order banner — ORD-00450', async ({ page }) => {
    await page.goto(`/${CLINIC}/orders/${CANCELLED_ORDER_ID}`);

    // Anchor on the banner copy so we don't race the page render.
    const banner = page
      .locator('div')
      .filter({ hasText: /Order cancelled —/ })
      .first();
    await expect(banner).toBeVisible();

    await expect(banner).toHaveScreenshot('order-cancelled-banner.png', {
      animations: 'disabled',
    });
  });

  test('refund authority — unlocked (AMEND-003 as Qadir)', async ({ page }) => {
    await page.goto(`/${CLINIC}/amendments/${REFUND_AMENDMENT_ID}`);

    // The Refund Authority DCard contains the title text; scope to that card.
    const refundCard = page
      .locator('section, div')
      .filter({ hasText: /Refund Authority/ })
      .filter({ hasText: /Confirm Refund/ })
      .first();
    await expect(refundCard).toBeVisible();
    // Wait for the live preview line so all child rows are painted.
    await expect(page.getByText(/Refunding £/)).toBeVisible();

    await expect(refundCard).toHaveScreenshot('refund-panel-unlocked.png', {
      animations: 'disabled',
    });
  });

  test('refund authority — locked (AMEND-003 as a non-authority user)', async ({ page, context }) => {
    // Seed the demo-user localStorage key before the app boots so the
    // CurrentUserProvider picks up the locked-state user on first render.
    await context.addInitScript(
      ([key, id]) => {
        try { window.localStorage.setItem(key, id); } catch { /* ignore */ }
      },
      [DEMO_USER_STORAGE_KEY, LOCKED_DEMO_USER]
    );
    await page.goto(`/${CLINIC}/amendments/${REFUND_AMENDMENT_ID}`);

    const lockedCard = page
      .locator('section, div')
      .filter({ hasText: /Refund Authority/ })
      .filter({ hasText: /Refund authority required/ })
      .first();
    await expect(lockedCard).toBeVisible();

    await expect(lockedCard).toHaveScreenshot('refund-panel-locked.png', {
      animations: 'disabled',
    });
  });
});
