/**
 * End-to-end refund + SMS notification regression test — Task-147.
 *
 * The unit suites under `lib/integrations/__tests__/` cover
 * `sendPatientSMS` and `notifyPatient` in isolation by mocking the
 * sms / postmark modules outright. They do NOT exercise the full chain
 * a regression would have to traverse:
 *
 *   processRefundAmendment()        ← refund flow entry point
 *     → notifyPatient()             ← channel preference + fallback logic
 *       → sendPatientSMS()          ← Twilio HTTP request assembly
 *         → fetch()                 ← real Twilio Messages API call
 *     → recordPatientNotification() ← persistence into MOCK_PATIENT_NOTIFICATIONS
 *   listPatientNotifications()      ← the per-patient log surface
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
 *      surfaces in listPatientNotifications and NO email fallback row is
 *      written.
 *   2. Twilio Messages API returns 500 (transient failure) → an SMS row
 *      with status=Failed AND an Email fallback row tagged
 *      `email_fallback_from=sms` both surface in listPatientNotifications.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MOCK_AMENDMENTS, processRefundAmendment } from '../amendments';
import {
  MOCK_PATIENT_NOTIFICATIONS,
  listPatientNotifications,
} from '../patientNotifications';
import type { Amendment } from '../../types';

// ── Fixtures ────────────────────────────────────────────────────────────────
// Zara Ahmed prefers SMS and lives on FeelTru. Her clinical_check order
// ORD-00449 has amount_authorised=149.00 and amount_charged=null —
// processRefundAmendment falls back to amount_authorised when computing
// the refund cap, so partial refunds up to £149 are valid.
const CLINIC = 'feeltru' as const;
const PATIENT_ID = 'PT-00378';
const ORDER_ID = 'ORD-00449';

let amendmentCounter = 0;
function pushTestRefundAmendment(): string {
  amendmentCounter += 1;
  const id = `AMEND-E2E-${String(amendmentCounter).padStart(3, '0')}`;
  const amendment: Amendment = {
    id,
    clinic_id: CLINIC,
    order_id: ORDER_ID,
    type: 'refund',
    status: 'requested',
    requested_by: { actor_type: 'admin', actor_id: 'user_qadir' },
    requested_at: '2026-05-18T10:00:00Z',
    details: {
      amount_gbp: 50,
      refund_type: 'partial',
      reason: 'partial_use',
      card_last4: '4242',
      origin: 'order_cancellation',
    },
    decided_by: null,
    decided_at: null,
    decision_rationale: null,
  };
  MOCK_AMENDMENTS.push(amendment);
  return id;
}

// Synchronous Twilio response shapes ─────────────────────────────────────────
function twilioAcceptedResponse(): Response {
  return new Response(
    JSON.stringify({
      sid: 'SM_e2e_accepted',
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
let amendSnapshotLen = 0;
const fetchMock = vi.fn();

beforeEach(() => {
  notifSnapshotLen = MOCK_PATIENT_NOTIFICATIONS.length;
  amendSnapshotLen = MOCK_AMENDMENTS.length;

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
  // Roll back any rows / amendments appended by this test so the shared
  // fixture arrays stay clean for other suites.
  MOCK_PATIENT_NOTIFICATIONS.splice(
    notifSnapshotLen,
    MOCK_PATIENT_NOTIFICATIONS.length - notifSnapshotLen,
  );
  MOCK_AMENDMENTS.splice(
    amendSnapshotLen,
    MOCK_AMENDMENTS.length - amendSnapshotLen,
  );
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ── Scenarios ───────────────────────────────────────────────────────────────
describe('Refund flow → patient notification log (Twilio fetch-stubbed)', () => {
  it('records a single SMS row when Twilio accepts the message', async () => {
    fetchMock.mockResolvedValueOnce(twilioAcceptedResponse());

    const amendmentId = pushTestRefundAmendment();

    await processRefundAmendment(CLINIC, amendmentId, {
      decision:    'approve',
      refund_type: 'partial',
      amount_gbp:  50,
      reason:      'partial_use',
    }, { ...(await import('../../constants')).CURRENT_USER, can_refund: true });

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
    expect(body).toContain('refunded+%C2%A350.00'); // "refunded £50.00" URL-encoded

    // The per-patient notification log surfaces the SMS row for this order.
    const rows = await listPatientNotifications(CLINIC, {
      patient_id: PATIENT_ID,
      order_id:   ORDER_ID,
    });
    expect(rows).toHaveLength(1);

    const [smsRow] = rows;
    expect(smsRow.channel).toBe('SMS');
    expect(smsRow.status).toBe('Delivered');
    expect(smsRow.type).toBe('order_cancelled_refund_processed');
    expect(smsRow.payload).toMatchObject({
      order_id:        ORDER_ID,
      amendment_id:    amendmentId,
      refunded_amount: 50,
      card_last4:      '4242',
      sms_message_id:  'SM_e2e_accepted',
    });
    expect(smsRow.payload).not.toHaveProperty('sms_error_message');
  });

  it('writes the SMS Failed row AND the email fallback row when Twilio returns 500', async () => {
    fetchMock.mockResolvedValueOnce(twilioServerErrorResponse());

    const amendmentId = pushTestRefundAmendment();

    await processRefundAmendment(CLINIC, amendmentId, {
      decision:    'approve',
      refund_type: 'partial',
      amount_gbp:  25,
      reason:      'partial_use',
    }, { ...(await import('../../constants')).CURRENT_USER, can_refund: true });

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
    expect(smsRow.type).toBe('order_cancelled_refund_processed');
    expect(smsRow.payload).toMatchObject({
      amendment_id:      amendmentId,
      sms_message_id:    null,
      sms_error_message: expect.stringContaining('Twilio 500'),
    });

    expect(emailRow.channel).toBe('Email');
    expect(emailRow.status).toBe('Delivered'); // Postmark mock always succeeds
    expect(emailRow.type).toBe('order_cancelled_refund_processed');
    expect(emailRow.payload).toMatchObject({
      amendment_id:        amendmentId,
      email_fallback_from: 'sms',
    });

    // The email envelope was snapshotted so the retry job (and the
    // "Preview email" modal) can resend without reconstructing the
    // message from the originating amendment / order.
    expect(emailRow.email_envelope).not.toBeNull();
    expect(emailRow.email_envelope!.subject).toContain(ORDER_ID);
    expect(emailRow.email_envelope!.text_body).toContain('£25.00');
    expect(emailRow.email_envelope!.template).toBe('order_cancelled_refund');
  });
});
