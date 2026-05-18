/**
 * E2E — Task-198: Demo user switcher flips the refund lock
 *
 * The dev-only "Demo:" pill in TopNav lets stakeholders swap the current
 * user without a reload so they can show the locked refund state on
 * /feeltru/amendments/AMEND-003. Unit tests around `useCurrentUserContext`
 * cover the reducer, but nothing exercises the dropdown wiring + cookie
 * persistence end-to-end. This spec is that safety net:
 *
 *   1. Loads /feeltru/amendments/AMEND-003 as the default Qadir persona and
 *      confirms the Refund Authority panel renders unlocked (Full/Partial
 *      toggle + Confirm refund button visible).
 *   2. Opens the demo switcher, picks Olwyn (Coach, can_refund=false) and
 *      asserts the locked padlock copy ("Refund authority required" + the
 *      "ask an Owner" sentence) appears WITHOUT a page reload, while the
 *      unlocked controls disappear.
 *   3. Switches back to Qadir and confirms the unlocked refund form
 *      returns — again without a reload.
 *   4. Picks Olwyn one more time, then `page.reload()`s and verifies the
 *      persona persists (cookie mirror written by `setUserId`), so the
 *      locked panel is still shown after the navigation.
 *
 * Pre-conditions: the web dev server must be running on $PORT (default
 * 22333) and built in dev mode — the switcher is gated on
 * `process.env.NODE_ENV !== 'production'`.
 */

import { test, expect } from '@playwright/test';

const CLINIC = 'feeltru';
const REFUND_AMENDMENT_ID = 'AMEND-003';
const AMENDMENT_URL = `/${CLINIC}/amendments/${REFUND_AMENDMENT_ID}`;

const LOCKED_HEADING = /refund authority required/i;
const LOCKED_BODY = /Only admins with refund authority can action this amendment/i;

async function openDemoSwitcher(page: import('@playwright/test').Page) {
  await page.getByTitle('Switch demo user (dev only)').click();
  // Wait for the dropdown content to actually be mounted before we try
  // to click an item — Radix portals it, so just awaiting the menu label.
  await expect(page.getByText(/switch demo user/i)).toBeVisible();
}

async function pickDemoUser(
  page: import('@playwright/test').Page,
  fullName: string,
) {
  await openDemoSwitcher(page);
  await page.getByRole('menuitem', { name: new RegExp(fullName, 'i') }).click();
}

test.describe('Demo user switcher → refund lock', () => {
  test('flipping the demo persona toggles the locked refund panel in-place and persists across reload', async ({ page }) => {
    // `?as=user_qadir` triggers the demo-persona middleware which mints the
    // signed session cookie + the `livera_demo_uid` mirror, then 307s back
    // to the bare URL — bypasses /sign-in so the spec runs unattended.
    await page.goto(`${AMENDMENT_URL}?as=user_qadir`);
    await expect(page).toHaveURL(AMENDMENT_URL);

    // Sanity: header resolved and we're rendering the Refund panel.
    await expect(page.locator('h1', { hasText: REFUND_AMENDMENT_ID })).toBeVisible();

    // Default persona is Qadir (Owner, can_refund=true) → unlocked panel.
    await expect(page.getByRole('button', { name: /^partial$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /confirm refund/i })).toBeVisible();
    await expect(page.getByText(LOCKED_HEADING)).toHaveCount(0);

    // Stamp a window sentinel so we can *prove* the in-place switches
    // never cause a full document load — a navigation/reload wipes
    // `window.__noReloadSentinel`. Same pattern as
    // complaintsBadgeLiveUpdate.spec.ts.
    await page.evaluate(() => {
      (window as unknown as { __noReloadSentinel: number }).__noReloadSentinel = Date.now();
    });
    const sentinelStillSet = async () =>
      page.evaluate(
        () =>
          typeof (window as unknown as { __noReloadSentinel?: number })
            .__noReloadSentinel === 'number',
      );

    // 1. Switch to Olwyn (Coach, can_refund=false) — locked copy should
    //    appear in-place without a reload, and the unlocked controls go.
    await pickDemoUser(page, 'Olwyn Sutcliffe');

    await expect(page.getByText(LOCKED_HEADING)).toBeVisible();
    await expect(page.getByText(LOCKED_BODY)).toBeVisible();
    await expect(page.getByRole('button', { name: /^partial$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /confirm refund/i })).toHaveCount(0);

    // The pill itself should now show the padlock affordance for the
    // locked persona ("· 🔒"), confirming the context updated.
    await expect(
      page.getByTitle('Switch demo user (dev only)'),
    ).toContainText('🔒');

    // Sentinel survived → no full document reload happened.
    expect(await sentinelStillSet()).toBe(true);

    // 2. Switch back to Qadir — unlocked controls return without reload.
    await pickDemoUser(page, 'Qadir Hussain');

    await expect(page.getByRole('button', { name: /^partial$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /confirm refund/i })).toBeVisible();
    await expect(page.getByText(LOCKED_HEADING)).toHaveCount(0);
    expect(await sentinelStillSet()).toBe(true);

    // 3. Pick Olwyn again, then hard-reload and confirm the cookie mirror
    //    (`livera_demo_uid`) kept the persona — the panel is still locked
    //    after a fresh server render. The reload should wipe the sentinel,
    //    proving it was a genuine document load (not a soft re-render).
    await pickDemoUser(page, 'Olwyn Sutcliffe');
    await expect(page.getByText(LOCKED_HEADING)).toBeVisible();
    expect(await sentinelStillSet()).toBe(true);

    await page.reload();
    expect(await sentinelStillSet()).toBe(false);

    await expect(page.locator('h1', { hasText: REFUND_AMENDMENT_ID })).toBeVisible();
    await expect(page.getByText(LOCKED_HEADING)).toBeVisible();
    await expect(page.getByText(LOCKED_BODY)).toBeVisible();
    await expect(page.getByRole('button', { name: /^partial$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /confirm refund/i })).toHaveCount(0);
  });
});
