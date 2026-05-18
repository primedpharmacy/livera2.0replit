/**
 * E2E — Task-86: Prescription-upload approval gate.
 *
 * Validates the UI side of the Task-81 safety gate: on an order whose intake
 * flagged it as "Px upload pending" with no px_upload attached yet, the
 * Approve button on Order Detail must be disabled and the explanatory
 * "GLP-1 prescription upload required from patient before approval" copy
 * must be visible next to it.
 *
 * Seed: ORD-00451 (FeelTru, Zara Ahmed) — see artifacts/web/lib/api/fixtures/orders.ts.
 *
 * Pre-conditions: the web dev server must be running on $PORT (default 22333).
 * The "artifacts/web: web" workflow handles this in the workspace; CI can
 * override via PLAYWRIGHT_BASE_URL.
 */

import { test, expect } from '@playwright/test';

const CLINIC = 'feeltru';
const ORDER_ID = 'ORD-00451';

test.describe('Px-upload approval gate', () => {
  test('Approve button is disabled with the upload-required copy when px_upload is missing', async ({ page }) => {
    // Default demo persona (Qadir, Owner) has decide-orders permission, so
    // the Approve block renders and the disabled-due-to-missing-upload
    // branch is exercised. The non-prescriber branch is covered below.
    await page.goto(`/${CLINIC}/orders/${ORDER_ID}?as=user_qadir`);

    // Order detail header confirms we landed on the right seed.
    await expect(page.locator('h1', { hasText: ORDER_ID })).toBeVisible();

    // The "Px upload pending" contextual flag is surfaced on the page.
    await expect(page.getByText('Px upload pending').first()).toBeVisible();

    // Approve button is rendered but disabled — clicking does nothing.
    const approveButton = page.getByRole('button', { name: /^approve$/i });
    await expect(approveButton).toBeVisible();
    await expect(approveButton).toBeDisabled();

    // The explanatory copy mirrors decideOrder's SAFETY_VIOLATION message so
    // a prescriber knows exactly why approval is blocked.
    await expect(
      page.getByText(/GLP-1 prescription upload required from patient before approval/i),
    ).toBeVisible();
  });

  test('Approve action is unavailable when the viewer is not a prescriber (Coach persona)', async ({ page }) => {
    // Task-120 — the `?as=` demo override re-mints the session as Olwyn
    // (Coach on FeelTru). Coaches have no `decide:orders` permission, so
    // the OrderDetailClient hides the Approve/Decline/Query button block
    // entirely. The order detail page itself still renders for read-only
    // viewing — this asserts the locked-permission negative path the
    // hardcoded Owner session previously made unreachable.
    await page.goto(`/${CLINIC}/orders/${ORDER_ID}?as=user_olwyn`);

    // Page still renders for the Coach (read-only).
    await expect(page.locator('h1', { hasText: ORDER_ID })).toBeVisible();
    await expect(page.getByText('Px upload pending').first()).toBeVisible();

    // No Approve / Decline / Query controls are rendered for a Coach —
    // the entire decision block is hidden behind the `canDecide` gate.
    await expect(page.getByRole('button', { name: /^approve$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^decline$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^query$/i })).toHaveCount(0);
  });
});
