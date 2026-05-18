/**
 * E2E — Task-235: Pin the reversal row on the Activity log so a future
 * refactor of `reverseDecision` or `OrderActivityTimeline` can't silently
 * drop the "Decision reversed — was <prior decision>" entry introduced by
 * Task-158 / Task-159.
 *
 * Target order: ORD-00438 (JAMES_ORDER_VSC) — already seeded as approved
 * by user_qadir in `artifacts/web/lib/api/fixtures/orders.ts`. We use the
 * pre-approved fixture rather than driving the Approve modal through the
 * UI so this test stays focused on what it is meant to lock down (the
 * reversal row) and doesn't share flakiness with the Next.js server-action
 * revalidation lifecycle of the Approve flow.
 *
 * Flow:
 *   1. As Qadir (Owner on VSC, can decide on orders), open the
 *      pre-approved ORD-00438 detail page.
 *   2. Click "Reverse decision", fill a rationale that clears both the
 *      modal's REVERSE_MIN_CHARS=20 gate and VSC's
 *      clinical_note_min_chars gate, and confirm.
 *   3. Open the Activity log tab and assert the reversal row renders
 *      with both the prior-decision label ("was approved") and Qadir's
 *      full name as the reverser.
 *
 * Pre-conditions: the `artifacts/web: web` workflow must be reachable on
 * $PORT (default 22333) or PLAYWRIGHT_BASE_URL must be set. The fixture
 * store is in-memory, so this test mutates ORD-00438 for the lifetime of
 * the dev server; the existing Playwright suite already runs with
 * workers: 1 so it doesn't race with other specs.
 */

import { test, expect } from '@playwright/test';

const CLINIC = 'vsc';
const ORDER_ID = 'ORD-00438';
const REVERSER_NAME = 'Qadir Hussain';

// Comfortably above both REVERSE_MIN_CHARS=20 (modal) and VSC's
// clinical_note_min_chars gate so the reversal note insert succeeds.
const REVERSE_REASON =
  'Reverting decision — new safety information surfaced after approval; needs re-review by the clinical lead before dispense.';

test.describe('Reverse-decision timeline row (Task-235)', () => {
  test('reversing approved ORD-00438 surfaces a "Decision reversed — was approved" row on the Activity log', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // ── 1. Open the approved order ─────────────────────────────────────────
    await page.goto(`/${CLINIC}/orders/${ORDER_ID}?as=user_qadir`);
    await expect(page.locator('h1', { hasText: ORDER_ID })).toBeVisible();

    // ── 2. Reverse ─────────────────────────────────────────────────────────
    // The seeded approval is days old, so the 5-second quick-undo window has
    // long expired and the long-window "Reverse decision" button is what
    // surfaces here.
    const reverseButton = page.getByRole('button', { name: /^reverse decision$/i });
    await expect(reverseButton).toBeVisible({ timeout: 10_000 });
    await reverseButton.click();

    const reasonField = page.getByPlaceholder(/why is this decision being reversed/i);
    await expect(reasonField).toBeVisible();
    await reasonField.fill(REVERSE_REASON);
    await page.getByRole('button', { name: /reverse and re-queue/i }).click();

    // Once reversed, the order returns to clinical_check and the
    // Approve/Decline/Query block re-appears in the header.
    await expect(page.getByRole('button', { name: /^approve$/i })).toBeVisible({
      timeout: 15_000,
    });

    // ── 3. Assert the reversal row on the Activity log ─────────────────────
    await page.getByRole('button', { name: /^activity log$/i }).click();

    // Title carries the prior decision label ("was approved") — this is
    // the row added by the Task-158 reversal_log loop in
    // OrderActivityTimeline. The em dash is part of the rendered string.
    const reversalRow = page
      .locator('li')
      .filter({ hasText: /decision reversed\s+—\s+was approved/i })
      .first();
    await expect(reversalRow).toBeVisible();

    // Meta line names the reverser (Qadir Hussain), so a refactor that
    // drops the USERS_REGISTRY lookup or the reverser stamp gets caught.
    await expect(reversalRow).toContainText(`by ${REVERSER_NAME}`);
  });
});
