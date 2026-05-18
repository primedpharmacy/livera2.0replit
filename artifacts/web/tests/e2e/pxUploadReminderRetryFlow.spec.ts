/**
 * E2E — Task-179: Manual retry of a failed Px upload reminder.
 *
 * Task-129 surfaces Postmark Bounced/Failed reminder attempts on the order
 * activity timeline. Task-179 added a "Retry reminder" action on the latest
 * failure entry that opens a small dialog: staff confirm or edit the
 * recipient email and the helper re-sends immediately via the same
 * retryFailedPxUploadReminder fixture used by the route's unit tests.
 *
 * This spec pins the UX end-to-end:
 *   1. ORD-00451 (seeded with a Bounced first-reminder failure) renders a
 *      "Retry reminder" button on the failed timeline entry,
 *   2. clicking it opens the retry dialog pre-populated with the bad
 *      address,
 *   3. submitting a corrected address dismisses the dialog and shows a
 *      success notice, and
 *   4. the timeline refreshes in place to show the successful
 *      "Px upload reminder emailed to patient" entry without a full
 *      page reload.
 *
 * Runs against the shared `artifacts/web: web` workflow via the project
 * `baseURL` — this flow doesn't need to assert against backend `[AUDIT]`
 * stdout (the fixture + route unit tests cover that), so there's no
 * reason to spawn a second cold `next dev` instance.
 */

import { test, expect } from '@playwright/test';

const CLINIC = 'feeltru';
const ORDER_ID = 'ORD-00451';
const BAD_EMAIL = 'zara.k@example.com';
const FIXED_EMAIL = 'zara.k.fixed@example.com';

test.describe('Px-upload reminder retry flow', () => {
  test('retries a failed reminder and refreshes the timeline in place', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto(`/${CLINIC}/orders/${ORDER_ID}?as=user_qadir`);
    await expect(page.locator('h1', { hasText: ORDER_ID })).toBeVisible({
      timeout: 60_000,
    });

    // OrderDetailClient defaults the right-hand tab to "Clinical evidence";
    // switch to the Activity log tab so the timeline (and its retry action)
    // is mounted.
    await page.getByRole('button', { name: /^Activity log$/i }).click();

    // ── 1. The failed-reminder entry renders with a Retry button. ──
    // Scope to the "Activity Log" card so we don't accidentally match an
    // unrelated entry elsewhere on the page (e.g. resend history copy).
    const activityCard = page.locator('div', {
      has: page.getByText('Activity Log', { exact: true }),
    }).first();
    await expect(activityCard).toBeVisible();
    await expect(
      activityCard.getByText('Px upload reminder failed to deliver', { exact: true }),
    ).toBeVisible();

    const retryButton = activityCard.getByRole('button', { name: /Retry reminder/i });
    await expect(retryButton).toBeVisible();

    // ── 2. Open the dialog — pre-populated with the bounced address. ──
    await retryButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Retry upload reminder');
    const emailInput = dialog.getByLabel('Recipient email');
    await expect(emailInput).toHaveValue(BAD_EMAIL);

    // ── 3. Correct the address + submit. ──
    await emailInput.fill(FIXED_EMAIL);
    await dialog.getByRole('button', { name: /Resend reminder/i }).click();

    // The dialog closes on a Delivered outcome and a success notice appears
    // just below the timeline.
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(page.getByRole('status').filter({ hasText: FIXED_EMAIL })).toBeVisible();

    // ── 4. Timeline refreshes in place: the success "reminder emailed"
    //      entry now renders, targeted at the corrected address, without
    //      requiring a full page reload.
    await expect(
      activityCard.getByText('Px upload reminder emailed to patient', { exact: true }),
    ).toBeVisible();
    await expect(activityCard).toContainText(FIXED_EMAIL);
  });
});
