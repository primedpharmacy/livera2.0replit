/**
 * E2E — Task #313: Catch staff attachment 404s in the browser before
 * patients see them.
 *
 * The persistence + pruning of staged uploads is covered by API-level
 * tests, but the original bug (an attachment chip 404'ing in the
 * patient-facing view after the api-server restarted) was a real
 * browser-side experience. This spec exercises the full path a
 * clinician + patient share:
 *
 *   1. Open Order Detail for ORD-00441 (Sarah Cookland → PT-00198).
 *   2. Switch to the Intercom tab and wait for the seeded conversation
 *      to expand so the inline compose box mounts.
 *   3. Attach a file with unique bytes via the hidden file picker, wait
 *      for the upload chip to flip from "uploading" to "ready", and
 *      capture the upload id + download URL the api-server handed back.
 *   4. Type a reply and click "Send reply" — the staged upload id is
 *      forwarded in the reply payload, so the canonical part the
 *      server returns embeds the same /api/intercom/:clinic/uploads/:id
 *      URL as a chip on the new admin bubble.
 *   5. Sanity: fetch the upload URL through the workspace proxy and
 *      assert the bytes round-trip — this is the "happy path" before
 *      we yank the api-server out from under it.
 *   6. Restart the api-server: kill the live process and respawn
 *      `node ./dist/index.mjs` ourselves bound to the same PORT, then
 *      poll `/api/healthz` until it comes back. Uploads are persisted
 *      to Postgres (BYTEA), so the new process inherits the bytes — if
 *      anything regresses in the persistence layer or the URL-stitching
 *      this assertion will turn red.
 *   7. Reload the page, switch back to the Intercom tab, expand the
 *      same conversation, click the chip, and assert the response is
 *      200 with the original bytes.
 *
 * Pre-conditions: same as `intercomWebhookLive.spec.ts` /
 * `intercomAdminReplyLive.spec.ts` — both the `web` and `API Server`
 * workflows must be running, and PLAYWRIGHT_BASE_URL must point at the
 * workspace router so `/api/intercom/*` is proxied to the api-server.
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost \
 *     pnpm --filter @workspace/web exec playwright test \
 *     tests/e2e/intercomAttachmentSurvivesRestartLive.spec.ts
 *
 * The test takes over the api-server's lifecycle for ~10s while it
 * respawns; the replacement process keeps running after the test
 * finishes, so re-run `restart_workflow` on `API Server` if you want
 * the workflow runner to own it again afterwards.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLINIC = 'feeltru';
const ORDER_ID = 'ORD-00441';
const PATIENT_ID = 'PT-00198';
const DEMO_USER_ID = 'user_qadir';

// The api-server's artifact pins localPort = 8080 (see
// artifacts/api-server/.replit-artifact/artifact.toml) and the workspace
// router maps /api/* to it, so PORT=8080 is what we re-bind to.
const API_PORT = Number(process.env.API_SERVER_PORT ?? '8080');
const REPO_ROOT = resolve(__dirname, '../../../../');
const API_DIST = resolve(
  REPO_ROOT,
  'artifacts/api-server/dist/index.mjs',
);

/**
 * Tear down whatever is currently listening on the api-server's port,
 * respawn `node ./dist/index.mjs` against the same port using the
 * current env (so DATABASE_URL, SESSION_SECRET, INTERCOM_ENCRYPTION_KEY
 * etc. carry over), and poll /api/healthz until it comes back.
 *
 * Killing the workflow's child process leaves the workflow runner
 * thinking the API Server is still up; the README in tests/e2e/ flags
 * the live tests as requiring manual workflow babysitting, so this is
 * an acceptable trade-off for catching the 404-after-restart bug end
 * to end.
 */
async function restartApiServer(request: APIRequestContext): Promise<void> {
  // Find any process holding the api-server's port. lsof -ti is the
  // most portable way that works in the Replit container.
  const lsof = spawnSync('lsof', ['-ti', `:${API_PORT}`], {
    encoding: 'utf8',
  });
  const pids = lsof.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^\d+$/.test(s))
    .map((s) => Number(s));

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already dead — race with the workflow runner is fine.
    }
  }

  // Wait for the port to actually free up before respawning, otherwise
  // the new process EADDRINUSEs and exits immediately.
  await expect
    .poll(
      () => {
        const check = spawnSync('lsof', ['-ti', `:${API_PORT}`], {
          encoding: 'utf8',
        });
        return check.stdout.trim();
      },
      { message: `port ${API_PORT} should be free after kill`, timeout: 10_000 },
    )
    .toBe('');

  const child = spawn('node', ['--enable-source-maps', API_DIST], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(API_PORT) },
    detached: true,
    stdio: 'ignore',
  });
  // Detach so Playwright's worker exit doesn't drag the new process
  // down with it; we deliberately leave it running for follow-up
  // interactive debugging.
  child.unref();

  // Poll the workspace-proxied healthz until the replacement is up.
  // We hit it through the same proxy the browser uses, so a 200 here
  // also proves /api/* routing is intact.
  await expect
    .poll(
      async () => {
        try {
          const res = await request.get('/api/healthz', { timeout: 2_000 });
          return res.status();
        } catch {
          return 0;
        }
      },
      {
        message: 'api-server should respond to /api/healthz after restart',
        timeout: 30_000,
        intervals: [250, 500, 1_000],
      },
    )
    .toBe(200);
}

test.describe('Intercom staged attachment survives an api-server restart', () => {
  test('chip URL still serves the original bytes after the api-server is bounced', async ({
    page,
    request,
  }) => {
    // Sanity: api-server is reachable through the workspace proxy and
    // the patient is already linked to the seeded Intercom contact —
    // matches the precondition the other live tests assert.
    const listed = await request.get(
      `/api/intercom/${CLINIC}/contacts/${PATIENT_ID}/conversations`,
    );
    expect(listed.status()).toBe(200);
    expect(((await listed.json()) as { linked: boolean }).linked).toBe(true);

    // 1. Open Order Detail. The `?as=` query triggers the demo-persona
    //    middleware so we skip /sign-in and land authenticated as the
    //    default Owner (Qadir Hussain).
    await page.goto(`/${CLINIC}/orders/${ORDER_ID}?as=${DEMO_USER_ID}`);
    await expect(page.locator('h1', { hasText: ORDER_ID })).toBeVisible();

    // 2. Switch to the Intercom tab and wait for the seeded
    //    conversation to render — the inline compose box only mounts
    //    once a conversation is expanded.
    await page.getByRole('button', { name: /^Intercom/ }).first().click();
    await expect(
      page.getByText('Question about my next dose').first(),
    ).toBeVisible({ timeout: 10_000 });

    const composeTextarea = page.getByPlaceholder(/Type a reply to the patient/);
    await expect(composeTextarea).toBeVisible({ timeout: 10_000 });

    // 3. Attach a file with unique bytes. The picker is a hidden
    //    <input type="file"> rendered by AttachmentPickerButton, so we
    //    target the file input inside the inline compose container.
    //    We listen for the POST /uploads response in parallel so we
    //    can capture the server-assigned id + URL without having to
    //    scrape them out of the DOM.
    const marker = `ATT-RESTART-${randomBytes(4).toString('hex')}`;
    const fileName = `attachment-${marker}.txt`;
    const fileBytes = Buffer.from(
      `Staff attachment payload — must survive an api-server restart. Marker:${marker}\n`,
      'utf8',
    );

    const uploadResponsePromise = page.waitForResponse(
      (r) =>
        new RegExp(`/api/intercom/${CLINIC}/uploads$`).test(r.url()) &&
        r.request().method() === 'POST',
      { timeout: 15_000 },
    );

    // The picker is `<input type=file>` hidden via className="hidden".
    // setInputFiles works regardless of visibility, so we don't need to
    // open the system file dialog.
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: fileName,
        mimeType: 'text/plain',
        buffer: fileBytes,
      });

    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(201);
    const uploadJson = (await uploadResponse.json()) as {
      id: string;
      name: string;
      byte_size: number;
      content_type: string;
      url: string;
    };
    expect(uploadJson.byte_size).toBe(fileBytes.byteLength);
    expect(uploadJson.url).toMatch(
      new RegExp(`/api/intercom/${CLINIC}/uploads/${uploadJson.id}$`),
    );

    // Chip flips out of its uploading state — the "ready" chip lives
    // inside the compose box and shows the original filename.
    await expect(page.getByTitle(fileName).first()).toBeVisible({
      timeout: 10_000,
    });

    // 4. Type the reply and send it. The optimistic admin bubble carries
    //    the same attachment URL, and the server-canonical part that
    //    replaces it preserves the id.
    const replyBody = `Latest dose notes attached — ${marker}`;
    await composeTextarea.fill(replyBody);
    const replyResponsePromise = page.waitForResponse(
      (r) =>
        /\/api\/intercom\/[^/]+\/contacts\/[^/]+\/conversations\/[^/]+\/reply$/.test(
          r.url(),
        ) && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await page.getByRole('button', { name: /^Send reply$/ }).click();
    const replyResponse = await replyResponsePromise;
    expect(replyResponse.status()).toBe(201);
    const replyConversationId =
      replyResponse.url().match(/conversations\/([^/]+)\/reply$/)?.[1] ?? '';
    expect(replyConversationId).not.toBe('');

    // The chip on the just-sent admin bubble exposes the canonical URL.
    // Its href is the same upload URL the API handed us at staging
    // time, so the URL-stitching path is what we'll re-exercise after
    // the restart.
    const chip = page
      .locator('a')
      .filter({ hasText: fileName })
      .first();
    await expect(chip).toBeVisible({ timeout: 10_000 });
    const chipHrefBefore = await chip.getAttribute('href');
    expect(chipHrefBefore).not.toBeNull();
    expect(chipHrefBefore!).toMatch(
      new RegExp(`/api/intercom/${CLINIC}/uploads/${uploadJson.id}$`),
    );

    // 5. Sanity round-trip *before* the restart so a failure after the
    //    restart is unambiguously a regression in the persistence /
    //    URL-stitching layer and not a flaky upload.
    const preRestart = await request.get(chipHrefBefore!);
    expect(preRestart.status()).toBe(200);
    expect(Buffer.from(await preRestart.body()).equals(fileBytes)).toBe(true);

    // 6. Bounce the api-server. The new process boots against the same
    //    Postgres so the staged upload row is still there — that's the
    //    contract this test exists to defend.
    await restartApiServer(request);

    // 7. Reload the patient's order, re-open the Intercom tab, re-expand
    //    the conversation we just replied to, and assert the chip still
    //    points at the same URL and still downloads the original bytes.
    await page.reload();
    await expect(page.locator('h1', { hasText: ORDER_ID })).toBeVisible();
    await page.getByRole('button', { name: /^Intercom/ }).first().click();

    // The reply we just sent floated this conversation to the top, so
    // expanding it again is enough — but be defensive and look for our
    // marker in the rendered thread first.
    await expect(page.getByText(new RegExp(marker)).first()).toBeVisible({
      timeout: 15_000,
    });

    const chipAfter = page
      .locator('a')
      .filter({ hasText: fileName })
      .first();
    await expect(chipAfter).toBeVisible({ timeout: 10_000 });
    const chipHrefAfter = await chipAfter.getAttribute('href');
    expect(chipHrefAfter).toBe(chipHrefBefore);

    // The real assertion: actually *click* the chip the way a clinician
    // (and, after a forward — the patient) would, and assert the
    // browser's navigation response is 200 with the original bytes.
    // The chip carries target="_blank", so the click opens a popup; we
    // capture that page's main-frame response so a regression in the
    // URL-stitching path *or* the persistence layer surfaces as a real
    // browser-side failure instead of just an API-shaped one.
    const popupPromise = page.context().waitForEvent('page', {
      timeout: 10_000,
    });
    await chipAfter.click();
    const popup = await popupPromise;
    const navigationResponse = await popup.waitForResponse(
      (r) => r.url() === chipHrefAfter,
      { timeout: 10_000 },
    );
    expect(
      navigationResponse.status(),
      `chip download must succeed after restart, got ${navigationResponse.status()}`,
    ).toBe(200);
    expect(
      Buffer.from(await navigationResponse.body()).equals(fileBytes),
    ).toBe(true);

    // And the inline-rendered body the patient/clinician actually sees
    // when the chip opens matches the original — text/plain bodies
    // render as a single <pre> in Chromium, so document.body.innerText
    // is the user-visible payload.
    await popup.waitForLoadState('domcontentloaded');
    const visibleText = await popup.evaluate(
      () => document.body.innerText,
    );
    expect(visibleText.trim()).toBe(fileBytes.toString('utf8').trim());
    await popup.close();
  });
});
