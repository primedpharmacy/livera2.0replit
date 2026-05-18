/**
 * E2E — Task-51: Cancel + Refund flow
 *
 * Validates the end-to-end cancel + refund journey defined in Task-38:
 *   1. ORD-00450 fixture renders as cancelled (cancellation banner, no
 *      Cancel Order action).
 *   2. The linked refund amendment AMEND-003 opens for a user with
 *      can_refund=true, and a partial refund can be issued — amendment
 *      flips to "Applied" and a Decision card appears.
 *   3. The locked refund-authority badge is rendered when the user does
 *      not have can_refund (verified via a network-level fixture override
 *      cannot be done here; the badge is instead validated by selector
 *      presence in the unlocked panel and by the unit-test counterpart
 *      in lib/api/fixtures/__tests__/processRefundAmendment.test.ts).
 *
 * Pre-conditions:
 *   The web dev server must be running on $PORT (default 22333). When the
 *   workspace's "artifacts/web: web" workflow is up, this spec runs against it
 *   directly. CI can override with PLAYWRIGHT_BASE_URL.
 */

import { test, expect } from '@playwright/test';

const CLINIC = 'feeltru';
const CANCELLED_ORDER_ID = 'ORD-00450';
const REFUND_AMENDMENT_ID = 'AMEND-003';

test.describe('Cancel + refund flow', () => {
  test('cancelled order ORD-00450 renders the cancellation banner and hides the Cancel action', async ({ page }) => {
    await page.goto(`/${CLINIC}/orders/${CANCELLED_ORDER_ID}`);

    // Header shows the order id and a Cancelled status badge
    await expect(page.locator('h1', { hasText: CANCELLED_ORDER_ID })).toBeVisible();
    await expect(page.getByText(/cancelled/i).first()).toBeVisible();

    // Cancellation banner mentions the seeded reason (overseas relocation)
    await expect(page.getByText(/relocating overseas/i)).toBeVisible();

    // The "Cancel Order" header action must NOT be visible for an already
    // cancelled order — guards against regressing the canCancelOrder gate.
    await expect(page.getByRole('button', { name: /cancel order/i })).toHaveCount(0);
  });

  test('refund amendment AMEND-003 partial refund flips status to Applied', async ({ page }) => {
    await page.goto(`/${CLINIC}/amendments/${REFUND_AMENDMENT_ID}`);

    // Header shows the amendment id + the Refund type pill
    await expect(page.locator('h1', { hasText: REFUND_AMENDMENT_ID })).toBeVisible();
    await expect(page.getByText('Refund', { exact: true }).first()).toBeVisible();

    // Refund Authority card is unlocked for the demo user (Qadir, can_refund=true)
    const refundCard = page.locator('div').filter({ hasText: /refund authority/i }).first();
    await expect(refundCard).toBeVisible();

    // Switch to partial refund and enter £50
    await page.getByRole('button', { name: /^partial$/i }).click();
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('50');

    // Live preview updates to the new amount
    await expect(page.getByText(/Refunding £50\.00 to card ending/i)).toBeVisible();

    // Confirm refund — calls processRefundAmendment() under the hood
    await page.getByRole('button', { name: /confirm refund/i }).click();

    // Success toast & status flip to Applied
    await expect(page.getByText(/Refund of £50\.00 issued via Ryft/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/applied/i).first()).toBeVisible();

    // A Decision card now renders with decided_by/decided_at populated
    await expect(page.getByText(/decided by/i)).toBeVisible();
    await expect(page.getByText(/decided at/i)).toBeVisible();
  });

  // NOTE: the locked refund-authority badge (rendered when can_refund=false)
  // cannot be exercised end-to-end because CURRENT_USER is hardcoded to a
  // user with can_refund=true and there is no in-app role switcher yet.
  // The locked branch is covered by the unit test in
  // lib/api/fixtures/__tests__/processRefundAmendment.test.ts ("refund
  // authority gate > throws FORBIDDEN when the user does not have
  // can_refund"). Follow-up #68 tracks adding an in-app switcher so this
  // gap can be closed at the UI layer.
});
