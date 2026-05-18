/**
 * E2E — Task-160: Complaints sidebar badge live-update
 *
 * Validates that the in-app Resolve / Reopen buttons on the complaint
 * detail page dispatch the `queue-count-changed` CustomEvent and that the
 * sidebar Complaints badge picks it up live — no full page reload.
 *
 * Flow:
 *   1. Open CMP-004 (status `investigating`, the only open complaint for VSC)
 *      with the `?as=user_qadir` demo-persona middleware override so the
 *      test bypasses /sign-in and the sidebar renders with full nav.
 *   2. Read the initial sidebar Complaints badge value (expected: 1).
 *   3. Click Resolve → assert decrement (badge pill hidden when count == 0).
 *   4. Click Reopen → assert increment back to the original value.
 *
 * Pre-conditions:
 *   The web dev server must be running on $PORT (default 22333). When the
 *   workspace's "artifacts/web: web" workflow is up, this spec runs against it
 *   directly. CI can override with PLAYWRIGHT_BASE_URL.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';

const CLINIC = 'vsc';
const OPEN_COMPLAINT_ID = 'CMP-004';

function complaintsNavLink(page: Page): Locator {
  // Sidebar renders <a href="/vsc/complaints"> with visible text "Complaints"
  return page.locator(`nav a[href="/${CLINIC}/complaints"]`).filter({ hasText: /^\s*Complaints/ });
}

function complaintsBadge(page: Page): Locator {
  // BadgePill is a span with `rounded-full` inside the Complaints link.
  return complaintsNavLink(page).locator('span.rounded-full');
}

test.describe('Complaints sidebar badge — live update on Resolve/Reopen', () => {
  test('badge decrements on Resolve and increments on Reopen without a page reload', async ({ page }) => {
    // `?as=user_qadir` triggers the demo-persona middleware which mints the
    // session cookie and 307-redirects back to the URL with the query stripped.
    await page.goto(`/${CLINIC}/complaints/${OPEN_COMPLAINT_ID}?as=user_qadir`);

    // We should land on the bare detail URL (no /sign-in, no ?as= query).
    await expect(page).toHaveURL(`/${CLINIC}/complaints/${OPEN_COMPLAINT_ID}`);
    await expect(page.getByText(OPEN_COMPLAINT_ID).first()).toBeVisible();

    // Inject a sentinel on `window` so we can prove no full document
    // reload happens between status mutations — a reload would wipe it.
    // The whole point is that the badge updates via a window CustomEvent,
    // not via a navigation/refetch.
    await page.evaluate(() => {
      (window as unknown as { __noReloadSentinel: number }).__noReloadSentinel = Date.now();
    });
    const sentinelStillSet = async () =>
      page.evaluate(
        () => typeof (window as unknown as { __noReloadSentinel?: number }).__noReloadSentinel === 'number',
      );

    // Initial sidebar state: Complaints badge visible, value >= 1.
    const navLink = complaintsNavLink(page);
    await expect(navLink).toBeVisible();
    const badge = complaintsBadge(page);
    await expect(badge).toBeVisible();
    const initialText = (await badge.textContent())?.trim() ?? '';
    const initialOpenCount = Number.parseInt(initialText, 10);
    expect(Number.isFinite(initialOpenCount)).toBe(true);
    expect(initialOpenCount).toBeGreaterThanOrEqual(1);

    // Header should expose Resolve (not Reopen) for an open complaint.
    const resolveBtn = page.getByRole('button', { name: /^Resolve$/ });
    await expect(resolveBtn).toBeVisible();
    await expect(page.getByRole('button', { name: /^Reopen$/ })).toHaveCount(0);

    // ── Resolve ────────────────────────────────────────────────────────────
    await resolveBtn.click();

    // Toast + header action flip
    await expect(page.getByText(/Marked as resolved/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /^Reopen$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Resolve$/ })).toHaveCount(0);

    // Sidebar badge decrements live. When the new count is 0 the pill is
    // not rendered at all (Sidebar only renders the BadgePill when
    // complaintsCount > 0).
    if (initialOpenCount === 1) {
      await expect(complaintsBadge(page)).toHaveCount(0);
    } else {
      await expect(complaintsBadge(page)).toHaveText(String(initialOpenCount - 1));
    }

    // URL unchanged, no full document reload happened during the click.
    await expect(page).toHaveURL(`/${CLINIC}/complaints/${OPEN_COMPLAINT_ID}`);
    expect(await sentinelStillSet()).toBe(true);

    // ── Reopen ─────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /^Reopen$/ }).click();

    await expect(page.getByText(/Complaint reopened/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /^Resolve$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Reopen$/ })).toHaveCount(0);

    // Badge increments back to the original value (pill reappears if it
    // was previously hidden at 0).
    await expect(complaintsBadge(page)).toBeVisible();
    await expect(complaintsBadge(page)).toHaveText(String(initialOpenCount));

    await expect(page).toHaveURL(`/${CLINIC}/complaints/${OPEN_COMPLAINT_ID}`);
    expect(await sentinelStillSet()).toBe(true);
  });
});
