/**
 * E2E — Task-239: Sidebar queue badge live-update across every queue
 *
 * Parameterised counterpart to `complaintsBadgeLiveUpdate.spec.ts`. For each
 * queue that wires `dispatchQueueCountChange` from its detail page (clinical
 * check, amendments, welcome calls, incidents, GP letters, discontinuations),
 * we:
 *
 *   1. Open an open/actionable fixture item with the `?as=user_qadir`
 *      demo-persona middleware override so the sidebar renders with full nav.
 *   2. Capture the sidebar badge value before the action.
 *   3. Perform the queue-specific status-changing action.
 *   4. Assert the badge decrements live — without a full page reload (proven
 *      via a `window.__noReloadSentinel` sentinel that survives only across
 *      SPA-style updates, not navigations).
 *   5. Where the action is reversible, perform the inverse action and assert
 *      the badge increments back to its original value.
 *
 * Notes:
 *   - When a badge count reaches 0 the BadgePill is unmounted (the Sidebar
 *     only renders it for counts > 0), so we assert `toHaveCount(0)` in that
 *     case rather than `toHaveText('0')`.
 *   - The mock fixtures mutate in-memory, so one-way actions (amendments
 *     reject, GP-letter send, discontinuations close) mutate the dev-server
 *     state for that process lifetime. Each test only depends on its own
 *     fixture being open at start; a workflow restart resets all fixtures.
 *   - Pre-condition: web dev server running on $PORT (default 22333), via the
 *     `artifacts/web: web` workflow. CI can override with PLAYWRIGHT_BASE_URL.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type QueueKey =
  | 'clinical_check'
  | 'amendments'
  | 'welcome_calls'
  | 'incidents'
  | 'gp_letters'
  | 'discontinuations';

// The sidebar nav uses dashed URLs for some queues; the dispatch event uses
// underscored queue keys. Map between the two.
const QUEUE_HREF: Record<QueueKey, string> = {
  clinical_check:   'clinical-check',
  amendments:       'amendments',
  welcome_calls:    'welcome-calls',
  incidents:        'incidents',
  gp_letters:       'gp-letters',
  discontinuations: 'discontinuations',
};

function navLink(page: Page, clinic: string, queue: QueueKey): Locator {
  return page.locator(`nav a[href="/${clinic}/${QUEUE_HREF[queue]}"]`).first();
}

function navBadge(page: Page, clinic: string, queue: QueueKey): Locator {
  return navLink(page, clinic, queue).locator('span.rounded-full');
}

async function readBadgeCount(page: Page, clinic: string, queue: QueueKey): Promise<number> {
  const badge = navBadge(page, clinic, queue);
  const count = await badge.count();
  if (count === 0) return 0;
  const text = (await badge.first().textContent())?.trim() ?? '';
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) ? n : 0;
}

async function installSentinel(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __noReloadSentinel: number;
      __queueEvents: Array<{ queue: string; delta?: number; count?: number }>;
    };
    w.__noReloadSentinel = Date.now();
    w.__queueEvents = [];
    window.addEventListener('queue-count-changed', (e) => {
      w.__queueEvents.push((e as CustomEvent).detail);
    });
  });
}

async function dispatchedQueueEvents(
  page: Page,
): Promise<Array<{ queue: string; delta?: number; count?: number }>> {
  return page.evaluate(
    () =>
      (window as unknown as {
        __queueEvents?: Array<{ queue: string; delta?: number; count?: number }>;
      }).__queueEvents ?? [],
  );
}

async function sentinelStillSet(page: Page): Promise<boolean> {
  return page.evaluate(
    () => typeof (window as unknown as { __noReloadSentinel?: number }).__noReloadSentinel === 'number',
  );
}

async function expectBadgeBecomes(
  page: Page,
  clinic: string,
  queue: QueueKey,
  expected: number,
) {
  // 15s timeout accommodates the very first action of a fresh dev-server
  // run, where Next.js may still be compiling the server-action route on
  // demand. Steady-state updates resolve in well under a second.
  if (expected === 0) {
    await expect(navBadge(page, clinic, queue)).toHaveCount(0, { timeout: 15_000 });
  } else {
    await expect(navBadge(page, clinic, queue).first()).toHaveText(String(expected), {
      timeout: 15_000,
    });
  }
}

// ─── Case definitions ────────────────────────────────────────────────────────
//
// Each case opens an item, performs a status-changing action that *closes*
// the item (decrementing the queue), and optionally a reverse action that
// *reopens* it (incrementing the queue back).

interface QueueCase {
  queue: QueueKey;
  clinic: 'vsc' | 'feeltru';
  itemId: string;
  // Path relative to the clinic, e.g. `complaints/CMP-004` or
  // `clinical-check` (slide-over flow uses the queue index page).
  openPath: string;
  // Optional demo persona override. Defaults to `user_qadir` (Owner) which
  // has most permissions; `clinical_check` overrides with `user_claire`
  // (the only seeded Prescriber, on FeelTru) because deciding on an order
  // requires the Prescriber role.
  persona?: string;
  // Selector to assert we landed on the right page before acting.
  landedAssertion: (page: Page) => Promise<void>;
  // Action that decrements the queue (closes the item).
  closeAction: (page: Page) => Promise<void>;
  // Optional inverse action that increments the queue back.
  reopenAction?: (page: Page) => Promise<void>;
}

const CLINICAL_NOTE_40 = 'Reviewed clinical history and weight trend. No contraindications — approve.';

const CASES: QueueCase[] = [
  // ── incidents (reversible: investigating <-> resolved) ─────────────────────
  {
    queue: 'incidents',
    clinic: 'vsc',
    itemId: 'INC-003',
    openPath: 'incidents/INC-003',
    landedAssertion: async (page) => {
      await expect(page.getByText('INC-003').first()).toBeVisible();
    },
    closeAction: async (page) => {
      await page.getByRole('button', { name: /^Resolved$/ }).click();
    },
    reopenAction: async (page) => {
      await page.getByRole('button', { name: /^Under investigation$/ }).click();
    },
  },

  // ── welcome_calls (reversible: awaiting -> unreachable -> reopen) ─────────
  {
    queue: 'welcome_calls',
    clinic: 'vsc',
    itemId: 'WC-0058',
    openPath: 'welcome-calls/WC-0058',
    landedAssertion: async (page) => {
      await expect(page.getByText('WC-0058').first()).toBeVisible();
    },
    closeAction: async (page) => {
      await page.getByRole('button', { name: /^Mark unreachable$/ }).click();
      const dialog = page.getByRole('heading', { name: /Close call as unreachable/i });
      await expect(dialog).toBeVisible();
      await page.locator('textarea').first().fill('Three attempts, no answer — closing per SOP.');
      await page.getByRole('button', { name: /^Close as unreachable$/ }).click();
    },
    reopenAction: async (page) => {
      await page.getByRole('button', { name: /^Reopen$/ }).click();
    },
  },

  // ── amendments (one-way: requested -> approved). Approve has no rationale
  //    textarea so the flow is simpler/more deterministic than Reject. ────────
  {
    queue: 'amendments',
    clinic: 'feeltru',
    itemId: 'AMEND-001',
    openPath: 'amendments/AMEND-001',
    landedAssertion: async (page) => {
      await expect(page.getByText('AMEND-001').first()).toBeVisible();
    },
    closeAction: async (page) => {
      await page.getByRole('button', { name: /^Approve$/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: /Approve Amendment/i })).toBeVisible();
      await dialog.getByRole('button', { name: /^Confirm Approve$/ }).click();
      // Wait for the toast that confirms the server action completed.
      await expect(page.getByText(/Amendment approved successfully/i)).toBeVisible({ timeout: 10_000 });
    },
  },

  // ── gp_letters (one-way: draft/owed -> sent) ───────────────────────────────
  {
    queue: 'gp_letters',
    clinic: 'feeltru',
    itemId: 'GPL-002',
    openPath: 'gp-letters/GPL-002',
    landedAssertion: async (page) => {
      await expect(page.getByText('GPL-002').first()).toBeVisible();
    },
    closeAction: async (page) => {
      await page.getByRole('button', { name: /^Send letter$/ }).click();
    },
  },

  // ── discontinuations (one-way: open -> closed; window.confirm()) ──────────
  {
    queue: 'discontinuations',
    clinic: 'feeltru',
    itemId: 'DISC-00001',
    openPath: 'discontinuations/DISC-00001',
    landedAssertion: async (page) => {
      await expect(page.getByText('DISC-00001').first()).toBeVisible();
    },
    closeAction: async (page) => {
      // Close protocol triggers a browser confirm() — auto-accept it.
      page.once('dialog', (d) => { void d.accept(); });
      await page.getByRole('button', { name: /^Close protocol$/ }).click();
    },
  },

  // ── clinical_check (slide-over Approve from the queue index page) ─────────
  //    Uses FeelTru + user_claire because deciding on an order requires the
  //    Prescriber role and user_claire is the only seeded Prescriber. Owner
  //    (user_qadir) and Admin (user_yohan) cannot see the Approve button.
  {
    queue: 'clinical_check',
    clinic: 'feeltru',
    itemId: 'ORD-00441',
    openPath: 'clinical-check',
    persona: 'user_claire',
    landedAssertion: async (page) => {
      // Click the row for ORD-00441 to open the slide-over.
      const row = page.getByText('ORD-00441').first();
      await expect(row).toBeVisible();
      await row.click();
      // Slide-over Approve button is visible in the action bar.
      await expect(page.getByRole('button', { name: /^Approve$/ })).toBeVisible();
    },
    closeAction: async (page) => {
      await page.getByRole('button', { name: /^Approve$/ }).click();
      // ApproveConfirmModal places its textarea behind this exact placeholder.
      // Use the placeholder selector to avoid ambiguity with the slide-over
      // (which is also a Radix Dialog).
      const textarea = page.getByPlaceholder(/Clinical rationale for approving this order/i);
      await expect(textarea).toBeVisible();
      // pressSequentially mimics real keystrokes so React's controlled-input
      // onChange fires reliably (fill() has been flaky in this dialog).
      await textarea.click();
      await textarea.pressSequentially(CLINICAL_NOTE_40, { delay: 5 });
      const confirm = page.getByRole('button', { name: /^Confirm Approve$/ });
      await expect(confirm).toBeEnabled({ timeout: 5_000 });
      await confirm.click();
      // Wait for the modal heading to disappear as proof the action completed.
      await expect(page.getByRole('heading', { name: /Approve Order/i })).toBeHidden({
        timeout: 10_000,
      });
    },
  },
];

// pdfkit (used by sendGPLetterAction's PDF pipeline) reads AFM font metric
// files from a path that Next.js Turbopack's vendor-chunk output does not
// always include. Copy them from the package source into the expected build
// location before running so that the GP-letter Send action does not fail
// with ENOENT in this dev environment.
function ensurePdfkitAfmFiles() {
  const src = join(
    process.cwd(),
    'node_modules',
    'pdfkit',
    'js',
    'data',
  );
  const dst = join(process.cwd(), '.next', 'server', 'vendor-chunks', 'data');
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const file of readdirSync(src)) {
    if (file.endsWith('.afm')) {
      try {
        copyFileSync(join(src, file), join(dst, file));
      } catch {
        /* ignore copy failures — test will surface ENOENT if it matters */
      }
    }
  }
}

test.beforeAll(() => {
  ensurePdfkitAfmFiles();
});

test.describe('Sidebar queue badges — live update on detail-page actions', () => {
  for (const c of CASES) {
    test(`${c.queue}: badge updates live when ${c.itemId} status changes`, async ({ page }) => {
      // 1. Land on the detail (or queue) page via the demo-persona override.
      const persona = c.persona ?? 'user_qadir';
      await page.goto(`/${c.clinic}/${c.openPath}?as=${persona}`);
      await expect(page).toHaveURL(new RegExp(`/${c.clinic}/${c.openPath.replace(/[-/]/g, '[-/]')}$`));
      await c.landedAssertion(page);

      // 2. Sentinel + initial badge value. The badge may legitimately be
      //    hidden (count == 0) if the fixture has been mutated by a previous
      //    one-way test in the same dev-server lifetime; in that case we
      //    abort cleanly with a clear error rather than producing a
      //    confusing assertion failure.
      await installSentinel(page);
      await expect(navLink(page, c.clinic, c.queue)).toBeVisible();
      // Wait for the sidebar's async count fetch to settle before reading.
      // The Sidebar only renders the BadgePill when count > 0, so when the
      // fixture is open we expect the pill to appear; if it never does, we
      // surface a clear error below.
      await expect(navBadge(page, c.clinic, c.queue))
        .toBeVisible({ timeout: 10_000 })
        .catch(() => undefined);
      const initial = await readBadgeCount(page, c.clinic, c.queue);
      expect(
        initial,
        `${c.queue} fixture for ${c.itemId} must be open at start (got badge=${initial}). ` +
          `Restart the web workflow to reset fixtures if a previous run mutated them.`,
      ).toBeGreaterThanOrEqual(1);

      // 3. Close the item → badge should decrement live.
      await c.closeAction(page);
      try {
        await expectBadgeBecomes(page, c.clinic, c.queue, initial - 1);
      } catch (err) {
        // Surface dispatched events on failure so we can distinguish
        // between "dispatch never fired" vs "sidebar listener missed it".
        const eventsAfterClose = await dispatchedQueueEvents(page);
        throw new Error(
          `${c.queue}: badge did not decrement after closeAction. ` +
            `queue-count-changed events captured: ${JSON.stringify(eventsAfterClose)}. ` +
            `Original: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // 4. No full document reload happened.
      expect(await sentinelStillSet(page)).toBe(true);

      // 5. If reversible, reopen and assert the badge increments back.
      if (c.reopenAction) {
        await c.reopenAction(page);
        await expectBadgeBecomes(page, c.clinic, c.queue, initial);
        expect(await sentinelStillSet(page)).toBe(true);
      }
    });
  }
});
