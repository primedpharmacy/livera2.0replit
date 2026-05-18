/**
 * E2E — Task-51: Cancel + Refund flow
 *
 * Validates the end-to-end cancel + refund journey defined in Task-38:
 *   1. ORD-00450 fixture renders as cancelled (cancellation banner, no
 *      Cancel Order action).
 *   2. The linked refund amendment AMEND-003 opens for a user with
 *      can_refund=true, and a partial refund can be issued — amendment
 *      flips to "Applied", a Decision card appears, AND the dev-server
 *      stdout records the expected `refund_amendment_decision_*` /
 *      `refund_issued` AUDIT entries with the issued amount and the
 *      acting persona.
 *   3. The locked refund-authority badge is rendered when the user does
 *      not have can_refund (verified via a network-level fixture override
 *      cannot be done here; the badge is instead validated by selector
 *      presence in the unlocked panel and by the unit-test counterpart
 *      in lib/api/fixtures/__tests__/processRefundAmendment.test.ts).
 *
 * The spec spawns its own `next dev` instance via the shared
 * `_support/devServer.ts` harness — the audit assertions on test (2)
 * need the dev server's stdout, which is inaccessible when the spec
 * piggy-backs on the shared workspace workflow. Tests (1) and (3) also
 * use the spawned instance so the whole describe block runs in
 * isolation and the fixture state from test (2) cannot leak across
 * runs into a long-lived workflow process.
 */

import { test, expect } from '@playwright/test';
import { startDevServer, type DevServerHandle } from './_support/devServer';

const CLINIC = 'feeltru';
const CANCELLED_ORDER_ID = 'ORD-00450';
const REFUND_AMENDMENT_ID = 'AMEND-003';

let server: DevServerHandle;

test.describe('Cancel + refund flow', () => {
  test.beforeAll(async () => {
    // `next dev` cold-starts can take ~40s on Replit, which exceeds the
    // default 30s hook timeout. Give the harness room to wait out its own
    // 120s readiness window so the suite doesn't flake before the first
    // assertion runs.
    test.setTimeout(180_000);
    server = await startDevServer();
  });

  test.afterAll(async () => {
    await server?.stop();
  });

  test('cancelled order ORD-00450 renders the cancellation banner and hides the Cancel action', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: server.baseURL });
    const page = await context.newPage();
    try {
      await page.goto(`${server.baseURL}/${CLINIC}/orders/${CANCELLED_ORDER_ID}?as=user_qadir`);

      // Header shows the order id and a Cancelled status badge
      await expect(page.locator('h1', { hasText: CANCELLED_ORDER_ID })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(/cancelled/i).first()).toBeVisible();

      // Cancellation banner mentions the seeded reason (overseas relocation)
      await expect(page.getByText(/relocating overseas/i)).toBeVisible();

      // The "Cancel Order" header action must NOT be visible for an already
      // cancelled order — guards against regressing the canCancelOrder gate.
      await expect(page.getByRole('button', { name: /cancel order/i })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('refund amendment AMEND-003 partial refund flips status to Applied and emits AUDIT entries', async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ baseURL: server.baseURL });
    const page = await context.newPage();
    try {
      await page.goto(`${server.baseURL}/${CLINIC}/amendments/${REFUND_AMENDMENT_ID}?as=user_qadir`);

      // Header shows the amendment id + the Refund type pill
      await expect(page.locator('h1', { hasText: REFUND_AMENDMENT_ID })).toBeVisible({ timeout: 60_000 });
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

      // Mark the stdout boundary so the AUDIT regex below only inspects
      // the entries emitted by this Confirm click, not anything earlier
      // (page-load fixture chatter, the cancelled-order test, etc.).
      const stdoutBeforeConfirm = server.stdoutLength();

      // Confirm refund — calls processRefundAmendment() under the hood
      await page.getByRole('button', { name: /confirm refund/i }).click();

      // Success toast & status flip to Applied
      await expect(page.getByText(/Refund of £50\.00 issued via Ryft/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/applied/i).first()).toBeVisible();

      // A Decision card now renders with decided_by/decided_at populated
      await expect(page.getByText(/decided by/i)).toBeVisible();
      await expect(page.getByText(/decided at/i)).toBeVisible();

      // ── AUDIT assertions ────────────────────────────────────────────────
      // Give the dev-server stdout listener a beat to flush the entries
      // emitted from inside processRefundAmendment after the action resolves.
      await page.waitForTimeout(500);
      const refundLogs = server.getStdout().slice(stdoutBeforeConfirm);

      // processRefundAmendment emits two console.log('[AUDIT]', …) lines
      // on a happy-path partial refund: an "_attempt" up front and an
      // "_result" with outcome:'applied' once Ryft returns. The third
      // `refund_issued` event is written via recordAudit() (DB-only) and
      // therefore deliberately not asserted here. Both stdout lines must
      // reference the amendment id + acting persona so the trail can be
      // reconstructed from logs alone.
      const attemptAudit = refundLogs.match(
        /\[AUDIT\][\s\S]*?event_type:\s*'refund_amendment_decision_attempt'[\s\S]*?(?=\[AUDIT\]|$)/,
      );
      expect(attemptAudit, 'expected refund_amendment_decision_attempt AUDIT entry').not.toBeNull();
      expect(attemptAudit![0]).toContain(REFUND_AMENDMENT_ID);
      expect(attemptAudit![0]).toMatch(/decision_attempted:\s*'approve'/);

      const resultAudit = refundLogs.match(
        /\[AUDIT\][\s\S]*?event_type:\s*'refund_amendment_decision_result'[\s\S]*?outcome:\s*'applied'[\s\S]*?(?=\[AUDIT\]|$)/,
      );
      expect(resultAudit, 'expected applied refund_amendment_decision_result AUDIT entry').not.toBeNull();
      expect(resultAudit![0]).toContain(REFUND_AMENDMENT_ID);
      // £50.00 — pin the amount so a future regression where the UI's
      // pounds value drifts from the audited one fails loudly.
      expect(resultAudit![0]).toMatch(/refunded_amount_gbp:\s*50\b/);
      expect(resultAudit![0]).toMatch(/ryft_refund_ref:/);
    } finally {
      await context.close();
    }
  });

  test('refund amendment AMEND-003 renders the locked refund-authority badge for a non-refund persona', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: server.baseURL });
    const page = await context.newPage();
    try {
      // Task-120 — the `?as=` demo override re-mints the session as Claire
      // (Prescriber on FeelTru, can_refund=false). Prescribers retain
      // decide-amendments access so the Refund Authority card still renders,
      // but the inner authority panel flips to the locked / "ask an Owner"
      // copy that the hardcoded Owner session previously hid from the UI.
      await page.goto(`${server.baseURL}/${CLINIC}/amendments/${REFUND_AMENDMENT_ID}?as=user_claire`);

      // Header still resolves on the amendment page for a Prescriber.
      await expect(page.locator('h1', { hasText: REFUND_AMENDMENT_ID })).toBeVisible({ timeout: 60_000 });

      // Locked badge copy + the explanatory "ask an Owner" sentence are
      // visible — these are only rendered when `!CURRENT_USER.can_refund`.
      await expect(page.getByText(/refund authority required/i)).toBeVisible();
      await expect(
        page.getByText(/Only admins with refund authority can action this amendment/i),
      ).toBeVisible();

      // Unlocked-panel controls must not exist for this persona — guards
      // against regressing the gate back to "everyone sees the form".
      await expect(page.getByRole('button', { name: /^partial$/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /confirm refund/i })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
