/**
 * E2E — Task-134: Intercom webhook → SSE → Order Detail live update.
 *
 * Locks in the end-to-end path the patient-facing clinician actually
 * experiences:
 *   1. Open Order Detail for an order whose patient is linked to an
 *      Intercom contact (ORD-00441 → PT-00198 → icontact_sarah_feeltru).
 *   2. Switch to the Intercom tab and wait for the seeded demo
 *      conversation (iconv_001) to render.
 *   3. POST a validly-signed `conversation.user.replied` webhook to the
 *      api-server at /api/intercom/feeltru/webhook.
 *   4. The api-server appends the inbound part (demo mode) and broadcasts
 *      on the per-clinic SSE channel; the open OrderIntercomTab re-fetches
 *      and the new message must appear in the open conversation thread
 *      within a few seconds, with no manual page reload.
 *
 * Pre-conditions:
 *   - The `artifacts/web: web` AND `artifacts/api-server: API Server`
 *     workflows must both be running.
 *   - Playwright's `baseURL` must point at the workspace router (default
 *     `http://localhost`, port 80) so the same host serves the Next.js
 *     pages under `/` AND proxies `/api/...` to the api-server. The
 *     spec deliberately uses relative paths so it inherits this from
 *     `playwright.config.ts` / `PLAYWRIGHT_BASE_URL` and stays portable
 *     across local runs and CI. Pointing at the web port directly
 *     (e.g. `http://localhost:22333`) will not work — `/api/intercom/*`
 *     has no Next.js handler.
 *   Run with:
 *     PLAYWRIGHT_BASE_URL=http://localhost \
 *       pnpm --filter @workspace/web exec playwright test \
 *       tests/e2e/intercomWebhookLive.spec.ts
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { createHmac, randomBytes } from 'node:crypto';

const CLINIC = 'feeltru';
const ORDER_ID = 'ORD-00441';
const CONVERSATION_ID = 'iconv_001';
const PATIENT_CONTACT_ID = 'icontact_sarah_feeltru';
// Matches the seedFromEnv() default in api-server/src/lib/intercom-store.ts
// — no INTERCOM_WEBHOOK_SECRET_FEELTRU env var is set in dev, so the stub
// secret is what the running api-server is signing against.
const WEBHOOK_SECRET = process.env['INTERCOM_WEBHOOK_SECRET_FEELTRU'] ?? 'stub_secret_feeltru';

function signBody(body: string): string {
  return 'sha1=' + createHmac('sha1', WEBHOOK_SECRET).update(body).digest('hex');
}

async function postSignedWebhook(
  request: APIRequestContext,
  payload: Record<string, unknown>,
): Promise<void> {
  const rawBody = JSON.stringify(payload);
  const res = await request.post(`/api/intercom/${CLINIC}/webhook`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature': signBody(rawBody),
    },
    data: rawBody,
  });
  expect(res.status(), `webhook POST should be accepted, body: ${await res.text()}`).toBe(200);
}

test.describe('Intercom webhook → live Order Detail update', () => {
  test('inbound patient reply appears in the open Intercom thread without a refresh', async ({
    page,
    request,
  }) => {
    // Sanity: api-server reachable through the workspace proxy and the
    // patient is already linked to a contact (seeded by the api-server).
    const listed = await request.get(
      `/api/intercom/${CLINIC}/contacts/PT-00198/conversations`,
    );
    expect(listed.status()).toBe(200);
    const listedJson = (await listed.json()) as {
      linked: boolean;
      intercom_contact_id: string | null;
    };
    expect(listedJson.linked).toBe(true);
    expect(listedJson.intercom_contact_id).toBe(PATIENT_CONTACT_ID);

    // 1. Open Order Detail for Sarah Cookland's order.
    await page.goto(`/${CLINIC}/orders/${ORDER_ID}?as=user_qadir`);
    await expect(page.locator('h1', { hasText: ORDER_ID })).toBeVisible();

    // 2. Switch to the Intercom tab — this mounts <OrderIntercomTab/>
    //    which opens the SSE connection and lazily fetches the
    //    auto-expanded conversation.
    await page.getByRole('button', { name: /^Intercom/ }).first().click();

    // The seeded thread renders — pick a body fragment unique to iconv_001
    // so we're sure we're looking at the right conversation before the
    // webhook fires.
    await expect(
      page.getByText('Question about my next dose').first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/Thanks Olwyn — that's reassuring/).first(),
    ).toBeVisible({ timeout: 10_000 });

    // 3. POST a validly-signed inbound webhook with a body fragment that
    //    cannot collide with any seeded part.
    const marker = `LIVE-WEBHOOK-${randomBytes(4).toString('hex')}`;
    const inboundBody = `Hi again — one quick follow-up. Marker:${marker}`;
    const nowSec = Math.floor(Date.now() / 1000);

    await postSignedWebhook(request, {
      topic: 'conversation.user.replied',
      data: {
        item: {
          id: CONVERSATION_ID,
          contact_id: PATIENT_CONTACT_ID,
          body: inboundBody,
          part_type: 'comment',
          created_at: nowSec,
          author: {
            type: 'user',
            id: 'icuser_sarah',
            name: 'Sarah Cookland',
            email: 'sarah.cookland@example.com',
          },
        },
      },
    });

    // 4. The SSE listener inside OrderIntercomTab should re-fetch the
    //    conversation and render the new part. The marker appears in two
    //    places: the conversation list preview and the message-bubble
    //    inside the expanded thread — both are valid signals of the live
    //    update arriving without a manual refresh.
    const markerMatches = page.getByText(new RegExp(marker));
    await expect(markerMatches.first()).toBeVisible({ timeout: 10_000 });
    expect(await markerMatches.count()).toBeGreaterThanOrEqual(2);
  });

  test('webhook with an invalid signature is rejected with 401 and does not update the UI', async ({
    page,
    request,
  }) => {
    await page.goto(`/${CLINIC}/orders/${ORDER_ID}?as=user_qadir`);
    await page.getByRole('button', { name: /^Intercom/ }).first().click();
    await expect(
      page.getByText('Question about my next dose').first(),
    ).toBeVisible({ timeout: 10_000 });

    const marker = `BAD-SIG-${randomBytes(4).toString('hex')}`;
    const rawBody = JSON.stringify({
      topic: 'conversation.user.replied',
      data: {
        item: {
          id: CONVERSATION_ID,
          contact_id: PATIENT_CONTACT_ID,
          body: `Forged inbound. Marker:${marker}`,
          part_type: 'comment',
          created_at: Math.floor(Date.now() / 1000),
          author: { type: 'user', id: 'icuser_sarah', name: 'Sarah Cookland' },
        },
      },
    });
    const res = await request.post(`/api/intercom/${CLINIC}/webhook`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature': 'sha1=deadbeef',
      },
      data: rawBody,
    });
    expect(res.status()).toBe(401);

    // The forged body must never appear — wait a beat to give any rogue
    // SSE broadcast time to land, then assert absence.
    await page.waitForTimeout(1_500);
    await expect(page.getByText(new RegExp(marker))).toHaveCount(0);
  });
});
