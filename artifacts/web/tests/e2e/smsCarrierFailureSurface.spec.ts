/**
 * E2E — Task-201: SMS carrier-failure surface
 *
 * Task-137 made Twilio's carrier reason visible on Bounced/Failed SMS rows
 * in the per-patient Notification log (inline error text + tooltip on the
 * status chip). This spec locks that surface in so a future refactor of
 * NotificationRow can't silently drop it.
 *
 * Fixtures driving the assertions live in
 *   artifacts/web/lib/api/fixtures/patientNotifications.ts
 * (NOTIF-004 — Bounced, NOTIF-005 — Failed; both on PT-00198).
 *
 * Row scoping uses the `data-testid="notification-row-<id>"` hook on the
 * NotificationRow container so each assertion is strictly row-local — a
 * regression on NOTIF-004 cannot pass by accidentally matching NOTIF-005.
 *
 * Pre-conditions:
 *   The web dev server must be running on $PORT (default 22333). When the
 *   workspace's "artifacts/web: web" workflow is up, this spec runs against
 *   it directly. CI can override with PLAYWRIGHT_BASE_URL.
 */

import { test, expect } from '@playwright/test';

const CLINIC = 'feeltru';
const PATIENT_ID = 'PT-00198';

// Task-208 — `rawReason` is the raw Twilio string stored on the row's
// `last_error` / `payload.sms_error_message`; it stays on the status-chip
// tooltip and the inline span's `title`. `inlineSummary` is the short
// friendly label clinicians see at-a-glance (mapped from the Twilio code
// suffix). The visible inline text must contain `inlineSummary` and must
// NOT contain the verbose "Twilio NNNNN" suffix.
const SMS_ROWS = [
  {
    id: 'NOTIF-004',
    status: 'Bounced',
    rawReason: 'Unreachable destination handset (Twilio 30003)',
    inlineSummary: 'Unreachable handset',
    twilioCodeSuffix: 'Twilio 30003',
  },
  {
    id: 'NOTIF-005',
    status: 'Failed',
    rawReason: 'Landline or unreachable carrier (Twilio 30006)',
    inlineSummary: 'Landline or unreachable carrier',
    twilioCodeSuffix: 'Twilio 30006',
  },
] as const;

test.describe('SMS carrier-failure surface — per-patient Notification log', () => {
  test('Bounced and Failed SMS rows surface the carrier reason inline and on the status chip tooltip', async ({ page }) => {
    // `?as=user_qadir` triggers the demo-persona middleware which mints a
    // session cookie and 307-redirects back with the query stripped — this
    // bypasses /sign-in so the Notification log tab can render directly.
    await page.goto(
      `/${CLINIC}/patients/${PATIENT_ID}?tab=notifications&as=user_qadir`,
    );

    // Wait for the Notification log to render at least one of the rows we
    // care about, so subsequent per-row assertions don't race against SSR.
    await expect(page.getByTestId(`notification-row-${SMS_ROWS[0].id}`)).toBeVisible();

    for (const { id, status, rawReason, inlineSummary, twilioCodeSuffix } of SMS_ROWS) {
      // Strict row scoping: only elements inside THIS row are considered.
      const row = page.getByTestId(`notification-row-${id}`);
      await expect(row).toHaveCount(1);
      await expect(row).toBeVisible();

      // Row carries its own id label.
      await expect(row.locator('span', { hasText: id }).first()).toBeVisible();

      // 1) The status chip is the only span in the row with both the status
      //    label as its visible text AND the raw carrier reason as `title`.
      const statusChip = row.locator(`span[title="${rawReason}"]`).filter({ hasText: status });
      await expect(statusChip).toHaveCount(1);
      await expect(statusChip).toBeVisible();
      await expect(statusChip).toHaveAttribute('title', rawReason);

      // 2) Task-208 — the inline error block now shows a short friendly
      //    summary (e.g. "Unreachable handset" for Twilio 30003), with the
      //    raw Twilio string preserved as the wrapping span's `title` so
      //    the carrier code is still recoverable on hover.
      const inlineError = row.locator('span', {
        has: page.locator('span.font-semibold', { hasText: /^Error:$/ }),
      });
      await expect(inlineError).toHaveCount(1);
      await expect(inlineError).toContainText(inlineSummary);
      await expect(inlineError).toHaveAttribute('title', rawReason);
      // Visible text must NOT include the verbose "Twilio NNNNN" suffix —
      // that's hover-only now.
      await expect(inlineError).not.toContainText(twilioCodeSuffix);
    }

    // Negative control: the friendly summary for NOTIF-004 must NOT appear
    // inside the NOTIF-005 row (and vice-versa). This proves the per-row
    // scoping is real rather than a happy accident of page-wide matching.
    const row004 = page.getByTestId(`notification-row-${SMS_ROWS[0].id}`);
    const row005 = page.getByTestId(`notification-row-${SMS_ROWS[1].id}`);
    await expect(row004).not.toContainText(SMS_ROWS[1].inlineSummary);
    await expect(row005).not.toContainText(SMS_ROWS[0].inlineSummary);
  });
});
