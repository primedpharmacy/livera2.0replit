/**
 * E2E — Task-287: Cover the one-click SMS-to-email switch
 *
 * Task-200 added a "Switch to email" affordance on Bounced/Failed SMS rows in
 * the per-patient Notification log. The button reuses the existing
 * updatePatientPreferredChannel flow so the change is recorded in
 * PREFERRED_CHANNEL_CHANGES (and therefore surfaced inline in the same log
 * as a system breadcrumb) and the audit spine.
 *
 * This spec locks in the three things future refactors must not silently
 * drop:
 *   1. The button is gated by the same write:patients permission as the
 *      Contact-section editor — a Coach never sees it, even on a row that
 *      otherwise satisfies all of the row-level conditions.
 *   2. Clicking the button flips the preferred-channel chip in the Contact
 *      section to "Email", appends a new "Preferred channel changed from
 *      SMS to Email" row to the Notification log, and hides itself
 *      (currentChannel === 'email' fails the gating).
 *
 * Fixture setup:
 *   PT-00198 (Sarah Cookland) already has NOTIF-004 (Bounced SMS) and
 *   NOTIF-005 (Failed SMS) in the Notification log fixtures, but her
 *   preferred channel is 'email' by default — so the Switch-to-email
 *   button is hidden out of the box. We flip her to SMS via the
 *   PreferredChannelEditor in the Contact section as part of the test
 *   (mirroring exactly how staff would arrive at this state in production)
 *   before exercising the new button.
 *
 * Pre-conditions: same as the other Notification-log specs — the web dev
 * server must be running on $PORT (default 22333). The `?as=user_*` query
 * param triggers the demo-persona middleware that mints a session cookie
 * and 307s back without the query, bypassing /sign-in.
 */

import { test, expect, type Page } from '@playwright/test';

const CLINIC = 'feeltru';
const PATIENT_ID = 'PT-00198';
const BOUNCED_SMS_ROW_ID = 'NOTIF-004'; // Bounced SMS, Twilio 30003
const FAILED_SMS_ROW_ID = 'NOTIF-005';  // Failed SMS, Twilio 30006

const PROFILE_URL = `/${CLINIC}/patients/${PATIENT_ID}`;
const NOTIFICATIONS_URL = `${PROFILE_URL}?tab=notifications`;

const SWITCH_BUTTON_NAME = /switch to email/i;

/**
 * Setup: ensure the patient is on SMS so the new button shows up. Uses the
 * existing PreferredChannelEditor (Pencil → select "SMS" → Check) exactly as
 * an Owner would in production. Idempotent — if she is already on SMS the
 * function short-circuits.
 */
function preferredChannelRow(page: Page) {
  // The "Channel" row in the Contact section: a flex container whose first
  // <span> is the literal label "Channel" and whose second <span> is the
  // current value ("Email"/"SMS"/"Phone"). Scoping via the parent of the
  // label keeps the assertion strictly local to this editor.
  return page.getByText('Channel', { exact: true }).locator('..');
}

function preferredChannelChipLocator(page: Page) {
  return preferredChannelRow(page)
    .locator('span')
    .filter({ hasText: /^(Email|SMS|Phone)$/ })
    .first();
}

async function ensurePreferredChannelIsSms(page: Page) {
  await page.goto(`${PROFILE_URL}?as=user_qadir`);
  await expect(preferredChannelChipLocator(page)).toBeVisible();
  if ((await preferredChannelChipLocator(page).textContent())?.trim() === 'SMS') {
    return;
  }

  await preferredChannelRow(page).getByRole('button', { name: /change preferred channel/i }).click();
  // Wait for the editor select to actually be in the DOM before driving it.
  const select = preferredChannelRow(page).getByRole('combobox', { name: /preferred channel/i });
  await expect(select).toBeVisible();
  await select.selectOption('sms');
  // Belt-and-braces: confirm the select committed the change so a subsequent
  // save click cannot land while React still has draft === 'email' (which
  // would hit the no-op short-circuit in PreferredChannelEditor.save()).
  await expect(select).toHaveValue('sms');
  await preferredChannelRow(page).getByRole('button', { name: /save channel/i }).click();
  // The editor exits, then router.refresh() re-renders the static chip with
  // the new value. Give it generous headroom — next-dev's first refresh on
  // a cold container is slow.
  await expect(preferredChannelChipLocator(page)).toHaveText('SMS', { timeout: 15_000 });
}

test.describe('Task-287 — one-click Switch-to-email on Bounced/Failed SMS rows', () => {
  // First-time route compilation in next-dev plus the per-patient profile's
  // 2k+ module graph regularly eats > 20s on a cold container. The whole
  // scenario (setup flip-to-SMS, Coach context, Owner click, three batches
  // of assertions) needs more than the 30s Playwright default.
  test.setTimeout(90_000);

  test('Owner can switch the patient to email from a Bounced SMS row; Coach never sees the button', async ({ page, context }) => {
    // ── Setup ─────────────────────────────────────────────────────────────
    // Put PT-00198 on SMS so the row-level gating is satisfied. The button
    // ALSO needs canSwitchChannel=true (write:patients) — already true for
    // Qadir (Owner).
    await ensurePreferredChannelIsSms(page);

    // ── Coach scenario ────────────────────────────────────────────────────
    // Switch persona to Olwyn (Coach, no write:patients) and assert the
    // button is not rendered on either of the qualifying SMS rows, even
    // though those rows are still visible. This proves the gate is the
    // role check (canSwitchChannel) rather than a row-level miss.
    const coachContext = await context.browser()!.newContext();
    const coachPage = await coachContext.newPage();
    await coachPage.goto(`${NOTIFICATIONS_URL}&as=user_olwyn`);

    const coachBouncedRow = coachPage.getByTestId(`notification-row-${BOUNCED_SMS_ROW_ID}`);
    const coachFailedRow  = coachPage.getByTestId(`notification-row-${FAILED_SMS_ROW_ID}`);
    await expect(coachBouncedRow).toBeVisible();
    await expect(coachFailedRow).toBeVisible();
    await expect(coachBouncedRow.getByRole('button', { name: SWITCH_BUTTON_NAME })).toHaveCount(0);
    await expect(coachFailedRow.getByRole('button', { name: SWITCH_BUTTON_NAME })).toHaveCount(0);
    await coachContext.close();

    // ── Owner scenario ────────────────────────────────────────────────────
    // Back as Qadir (Owner): the button is rendered on the Bounced row, and
    // clicking it flips the chip, appends a channel-change breadcrumb, and
    // hides itself (because the row's currentChannel gating now fails).
    await page.goto(`${NOTIFICATIONS_URL}&as=user_qadir`);

    const bouncedRow = page.getByTestId(`notification-row-${BOUNCED_SMS_ROW_ID}`);
    const failedRow  = page.getByTestId(`notification-row-${FAILED_SMS_ROW_ID}`);
    await expect(bouncedRow).toBeVisible();
    const switchBtn = bouncedRow.getByRole('button', { name: SWITCH_BUTTON_NAME });
    await expect(switchBtn).toBeVisible();
    // Same affordance on the Failed SMS row as a sanity check.
    await expect(failedRow.getByRole('button', { name: SWITCH_BUTTON_NAME })).toBeVisible();

    // Snapshot how many channel-change breadcrumbs exist before the click so
    // we can prove a new one was appended (not just that ≥1 exist from the
    // PCC-001 seed entry).
    const channelChangeRowsBefore = await page
      .locator('text=/Preferred channel changed from/i')
      .count();

    await switchBtn.click();

    // ── Assertions ────────────────────────────────────────────────────────
    // 1) Contact-section chip flips to Email.
    await expect(preferredChannelChipLocator(page)).toHaveText('Email');

    // 2) A new "Preferred channel changed from SMS to Email" breadcrumb is
    //    appended to the Notification log. We assert both the count went up
    //    AND that an SMS→Email row attributed to Qadir is present.
    await expect(
      page.locator('text=/Preferred channel changed from/i'),
    ).toHaveCount(channelChangeRowsBefore + 1);
    const newBreadcrumb = page
      .locator('div', {
        hasText: /Preferred channel changed from\s+SMS\s+to\s+Email\s+by Qadir Hussain/i,
      })
      .first();
    await expect(newBreadcrumb).toBeVisible();

    // 3) The Switch-to-email button disappears from both qualifying rows
    //    once currentChannel === 'email' (the row-level gating now fails).
    await expect(bouncedRow.getByRole('button', { name: SWITCH_BUTTON_NAME })).toHaveCount(0);
    await expect(failedRow.getByRole('button', { name: SWITCH_BUTTON_NAME })).toHaveCount(0);
  });
});
