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
});
