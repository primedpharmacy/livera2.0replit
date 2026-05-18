/**
 * End-to-end cancel-order + SMS notification regression test — Task-220.
 *
 * Mirrors `refundSmsE2E.test.ts` for the sibling auth-release branch of
 * `cancelOrder`. The unit suites under `lib/integrations/__tests__/` cover
 * `sendPatientSMS` and `notifyPatient` in isolation by mocking the
 * sms / postmark modules outright. They do NOT exercise the full chain a
 * regression in the cancellation path would have to traverse:
 *
 *   cancelOrder() (amount_charged === null → auth-release branch)
 *     → releaseAuth()                 ← Ryft stub (mock mode)
 *     → notifyPatient()               ← channel preference + fallback logic
 *       → sendPatientSMS()            ← Twilio HTTP request assembly
 *         → fetch()                   ← real Twilio Messages API call
 *     → recordPatientNotification()   ← persistence into MOCK_PATIENT_NOTIFICATIONS
 *   listPatientNotifications()        ← the per-patient log surface
 *
 * This file drives the whole chain end-to-end against an SMS-preferring
 * patient (Zara Ahmed, PT-00378, FeelTru) with Twilio stubbed via
 * fetch-level interception under `LIVERA_SMS_LIVE=true`. Ryft and
 * Postmark stay in their default mock modes so the only outbound HTTP
 * the test has to intercept is Twilio's Messages API.
 *
 * Scenarios covered:
 *   1. Twilio Messages API returns 2xx + status=queued (the synchronous
 *      "accepted by carrier" snapshot) → an SMS row with status=Delivered
 *      and type=order_cancelled_no_charge surfaces in
 *      listPatientNotifications and NO email fallback row is written.
 *   2. Twilio Messages API returns 500 (transient failure) → an SMS row
 *      with status=Failed AND an Email fallback row tagged
 *      `email_fallback_from=sms` both surface in listPatientNotifications.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MOCK_ORDERS, cancelOrder } from '../orders';
import {
  MOCK_PATIENT_NOTIFICATIONS,
  listPatientNotifications,
} from '../patientNotifications';
import type { Order } from '../../types';

// ── Fixtures ────────────────────────────────────────────────────────────────
// Zara Ahmed prefers SMS and lives on FeelTru. Her order ORD-00449 has
// amount_charged=null (auth held but not captured), so cancelOrder takes
// the auth-release branch which is what this test exercises. The order's
// seed status is `clinical_check`; we flip it to `approved` so it passes
// cancelOrder's status guard, then restore the original snapshot in
// afterEach.
const CLINIC = 'feeltru' as const;
const PATIENT_ID = 'PT-00378';
const ORDER_ID = 'ORD-00449';

function findOrder(): Order {
  const order = MOCK_ORDERS.find(
    (o) => o.clinic_id === CLINIC && o.id === ORDER_ID,
  );
  if (!order) throw new Error(`Fixture order ${ORDER_ID} missing`);
  return order;
}

// Synchronous Twilio response shapes ─────────────────────────────────────────
function twilioAcceptedResponse(): Response {
  return new Response(
    JSON.stringify({
      sid: 'SM_e2e_cancel_accepted',
      status: 'queued',
      error_code: null,
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } },
  );
}

function twilioServerErrorResponse(): Response {
  return new Response(
    JSON.stringify({
      code: 20500,
      message: 'Internal Server Error',
    }),
    { status: 500, headers: { 'Content-Type': 'application/json' } },
  );
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
let notifSnapshotLen = 0;
let orderSnapshot: Order | null = null;
const fetchMock = vi.fn();

beforeEach(() => {
  notifSnapshotLen = MOCK_PATIENT_NOTIFICATIONS.length;

  const order = findOrder();
  orderSnapshot = { ...order };
  // Flip the order into a state cancelOrder accepts (status ∈
  // {approved, in_dispensing} and no dispatched_at). amount_charged is
  // already null in the seed so the auth-release branch is taken.
  order.status = 'approved';
  order.dispatched_at = null;
  order.cancelled_at = null;
  order.cancellation_reason = null;
  order.refund_amendment_id = null;

  // Flip the SMS integration into live mode so sendPatientSMS reaches its
  // Twilio HTTP path. Ryft / Postmark remain in mock mode because the
  // corresponding LIVERA_*_LIVE flags stay unset, so the only outbound HTTP
  // the test stub has to satisfy is Twilio's Messages API.
  vi.stubEnv('LIVERA_SMS_LIVE',     'true');
  vi.stubEnv('TWILIO_ACCOUNT_SID',  'AC_e2e_test_sid');
  vi.stubEnv('TWILIO_AUTH_TOKEN',   'token_e2e_test');
  vi.stubEnv('TWILIO_FROM_NUMBER',  '+15555550100');

  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  // Roll back notification rows appended by this test so the shared
  // fixture array stays clean for other suites.
  MOCK_PATIENT_NOTIFICATIONS.splice(
    notifSnapshotLen,
    MOCK_PATIENT_NOTIFICATIONS.length - notifSnapshotLen,
  );
  // Restore the order in-place so other suites see the original seed.
  if (orderSnapshot) {
    const order = findOrder();
    Object.assign(order, orderSnapshot);
    orderSnapshot = null;
  }
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ── Scenarios ───────────────────────────────────────────────────────────────
describe('Cancel-order (auth-release) flow → patient notification log (Twilio fetch-stubbed)', () => {
  it('records a single SMS row when Twilio accepts the message', async () => {
    fetchMock.mockResolvedValueOnce(twilioAcceptedResponse());

    const reason = 'Patient changed mind before dispatch — confirmed by phone.';
    const result = await cancelOrder(CLINIC, ORDER_ID, reason);

    // Auth-release branch: no refund amendment, order flipped to cancelled.
    expect(result.refund_amendment).toBeNull();
    expect(result.order.status).toBe('cancelled');
    expect(result.release_auth_failed).toBeUndefined();

    // Twilio Messages API was called exactly once with the expected
    // recipient, body, and Basic auth header.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toMatch(
      /^https:\/\/api\.twilio\.com\/2010-04-01\/Accounts\/AC_e2e_test_sid\/Messages\.json$/,
    );
    expect(calledInit.method).toBe('POST');
    expect(
      (calledInit.headers as Record<string, string>).Authorization,
    ).toMatch(/^Basic /);
    const body = String(calledInit.body);
    expect(body).toContain('To=%2B44+7700+900987'); // Zara's E.164-ish phone
    expect(body).toContain('From=%2B15555550100');
    // "Livera: order ORD-00449 cancelled" URL-encoded
    expect(body).toContain('Livera%3A+order+ORD-00449+cancelled');
    expect(body).toContain('pre-auth+has+been+released');

    // The per-patient notification log surfaces the SMS row for this order.
    const rows = await listPatientNotifications(CLINIC, {
      patient_id: PATIENT_ID,
      order_id:   ORDER_ID,
    });
    expect(rows).toHaveLength(1);

    const [smsRow] = rows;
    expect(smsRow.channel).toBe('SMS');
    expect(smsRow.status).toBe('Delivered');
    expect(smsRow.type).toBe('order_cancelled_no_charge');
    expect(smsRow.payload).toMatchObject({
      order_id:            ORDER_ID,
      reason:              reason,
      ryft_auth_id:        'ryft_auth_za1',
      release_auth_failed: null,
      sms_message_id:      'SM_e2e_cancel_accepted',
    });
    expect(smsRow.payload).not.toHaveProperty('sms_error_message');
  });

  it('writes the SMS Failed row AND the email fallback row when Twilio returns 500', async () => {
    fetchMock.mockResolvedValueOnce(twilioServerErrorResponse());

    const reason = 'Pharmacy stock issue — re-ordering on a different pen size.';
    const result = await cancelOrder(CLINIC, ORDER_ID, reason);

    expect(result.refund_amendment).toBeNull();
    expect(result.order.status).toBe('cancelled');

    // Twilio was hit exactly once; Postmark stays in mock mode so no
    // additional outbound HTTP is fired for the email fallback.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const rows = await listPatientNotifications(CLINIC, {
      patient_id: PATIENT_ID,
      order_id:   ORDER_ID,
    });
    expect(rows).toHaveLength(2);

    const [smsRow, emailRow] = rows;

    expect(smsRow.channel).toBe('SMS');
    expect(smsRow.status).toBe('Failed');
    expect(smsRow.type).toBe('order_cancelled_no_charge');
    expect(smsRow.payload).toMatchObject({
      order_id:          ORDER_ID,
      sms_message_id:    null,
      sms_error_message: expect.stringContaining('Twilio 500'),
    });

    expect(emailRow.channel).toBe('Email');
    expect(emailRow.status).toBe('Delivered'); // Postmark mock always succeeds
    expect(emailRow.type).toBe('order_cancelled_no_charge');
    expect(emailRow.payload).toMatchObject({
      order_id:            ORDER_ID,
      email_fallback_from: 'sms',
    });

    // The email envelope was snapshotted so the retry job (and the
    // "Preview email" modal) can resend without reconstructing the
    // message from the originating order.
    expect(emailRow.email_envelope).not.toBeNull();
    expect(emailRow.email_envelope!.subject).toContain(ORDER_ID);
    expect(emailRow.email_envelope!.template).toBe('order_cancelled_no_charge');
    expect(emailRow.email_envelope!.text_body).toContain(ORDER_ID);
  });
});
