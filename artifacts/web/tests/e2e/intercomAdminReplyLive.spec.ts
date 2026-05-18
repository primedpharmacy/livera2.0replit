/**
 * E2E — Task-197: Intercom admin reply path (OrderIntercomTab → api-server).
 *
 * Mirrors the inbound coverage from task-134's
 * `intercomWebhookLive.spec.ts`, but for the *outbound* path a clinician
 * actually uses:
 *
 *   1. Open Order Detail for ORD-00441 (Sarah Cookland → PT-00198).
 *   2. Switch to the Intercom tab and wait for iconv_001 to expand.
 *   3. Type a reply in the inline compose box and click "Send reply".
 *   4. Assert the optimistic bubble renders immediately with the
 *      signed-in demo clinician's name (Qadir Hussain — the default
 *      persona seeded by middleware.ts).
 *   5. Assert the api-server actually accepted the POST by reading
 *      `/api/intercom/feeltru/audit/outbound` and finding an
 *      `intercom.reply` row whose body byte length matches what we
 *      typed. The audit row is only written *after* the api-server
 *      returns 201, so its presence is a stronger signal than just
 *      checking the network response in isolation.
 *
 * The second test exercises the "Start new conversation" modal flow
 * end-to-end and asserts an `intercom.create` audit row lands with the
 * correct subject + body byte lengths.
 *
 * Pre-conditions: same as intercomWebhookLive.spec.ts — both the web and
 * api-server workflows must be running, and `PLAYWRIGHT_BASE_URL` must
 * point at the workspace router so `/api/intercom/*` is proxied through
 * to the api-server. See that spec's header for details.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { createHmac, randomBytes } from 'node:crypto';

const CLINIC = 'feeltru';
const ORDER_ID = 'ORD-00441';
const PATIENT_ID = 'PT-00198';
// Default demo persona (see DEFAULT_PERSONA_ID in lib/api/constants.ts).
const DEMO_USER_ID = 'user_qadir';
const DEMO_USER_NAME = 'Qadir Hussain';

// Task #217 — the api-server's readClinicianContext now derives the actor
// from the signed `livera_session_uid` cookie instead of trusting browser
// headers. Playwright's standalone `request` fixture doesn't inherit the
// browser context's cookies, so we mint our own session cookie using the
// same SESSION_SECRET the web app + api-server share (dev fallback when
// unset, matching lib/auth/session.ts and lib/session.ts).
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'livera-dev-session-secret-do-not-use-in-prod';

function signSessionCookie(uid: string): string {
  const sig = createHmac('sha256', SESSION_SECRET).update(uid).digest('hex');
  return `livera_session_uid=${encodeURIComponent(`${uid}.${sig}`)}`;
}

const SESSION_COOKIE_HEADER = signSessionCookie(DEMO_USER_ID);

type AuditRow = {
  id: number;
  event: 'intercom.reply' | 'intercom.create';
  clinic_id: string;
  patient_id: string;
  conversation_id: string | null;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  body_byte_length: number;
  subject_length: number | null;
  occurred_at: number;
};

async function fetchOutboundAudit(request: APIRequestContext): Promise<AuditRow[]> {
  const res = await request.get(
    `/api/intercom/${CLINIC}/audit/outbound?limit=50`,
    {
      headers: { cookie: SESSION_COOKIE_HEADER },
    },
  );
  expect(res.status(), `audit fetch should succeed, body: ${await res.text()}`).toBe(200);
  const body = (await res.json()) as { rows: AuditRow[] };
  return body.rows;
}

test.describe('Intercom admin reply → api-server (outbound path)', () => {
  test('typing a reply renders the optimistic bubble and persists an intercom.reply audit row', async ({
    page,
    request,
  }) => {
    // Sanity: api-server is reachable through the workspace proxy and the
    // patient is already linked to the seeded Intercom contact.
    const listed = await request.get(
      `/api/intercom/${CLINIC}/contacts/${PATIENT_ID}/conversations`,
    );
    expect(listed.status()).toBe(200);

    // Baseline: how many intercom.reply rows for *any* conversation
    // already exist. We refine this to a per-conversation count once we
    // know which conversation the UI actually posted to (see below).
    const before = await fetchOutboundAudit(request);

    // 1. Open Order Detail and switch to the Intercom tab. The `?as=`
    //    query triggers the demo-persona middleware so we skip /sign-in
    //    and land authenticated as the default Owner (Qadir Hussain).
    await page.goto(`/${CLINIC}/orders/${ORDER_ID}?as=${DEMO_USER_ID}`);
    await expect(page.locator('h1', { hasText: ORDER_ID })).toBeVisible();
    await page.getByRole('button', { name: /^Intercom/ }).first().click();

    // 2. The seeded conversation must render before we try to reply — the
    //    compose box is only mounted once a conversation is expanded.
    await expect(
      page.getByText('Question about my next dose').first(),
    ).toBeVisible({ timeout: 10_000 });

    // 3. Type a reply with a unique marker so we can tell our bubble apart
    //    from anything else on screen.
    const marker = `ADMIN-REPLY-${randomBytes(4).toString('hex')}`;
    const replyBody = `Confirming your next dose is fine — ${marker}`;
    const composeTextarea = page.getByPlaceholder(/Type a reply to the patient/);
    await expect(composeTextarea).toBeVisible({ timeout: 10_000 });
    await composeTextarea.fill(replyBody);

    // Footer should attribute the outgoing message to the demo persona
    // so the clinician knows which identity is about to write to Intercom.
    await expect(
      page.getByText(new RegExp(`Sends as ${DEMO_USER_NAME}`)),
    ).toBeVisible();

    // Set up the response listener *before* clicking — we want to be
    // racing the network round-trip, not waiting for it serially. The
    // whole point of the optimistic UI is that the bubble renders
    // before the POST resolves, so the visibility assertion below
    // (which we hit before awaiting `replyResponsePromise`) is the
    // strict optimistic-timing check.
    const replyResponsePromise = page.waitForResponse(
      (r) =>
        /\/api\/intercom\/[^/]+\/contacts\/[^/]+\/conversations\/[^/]+\/reply$/.test(
          r.url(),
        ) && r.request().method() === 'POST',
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: /^Send reply$/ }).click();

    // 4. The optimistic bubble appears immediately with our text — we
    //    explicitly do NOT await the POST response yet, so this passes
    //    iff the UI rendered the bubble before the server acknowledged
    //    the reply.
    await expect(page.getByText(new RegExp(marker)).first()).toBeVisible({
      timeout: 10_000,
    });
    // The bubble's author label is the demo clinician's name — this is
    // the contract the api-server's adminAuthor() preserves on the
    // canonical part that replaces the optimistic one, so it should
    // still hold after the swap.
    await expect(
      page
        .locator('div', { has: page.getByText(new RegExp(marker)) })
        .filter({ hasText: DEMO_USER_NAME })
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    // Now drain the response — it tells us which conversation the UI
    // actually posted to (the api-server keeps state across tests
    // within a run, so the "current" thread isn't always iconv_001 —
    // a prior "Start new conversation" run will have created one and
    // shoved it to the top of the list).
    const replyResponse = await replyResponsePromise;
    expect(replyResponse.status()).toBe(201);
    const replyConversationId =
      replyResponse.url().match(/conversations\/([^/]+)\/reply$/)?.[1] ?? '';
    expect(replyConversationId).not.toBe('');

    // The compose box clears once the send completes (handleSendReply
    // resets the per-conversation draft on success). Use this as a
    // proxy for "the POST finished" before we hit the audit endpoint.
    await expect(composeTextarea).toHaveValue('', { timeout: 10_000 });

    // 5. The api-server should have persisted an intercom.reply audit
    //    row matching our message. body_byte_length is the only field
    //    that depends on the actual content (the table never stores the
    //    body itself), so it's the tightest assertion we can make.
    const expectedBytes = Buffer.byteLength(replyBody, 'utf8');
    await expect
      .poll(
        async () => {
          const rows = await fetchOutboundAudit(request);
          return rows.some(
            (r) =>
              r.event === 'intercom.reply' &&
              r.clinic_id === CLINIC &&
              r.patient_id === PATIENT_ID &&
              r.conversation_id === replyConversationId &&
              r.actor_id === DEMO_USER_ID &&
              r.actor_name === DEMO_USER_NAME &&
              r.body_byte_length === expectedBytes,
          );
        },
        {
          message: `expected an intercom.reply audit row with body_byte_length=${expectedBytes}`,
          timeout: 10_000,
        },
      )
      .toBe(true);

    // And the count of reply rows for this conversation grew by exactly
    // one — guards against a regression where the api-server
    // double-writes the audit row. Computed as a before/after delta
    // because the audit store is durable across test runs, so an
    // absolute "== 1" assertion would flake on reruns.
    const beforeReplies = before.filter(
      (r) => r.event === 'intercom.reply' && r.conversation_id === replyConversationId,
    ).length;
    const after = await fetchOutboundAudit(request);
    const afterReplies = after.filter(
      (r) => r.event === 'intercom.reply' && r.conversation_id === replyConversationId,
    ).length;
    expect(afterReplies).toBe(beforeReplies + 1);
  });

  test('Start new conversation modal posts an intercom.create and the optimistic thread shows', async ({
    page,
    request,
  }) => {
    const before = await fetchOutboundAudit(request);
    const beforeCreates = before.filter((r) => r.event === 'intercom.create').length;

    await page.goto(`/${CLINIC}/orders/${ORDER_ID}?as=${DEMO_USER_ID}`);
    await expect(page.locator('h1', { hasText: ORDER_ID })).toBeVisible();
    await page.getByRole('button', { name: /^Intercom/ }).first().click();

    // Wait until the conversation list has loaded — the "Start new
    // conversation" button only renders once the patient is confirmed
    // as linked.
    await expect(
      page.getByText('Question about my next dose').first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Start new conversation/ }).click();

    const marker = `ADMIN-CREATE-${randomBytes(4).toString('hex')}`;
    const subject = `Follow-up ${marker}`;
    const body = `Quick check-in on how you're getting on. Marker:${marker}`;

    await page.getByPlaceholder(/e\.g\. Follow-up on your check-in/).fill(subject);
    await page.getByPlaceholder(/Write your message/).fill(body);

    await page.getByRole('button', { name: /^Send message$/ }).click();

    // The modal closes and the optimistic conversation is inserted at the
    // top of the list with our subject + body marker visible.
    await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(new RegExp(marker)).first()).toBeVisible({
      timeout: 10_000,
    });

    // The audit row must materialize once the POST resolves.
    const expectedBodyBytes = Buffer.byteLength(body, 'utf8');
    await expect
      .poll(
        async () => {
          const rows = await fetchOutboundAudit(request);
          return rows.some(
            (r) =>
              r.event === 'intercom.create' &&
              r.clinic_id === CLINIC &&
              r.patient_id === PATIENT_ID &&
              r.actor_id === DEMO_USER_ID &&
              r.actor_name === DEMO_USER_NAME &&
              r.subject_length === subject.length &&
              r.body_byte_length === expectedBodyBytes,
          );
        },
        {
          message:
            `expected an intercom.create audit row with subject_length=${subject.length}` +
            ` and body_byte_length=${expectedBodyBytes}`,
          timeout: 10_000,
        },
      )
      .toBe(true);

    const after = await fetchOutboundAudit(request);
    const afterCreates = after.filter((r) => r.event === 'intercom.create').length;
    expect(afterCreates).toBe(beforeCreates + 1);
  });
});
