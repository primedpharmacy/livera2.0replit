/**
 * Visual regression — Task-210
 *
 * Extends the screenshot safety net beyond the cancel + refund flow to
 * cover the highest-traffic admin screens. Each baseline anchors on a
 * stable selector and disables animations, mirroring the pattern in
 * cancelRefundFlow.visual.spec.ts.
 *
 * Baselines covered:
 *   1. Dashboard 7-stat ops strip (top KPI row).
 *   2. Dashboard "Quick actions" card (in the 3-column grid).
 *   3. Patient detail hero — PT-00378 (avatar + name + status pill + flags).
 *   4. Amendments queue filter chips bar.
 *   5. Incident detail severity banner — INC-001.
 *   6. GP letter detail "Letter body" card — GPL-001.
 *   7. Sign-in page Clerk card shell (Task-308 — catches drift on the
 *      auth entrypoint; tolerates Clerk's own minor pixel noise).
 *   8. Complaints inbox KPI strip (Task-308 — the complaints inbox is a
 *      high-traffic CQC surface and the five KPI tiles are deterministic
 *      given seeded fixtures + the pinned NOW).
 *   9. Clinical Check slide-over header (Task-317 — patient + order id
 *      badge + "Full detail" link; opened by clicking the first queue row).
 *  10. Orders list table header row (Task-317 — column labels for the
 *      ORDER | PATIENT | TREATMENT | TYPE | STATUS | LAST UPDATE | ACTION
 *      grid; anchored on the unique "Last update" column heading).
 *  11. Welcome calls queue tab bar (Task-317 — five status filter chips
 *      with their seeded counts).
 *  12. Complaint detail header strip (Task-317 — CMP-001 id badge,
 *      status pill, severity pill and Monday/resolve actions).
 *
 * Refreshing baselines (after intentional design changes):
 *   pnpm --filter @workspace/web run test:visual:update
 *
 * Running the check:
 *   pnpm --filter @workspace/web run test:visual
 *
 * Deterministic inputs:
 *   - All routes read seeded fixtures in `lib/api/fixtures/*` so IDs and
 *     copy are stable across runs.
 *   - `lib/api/constants.ts` pins NOW = '2026-05-11T08:00:00Z' so any
 *     relative-time strings ("3h ago", "Due today") resolve identically.
 *   - The first `page.goto` of each test appends `?as=user_qadir` so the
 *     workspace middleware re-mints the signed session cookie for Qadir
 *     (Owner) before rendering — staff routes redirect to `/sign-in`
 *     without it.
 */

import { test, expect } from '@playwright/test';

const CLINIC = 'feeltru';
const PATIENT_ID = 'PT-00378';
const INCIDENT_ID = 'INC-001';
const GP_LETTER_ID = 'GPL-001';
const COMPLAINT_ID = 'CMP-001';
const DEMO_USER = 'user_qadir';

function asUrl(path: string): string {
  // The middleware swaps `?as=<uid>` for a fresh session cookie and
  // 307-redirects to the same path with the query stripped, so the
  // screenshot URL is canonical.
  return `${path}?as=${DEMO_USER}`;
}

test.describe('Visual baselines — high-traffic admin screens', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
  });

  test('dashboard — 7-stat ops strip', async ({ page }) => {
    await page.goto(asUrl(`/${CLINIC}/dashboard`));

    // Anchor on the first stat link in the strip — it contains the unique
    // "Clinical Check Queue" label and the strip is its parent grid.
    const firstStat = page.getByRole('link', { name: /Clinical Check Queue/ });
    await expect(firstStat).toBeVisible();
    const opsStrip = firstStat.locator('xpath=..');

    await expect(opsStrip).toHaveScreenshot('dashboard-ops-strip.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('dashboard — quick actions card', async ({ page }) => {
    await page.goto(asUrl(`/${CLINIC}/dashboard`));

    // The "Quick actions" CardHeader sits inside the card; walk up to the
    // bordered card wrapper that contains the action grid below it.
    const quickActionsHeading = page.getByRole('heading', { name: /Quick actions/ });
    await expect(quickActionsHeading).toBeVisible();
    const quickActionsCard = quickActionsHeading.locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');
    await expect(quickActionsCard.getByRole('link', { name: /Log incident/ })).toBeVisible();

    await expect(quickActionsCard).toHaveScreenshot('dashboard-quick-actions.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('patient detail — hero header', async ({ page }) => {
    await page.goto(asUrl(`/${CLINIC}/patients/${PATIENT_ID}`));

    // The hero block contains the patient's h1 + their PT-id; anchor on the
    // h1 and walk up to the bordered hero container.
    const nameHeading = page.locator('h1').first();
    await expect(nameHeading).toBeVisible();
    await expect(page.getByText(PATIENT_ID, { exact: true })).toBeVisible();
    const hero = nameHeading.locator('xpath=ancestor::div[contains(@class, "border-b")][1]');

    await expect(hero).toHaveScreenshot('patient-detail-hero.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('amendments — filter chips bar', async ({ page }) => {
    await page.goto(asUrl(`/${CLINIC}/amendments`));

    // Chip buttons render with their label text — the "All" chip is always
    // present; its parent flex row is the chip bar.
    const allChip = page.getByRole('button', { name: /^All\s*\d+$/ });
    await expect(allChip).toBeVisible();
    const chipBar = allChip.locator('xpath=..');
    await expect(chipBar.getByRole('button', { name: /Requested/ })).toBeVisible();

    await expect(chipBar).toHaveScreenshot('amendments-filter-chips.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('incident detail — severity banner', async ({ page }) => {
    await page.goto(asUrl(`/${CLINIC}/incidents/${INCIDENT_ID}`));

    // INC-001 is seeded as a mild "delayed_dispensing" incident — the
    // banner's title is rendered exactly as "<Severity> severity — <Type>".
    const bannerTitle = page.getByText(/Mild severity\s*[—-]\s*Delayed dispensing/);
    await expect(bannerTitle).toBeVisible();
    const banner = bannerTitle.locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');

    await expect(banner).toHaveScreenshot('incident-severity-banner.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('incidents list — log incident modal', async ({ page }) => {
    await page.goto(asUrl(`/${CLINIC}/incidents`));

    // Wait for the trigger to be hydrated/clickable before opening the modal.
    const trigger = page.getByRole('button', { name: /Create incident/ });
    await expect(trigger).toBeVisible();
    await trigger.click();

    // The modal renders an <h2>Log incident</h2>; walk up to the dialog panel
    // (the dialog wrapper uses `rounded-xl`, hence the broader class match).
    const modalTitle = page.getByRole('heading', { name: 'Log incident' });
    await expect(modalTitle).toBeVisible();
    const modal = modalTitle.locator(
      'xpath=ancestor::div[contains(@class, "rounded-xl") or contains(@class, "rounded-lg")][1]'
    );

    await expect(modal).toHaveScreenshot('incident-log-modal.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('sign-in — Clerk card shell', async ({ page }) => {
    // Sign-in is anonymous, so no ?as= persona. The Clerk <SignIn>
    // component renders client-side; wait on its "Sign in" heading
    // before snapshotting so we don't race the widget mount. We scope
    // to the centered <main> wrapper rather than the full viewport so
    // browser-chrome / scrollbar differences don't leak into the diff.
    await page.goto('/sign-in');

    const heading = page.getByRole('heading', { name: /Sign in/i });
    await expect(heading).toBeVisible();
    // Clerk lazy-renders its provider buttons after the form; waiting on
    // the email input keeps the snapshot stable across runs.
    await expect(page.getByLabel(/email/i).first()).toBeVisible();

    const main = page.locator('main');

    await expect(main).toHaveScreenshot('sign-in-clerk-card.png', {
      animations: 'disabled',
      // Clerk's widget pulls webfonts and renders provider icons from its
      // CDN, so we leave more headroom than the in-app baselines. Any
      // genuine layout/branding regression still blows past this.
      maxDiffPixelRatio: 0.05,
    });
  });

  test('complaints inbox — KPI strip', async ({ page }) => {
    // Owner persona (Qadir) — the page-level Coach gate would 307 a
    // Coach back to the dashboard.
    await page.goto(asUrl(`/${CLINIC}/complaints`));

    // The five KPI tiles render after fixtures load. Anchor on the first
    // tile's label, then walk up to the grid row that wraps all five.
    const breachedTile = page.getByText(/OPEN\s*·\s*BREACHED/i);
    await expect(breachedTile).toBeVisible();
    const kpiStrip = breachedTile.locator(
      'xpath=ancestor::div[contains(@class, "grid-cols-5")][1]'
    );
    // Sanity: the last tile should be present too, so the row is fully painted.
    await expect(kpiStrip.getByText(/ESCALATED TO REGULATOR/i)).toBeVisible();

    await expect(kpiStrip).toHaveScreenshot('complaints-kpi-strip.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('gp letter detail — letter body card', async ({ page }) => {
    await page.goto(asUrl(`/${CLINIC}/gp-letters/${GP_LETTER_ID}`));

    // Scope to the "Letter body" card by anchoring on its h3 heading.
    const bodyHeading = page.getByRole('heading', { name: 'Letter body' });
    await expect(bodyHeading).toBeVisible();
    const bodyCard = bodyHeading.locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');

    await expect(bodyCard).toHaveScreenshot('gp-letter-body-card.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('clinical check — slide-over header', async ({ page }) => {
    // Open the Clinical Check queue and click the first row to mount the
    // 420px slide-over. The slide-over header carries patient name +
    // order id badge + "Full detail" link + close button — a small,
    // stable region that surfaces design drift on the busiest review
    // surface in the app.
    await page.goto(asUrl(`/${CLINIC}/clinical-check`));

    // Each clinical-check row renders the patient's "PT-NNNNN · ORD-NNNNN"
    // mono caption. Wait for the first one before clicking.
    const firstRowCaption = page.locator('text=/PT-\\d{5}\\s*·\\s*ORD-\\d{5}/').first();
    await expect(firstRowCaption).toBeVisible();
    await firstRowCaption.click();

    // Slide-over mounts with a "Close panel" aria-label; walk up to the
    // bordered header strip that wraps the avatar/name/id/full-detail row.
    const closeBtn = page.getByRole('button', { name: 'Close panel' });
    await expect(closeBtn).toBeVisible();
    const slideOverHeader = closeBtn.locator(
      'xpath=ancestor::div[contains(@class, "border-b")][1]'
    );
    // Sanity: the "Full detail" link is part of this header row.
    await expect(slideOverHeader.getByRole('link', { name: /Full detail/ })).toBeVisible();

    await expect(slideOverHeader).toHaveScreenshot('clinical-check-slideover-header.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('orders list — table header row', async ({ page }) => {
    await page.goto(asUrl(`/${CLINIC}/orders`));

    // "Last update" is unique to the orders-context column set (the
    // clinical-check context uses "Waiting" instead), so anchoring on
    // it scopes us to the right table and ignores any clinical-check
    // queue rendered elsewhere.
    const lastUpdateHead = page.getByRole('columnheader', { name: 'Last update' });
    await expect(lastUpdateHead).toBeVisible();
    const headerRow = lastUpdateHead.locator('xpath=ancestor::tr[1]');
    // Sanity: all seven column labels should be present in the row.
    await expect(headerRow.getByRole('columnheader', { name: 'Order' })).toBeVisible();
    await expect(headerRow.getByRole('columnheader', { name: 'Action' })).toBeVisible();

    // Slight headroom (0.05) absorbs sub-pixel column-width jitter from
    // <table> auto-sizing — the body rows below influence the thead's
    // column widths, so any one-pixel reflow shows up in the diff.
    await expect(headerRow).toHaveScreenshot('orders-list-table-header.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.05,
    });
  });

  test('welcome calls — queue tab bar', async ({ page }) => {
    await page.goto(asUrl(`/${CLINIC}/welcome-calls`));

    // The "All" pill is always rendered and uniquely identifies the tab
    // bar; walk up to its rounded container that wraps all five chips.
    const allTab = page.getByRole('button', { name: /^All/ });
    await expect(allTab).toBeVisible();
    const tabBar = allTab.locator(
      'xpath=ancestor::div[contains(@class, "rounded-xl")][1]'
    );
    // Sanity: the "Unreachable" chip closes out the row.
    await expect(tabBar.getByRole('button', { name: /Unreachable/ })).toBeVisible();

    await expect(tabBar).toHaveScreenshot('welcome-calls-tab-bar.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('complaint detail — header strip', async ({ page }) => {
    await page.goto(asUrl(`/${CLINIC}/complaints/${COMPLAINT_ID}`));

    // The header carries the complaint id, status badge, severity pill
    // and Resync / Resolve / "Open in Monday" controls. Anchor on the
    // CMP id mono text and walk up to the bordered header strip.
    const idText = page.getByText(COMPLAINT_ID, { exact: true });
    await expect(idText).toBeVisible();
    const header = idText.locator(
      'xpath=ancestor::div[contains(@class, "border-b")][1]'
    );
    // Sanity: the primary "Open in Monday" CTA should be in this row.
    await expect(header.getByRole('link', { name: /Open in Monday/ })).toBeVisible();

    await expect(header).toHaveScreenshot('complaint-detail-header.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });
});
