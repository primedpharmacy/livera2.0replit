/**
 * E2E — Task-262: Queue ↑/↓ navigation
 *
 * Covers the cross-page contract between list views (which persist the
 * filtered queue order to sessionStorage under `queue:<kind>`) and detail
 * pages (which read it to show the "Item X of Y" indicator, drive ↑/↓
 * keyboard navigation, and chevron buttons).
 *
 * Flow:
 *   1. Land on the patients list with the demo-persona override, filter to
 *      "Active" so the queue has multiple deterministic items, and click
 *      the first row. The detail page must render the indicator at
 *      "Item 1 of N" (read via the QueuePositionIndicator's aria-label).
 *   2. Press ArrowDown — navigation moves to the next patient in the saved
 *      queue and the indicator updates to "Item 2 of N", with the URL
 *      reflecting the matching patient id from sessionStorage.
 *   3. While focus is inside a text input, ArrowDown must NOT navigate
 *      (the hook's input-ignore guard); URL and indicator stay put.
 *   4. Opening a detail page from a deep link after sessionStorage has been
 *      cleared renders no indicator (graceful hide).
 *
 * Pre-conditions: web dev server on $PORT (default 22333) via the
 * `artifacts/web: web` workflow. CI can pin PLAYWRIGHT_BASE_URL.
 */

import { test, expect, type Page } from '@playwright/test';

const CLINIC = 'vsc';

async function readSavedPatientsQueue(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const raw = window.sessionStorage.getItem('queue:patients');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x: unknown): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
}

function indicator(page: Page) {
  // QueuePositionIndicator's aria-label is the stable signal:
  //   `Item ${pos.index} of ${pos.total} in queue`
  return page.locator('[aria-label$="in queue"]').first();
}

test.describe('Queue ↑/↓ navigation — patients list → detail', () => {
  test('opens row, navigates with ↓, ignores typing, hides on deep link', async ({ page }) => {
    // ── 1. Filter the patients list to Active so the queue is deterministic
    //       (>= 2 items required to test ↑/↓ navigation).
    await page.goto(`/${CLINIC}/patients?as=user_qadir`);
    await expect(page).toHaveURL(`/${CLINIC}/patients`);

    const activeChip = page.getByRole('button', { name: /^Active\s+\d+$/ });
    await activeChip.click();

    // Read the count shown inside the chip ("Active 4") and wait for the
    // table + saved queue to match it. The list applies its filter via a
    // 300ms debounced effect, so without this wait we could race and read
    // the unfiltered queue from sessionStorage.
    const chipText = (await activeChip.textContent())?.trim() ?? '';
    // The label and count render in sibling spans with no whitespace
    // between them (e.g. "Active4"), so pull the trailing digits.
    const expectedCount = Number.parseInt(/(\d+)$/.exec(chipText)?.[1] ?? '0', 10);
    expect(expectedCount).toBeGreaterThanOrEqual(2);

    await expect(page.locator('table tbody tr')).toHaveCount(expectedCount, { timeout: 5_000 });
    await expect
      .poll(async () => (await readSavedPatientsQueue(page)).length, { timeout: 5_000 })
      .toBe(expectedCount);

    const savedQueue = await readSavedPatientsQueue(page);
    expect(
      savedQueue.length,
      'Need at least 2 Active patients in VSC for ↑/↓ navigation. ' +
        'Check artifacts/web/lib/api/fixtures/patients.ts.',
    ).toBeGreaterThanOrEqual(2);

    // Click the first row — it should land on the detail page for queue[0].
    await page.locator('table tbody tr').first().click();
    await expect(page).toHaveURL(`/${CLINIC}/patients/${savedQueue[0]}`);

    // ── 2. Indicator shows "Item 1 of N".
    const total = savedQueue.length;
    await expect(indicator(page)).toHaveAttribute(
      'aria-label',
      `Item 1 of ${total} in queue`,
      { timeout: 5_000 },
    );

    // ── 3. ArrowDown navigates to the next item in the saved queue.
    //       Focus the body first to ensure we're not inside any input.
    await page.locator('body').click();
    await page.keyboard.press('ArrowDown');
    await expect(page).toHaveURL(`/${CLINIC}/patients/${savedQueue[1]}`);
    await expect(indicator(page)).toHaveAttribute(
      'aria-label',
      `Item 2 of ${total} in queue`,
      { timeout: 5_000 },
    );

    // ── 4. Typing in an input must not hijack ↑/↓. Inject a temporary input,
    //       focus it, press ArrowDown, and confirm we did not navigate. This
    //       exercises the hook's INPUT/TEXTAREA/SELECT/contentEditable guard.
    const urlBeforeTyping = page.url();
    await page.evaluate(() => {
      const el = document.createElement('input');
      el.type = 'text';
      el.id = '__queue_nav_test_input';
      document.body.appendChild(el);
      el.focus();
    });
    await page.locator('#__queue_nav_test_input').press('ArrowDown');
    // Give the router a beat to (incorrectly) navigate, then assert it didn't.
    await page.waitForTimeout(300);
    expect(page.url()).toBe(urlBeforeTyping);
    await expect(indicator(page)).toHaveAttribute(
      'aria-label',
      `Item 2 of ${total} in queue`,
    );
    await page.evaluate(() => {
      document.getElementById('__queue_nav_test_input')?.remove();
    });

    // ── 5. Deep link with no saved queue: clear sessionStorage and open a
    //       detail page directly. The indicator must not render.
    await page.evaluate(() => window.sessionStorage.removeItem('queue:patients'));
    await page.goto(`/${CLINIC}/patients/${savedQueue[0]}?as=user_qadir`);
    await expect(page).toHaveURL(`/${CLINIC}/patients/${savedQueue[0]}`);
    // Wait for the page to settle (breadcrumb visible) before asserting the
    // indicator's absence — the useEffect that reads sessionStorage runs on
    // mount, so if it were going to appear it would have by now.
    await expect(page.getByRole('link', { name: /Patients/ }).first()).toBeVisible();
    await expect(indicator(page)).toHaveCount(0);
  });
});
