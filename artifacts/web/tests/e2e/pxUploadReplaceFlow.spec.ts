/**
 * E2E — Task-172: Prescription replace flow on Order Detail.
 *
 * Task-119 added a "Replace" affordance to the Patient-uploaded prescription
 * card so staff can swap out the wrong file (illegible scan, wrong page, etc.)
 * via the same presigned-URL + audit pipeline used for the original staff
 * upload. This test pins the end-to-end UX so a future refactor of the staff
 * upload pipeline cannot silently regress:
 *
 *   1. confirm modal opens with the prior file's metadata,
 *   2. the hidden file input is triggered after confirming,
 *   3. the card updates to the new filename,
 *   4. the [AUDIT] line records is_replacement=true with the prior file
 *      snapshot under replaced_from.
 *
 * The audit assertion needs server stdout, so this spec spawns its own
 * `next dev` instance on a fresh port and captures the dev server's output
 * into an in-memory buffer instead of piggy-backing on the shared workflow.
 *
 * Seed: ORD-00451 (FeelTru, Zara Ahmed) — GLP-1 higher-dose path with the
 * "Px upload pending" flag. The test first attaches an initial file via the
 * staff upload control (which puts the order into the px_upload != null
 * branch where Replace is rendered) and then exercises the Replace flow.
 */

import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';

const CLINIC = 'feeltru';
const ORDER_ID = 'ORD-00451';
const READY_TIMEOUT_MS = 120_000;
const WEB_ROOT = path.resolve(__dirname, '..', '..');

let server: ChildProcess | null = null;
let stdoutBuf = '';
let baseURL = '';

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      // Any non-5xx means the server is up and serving routes. The middleware
      // happily 200s/302s `/`, so we can stop waiting.
      if (res.status < 500) return;
    } catch {
      // ECONNREFUSED while next is still booting — keep polling.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Dev server at ${url} did not become ready within ${READY_TIMEOUT_MS}ms. ` +
      `Last stdout:\n${stdoutBuf.slice(-2000)}`,
  );
}

test.describe('Px-upload replace flow', () => {
  test.beforeAll(async () => {
    // Random high port to avoid colliding with the shared workspace workflow.
    const port = String(30000 + Math.floor(Math.random() * 5000));
    baseURL = `http://127.0.0.1:${port}`;

    server = spawn(
      'pnpm',
      ['exec', 'next', 'dev', '--port', port, '--hostname', '127.0.0.1'],
      {
        cwd: WEB_ROOT,
        env: {
          ...process.env,
          PORT: port,
          // Force a non-TTY so console.log of objects stays uncoloured —
          // makes the AUDIT regex assertions robust against ANSI codes.
          FORCE_COLOR: '0',
          NO_COLOR: '1',
          NODE_ENV: 'development',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    server.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
    });
    server.stderr?.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
    });

    await waitForServer(baseURL);
  });

  test.afterAll(async () => {
    if (server && !server.killed) {
      server.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      if (!server.killed) server.kill('SIGKILL');
    }
  });

  test('Replace swaps the file and audits the prior upload', async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      await page.goto(`${baseURL}/${CLINIC}/orders/${ORDER_ID}?as=user_qadir`);
      await expect(page.locator('h1', { hasText: ORDER_ID })).toBeVisible({
        timeout: 60_000,
      });

      // The card surfaces the "Patient-uploaded prescription" heading whether
      // we're in the pending-upload branch or the uploaded branch.
      const pxCard = page.locator('div', {
        has: page.getByText('Patient-uploaded prescription', { exact: true }),
      }).first();
      await expect(pxCard).toBeVisible();

      // ── 1. Seed an initial px_upload via the staff "Choose file" control ──
      // ORD-00451 starts with px_upload === null, so the Replace affordance
      // is not yet rendered. The staff upload control shares the same
      // attachPxUpload pipeline, which is exactly what we need to land an
      // existing file the Replace flow can then swap out.
      const initialFilename = `task-172-initial-${Date.now()}.pdf`;
      const replacementFilename = `task-172-replacement-${Date.now()}.pdf`;

      const initialFileInput = page.locator('input[type="file"]').first();
      await initialFileInput.setInputFiles({
        name: initialFilename,
        mimeType: 'application/pdf',
        // 26-byte mock PDF — well under the 10 MB cap, > 0 bytes so it passes
        // the attachPxUpload size guard.
        buffer: Buffer.from('%PDF-1.4\n% task-172 initial\n'),
      });

      // Wait for the UI to flip into the "uploaded" branch with the Replace
      // button visible and the initial filename shown on the card.
      const replaceButton = page.getByRole('button', { name: /^Replace$/ });
      await expect(replaceButton).toBeVisible({ timeout: 60_000 });
      await expect(pxCard).toContainText(initialFilename);

      // Mark the boundary so the AUDIT regex below only looks at the
      // replace-time entries, not the initial upload's audit lines.
      const stdoutBeforeReplace = stdoutBuf.length;

      // ── 2. Click Replace → confirm modal opens with prior file summary ──
      await replaceButton.click();

      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toContainText('Replace patient prescription');
      // The modal surfaces the current file's name so staff know what they
      // are swapping out — explicit assertion catches regressions in the
      // "Current file" summary block.
      await expect(confirmDialog).toContainText(initialFilename);

      // ── 3. Confirm + supply the replacement file ──
      // The "Choose replacement file" button closes the modal and
      // programmatically clicks the hidden #px-replace-file-input element.
      // Waiting for the filechooser event proves the wiring: if a future
      // refactor drops the input.click() call (or removes the hidden input
      // altogether), this assertion fails instead of silently passing on a
      // direct setInputFiles call.
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page
        .getByRole('button', { name: /Choose replacement file/i })
        .click();
      const chooser = await fileChooserPromise;
      await expect(confirmDialog).toBeHidden();
      await chooser.setFiles({
        name: replacementFilename,
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n% task-172 replacement\n'),
      });

      // ── 4. Card flips to the new filename ──
      await expect(pxCard).toContainText(replacementFilename, {
        timeout: 60_000,
      });
      await expect(pxCard).not.toContainText(initialFilename);

      // ── 5. Audit log captured is_replacement=true + replaced_from snapshot ──
      // Give the dev server's stdout listener a beat to flush the audit lines
      // that fire inside attachPxUpload after the finalize route resolves.
      await page.waitForTimeout(500);
      const replaceLogs = stdoutBuf.slice(stdoutBeforeReplace);

      // Two AUDIT entries fire on success: px_upload_attempt and
      // px_upload_result. Both must record the replacement metadata so the
      // attempt is auditable even when the underlying attach throws.
      const attemptAudit = replaceLogs.match(
        /\[AUDIT\][\s\S]*?event_type:\s*'px_upload_attempt'[\s\S]*?(?=\[AUDIT\]|$)/,
      );
      expect(attemptAudit, 'expected px_upload_attempt AUDIT entry').not.toBeNull();
      expect(attemptAudit![0]).toMatch(/is_replacement:\s*true/);
      expect(attemptAudit![0]).toMatch(
        new RegExp(`replaced_from:[\\s\\S]*filename:\\s*'${initialFilename}'`),
      );
      expect(attemptAudit![0]).toMatch(/source:\s*'staff_upload'/);

      const resultAudit = replaceLogs.match(
        /\[AUDIT\][\s\S]*?event_type:\s*'px_upload_result'[\s\S]*?outcome:\s*'success'[\s\S]*?(?=\[AUDIT\]|$)/,
      );
      expect(resultAudit, 'expected successful px_upload_result AUDIT entry').not.toBeNull();
      expect(resultAudit![0]).toMatch(/is_replacement:\s*true/);
      expect(resultAudit![0]).toMatch(
        new RegExp(`replaced_from:[\\s\\S]*filename:\\s*'${initialFilename}'`),
      );
      expect(resultAudit![0]).toMatch(
        new RegExp(`filename:\\s*'${replacementFilename}'`),
      );
    } finally {
      await context.close();
    }
  });
});
