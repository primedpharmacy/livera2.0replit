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
    await page.goto(`/${CLINIC}/orders/${ORDER_ID}`);

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
});
