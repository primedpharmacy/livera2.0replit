/**
 * Unit tests — resendFailedPatientNotification (Task-224).
 *
 * Task-97 added the per-row "Resend now" button that lets staff trigger an
 * immediate resend of a single Failed notification from the Notification log,
 * bypassing the next_retry_at backoff window used by the scheduled sweep
 * (`retryFailedPatientNotifications`, covered by Task-151). The manual path
 * shares `applyRetryOutcome` with the sweep but has its own refusal matrix:
 *
 *   - not_found    → no notification with that id under this clinic
 *                    (wrong clinic, or an id that simply does not exist)
 *   - bounced      → status='Bounced' (hard bounce — must never be retried)
 *   - not_failed   → status is anything other than 'Failed' / 'Bounced'
 *                    (e.g. Delivered, Queued)
 *   - exhausted    → attempt_count has already reached max_attempts
 *   - no_envelope  → row has no email_envelope snapshot to resend
 *
 * These tests pin the refusal matrix, prove that the three Postmark outcomes
 * (Delivered / Bounced / Failed) update attempt_count / status / last_error /
 * next_retry_at the same way the scheduled job does, and verify that the
 * function bypasses the next_retry_at-in-the-future gate the scheduled
 * sweep enforces (the whole point of the manual button).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../constants', async () => {
  const actual = await vi.importActual<typeof import('../../constants')>('../../constants');
  return { ...actual, NOW: '2026-05-11T08:00:00Z' };
});

vi.mock('@/lib/integrations/postmark', () => ({
  sendPatientEmail: vi.fn(),
}));

import { resendFailedPatientNotification } from '../retryPatientNotifications';
import {
  MOCK_PATIENT_NOTIFICATIONS,
  DEFAULT_MAX_ATTEMPTS,
  type PatientNotification,
} from '../../fixtures/patientNotifications';
import { sendPatientEmail } from '@/lib/integrations/postmark';

const sendMock = vi.mocked(sendPatientEmail);

const NOW_ISO = '2026-05-11T08:00:00Z';
const PAST_ISO = '2026-05-11T07:00:00Z';
const FUTURE_ISO = '2026-05-11T09:00:00Z';

const CLINIC = 'feeltru' as const;
const OTHER_CLINIC = 'vsc' as const;

let originalRows: PatientNotification[];

function snapshot() {
  originalRows = MOCK_PATIENT_NOTIFICATIONS.map((n) => structuredClone(n));
}

function restore() {
  MOCK_PATIENT_NOTIFICATIONS.splice(
    0,
    MOCK_PATIENT_NOTIFICATIONS.length,
    ...originalRows.map((n) => structuredClone(n)),
  );
}

function seed(overrides: Partial<PatientNotification> & { id: string }): PatientNotification {
  const base: PatientNotification = {
    id: overrides.id,
    clinic_id: CLINIC,
    patient_id: 'PT-TEST',
    order_id: 'ORD-TEST',
    type: 'order_approved',
    channel: 'Email',
    template: 'order_approved',
    status: 'Failed',
    sent_at: '2026-05-11T07:00:00Z',
    payload: {},
    attempt_count: 1,
    max_attempts: DEFAULT_MAX_ATTEMPTS,
    last_error: 'Postmark 504: upstream timeout',
    last_attempt_at: '2026-05-11T07:00:00Z',
    next_retry_at: PAST_ISO,
    email_envelope: {
      to_email: 'patient@example.com',
      subject: 'Your order has been approved',
      template: 'order_approved',
      text_body: 'Hi — your order has been approved.',
    },
    email_envelope_unavailable_reason: null,
    sms_error_code: null,
  };
  const row: PatientNotification = { ...base, ...overrides };
  MOCK_PATIENT_NOTIFICATIONS.push(row);
  return row;
}

describe('resendFailedPatientNotification', () => {
  beforeEach(() => {
    snapshot();
    MOCK_PATIENT_NOTIFICATIONS.splice(0, MOCK_PATIENT_NOTIFICATIONS.length);
    sendMock.mockReset();
  });

  afterEach(() => {
    restore();
  });

  // ─── Refusal matrix ───────────────────────────────────────────────────

  describe('refusal matrix', () => {
    it("refuses with reason='not_found' when no row matches the id", async () => {
      seed({ id: 'NOTIF-A' });

      const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-DOES-NOT-EXIST');

      expect(result).toEqual({ ok: false, reason: 'not_found' });
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("refuses with reason='not_found' when the row exists under a different clinic", async () => {
      // Same id exists, but only under OTHER_CLINIC — the per-clinic scope
      // protects against staff at clinic A resending a notification belonging
      // to clinic B.
      seed({ id: 'NOTIF-CROSS', clinic_id: OTHER_CLINIC });

      const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-CROSS');

      expect(result).toEqual({ ok: false, reason: 'not_found' });
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("refuses with reason='bounced' for hard bounces (status='Bounced')", async () => {
      // 'Bounced' is checked BEFORE 'not_failed' so the UI can show a
      // bounce-specific explanation rather than the generic "not in a
      // resendable state" copy.
      const row = seed({
        id: 'NOTIF-BOUNCED',
        status: 'Bounced',
        last_error: 'Hard bounce: mailbox does not exist (550 5.1.1)',
        next_retry_at: null,
      });

      const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-BOUNCED');

      expect(result).toEqual({ ok: false, reason: 'bounced' });
      expect(sendMock).not.toHaveBeenCalled();
      // Row must be untouched.
      expect(row.attempt_count).toBe(1);
      expect(row.status).toBe('Bounced');
    });

    it("refuses with reason='not_failed' when the row is Delivered", async () => {
      const row = seed({
        id: 'NOTIF-OK',
        status: 'Delivered',
        last_error: null,
        next_retry_at: null,
      });

      const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-OK');

      expect(result).toEqual({ ok: false, reason: 'not_failed' });
      expect(sendMock).not.toHaveBeenCalled();
      expect(row.status).toBe('Delivered');
      expect(row.attempt_count).toBe(1);
    });

    it("refuses with reason='not_failed' when the row is Queued", async () => {
      seed({ id: 'NOTIF-QUEUED', status: 'Queued', next_retry_at: null });

      const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-QUEUED');

      expect(result).toEqual({ ok: false, reason: 'not_failed' });
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("refuses with reason='exhausted' when attempt_count has reached max_attempts", async () => {
      const row = seed({
        id: 'NOTIF-EXH',
        attempt_count: DEFAULT_MAX_ATTEMPTS,
        next_retry_at: null,
      });

      const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-EXH');

      expect(result).toEqual({ ok: false, reason: 'exhausted' });
      expect(sendMock).not.toHaveBeenCalled();
      expect(row.attempt_count).toBe(DEFAULT_MAX_ATTEMPTS);
    });

    it("refuses with reason='no_envelope' when the email_envelope snapshot is missing", async () => {
      // Older rows recorded before Task-66 may have no envelope; without one
      // we cannot reconstruct the email body, so resending would be
      // impossible without recoupling to the originating order.
      seed({ id: 'NOTIF-NO-ENV', email_envelope: null });

      const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-NO-ENV');

      expect(result).toEqual({ ok: false, reason: 'no_envelope' });
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  // ─── Send outcomes ────────────────────────────────────────────────────

  describe('send outcomes', () => {
    it('Delivered → attempt_count++, status flips, last_error cleared, next_retry_at cleared', async () => {
      const row = seed({ id: 'NOTIF-DELIVERED', attempt_count: 1 });
      sendMock.mockResolvedValue({ message_id: 'mid-delivered', status: 'Delivered' });

      const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-DELIVERED');

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(row.email_envelope);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(result.notification.id).toBe('NOTIF-DELIVERED');

      expect(row.attempt_count).toBe(2);
      expect(row.status).toBe('Delivered');
      expect(row.last_error).toBeNull();
      expect(row.last_attempt_at).toBe(NOW_ISO);
      expect(row.next_retry_at).toBeNull();
      expect(row.payload.postmark_message_id).toBe('mid-delivered');
    });

    it('Bounced → attempt_count++, status flips, last_error captured, next_retry_at cleared', async () => {
      const row = seed({ id: 'NOTIF-BOUNCED-RETRY', attempt_count: 1 });
      sendMock.mockResolvedValue({
        message_id: null,
        status: 'Bounced',
        error_message: 'Postmark 406: InactiveRecipient',
      });

      const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-BOUNCED-RETRY');

      expect(result.ok).toBe(true);
      expect(row.attempt_count).toBe(2);
      expect(row.status).toBe('Bounced');
      expect(row.last_error).toBe('Postmark 406: InactiveRecipient');
      expect(row.last_attempt_at).toBe(NOW_ISO);
      expect(row.next_retry_at).toBeNull();
    });

    it('Failed with budget remaining → attempt_count++, last_error captured, next_retry_at rescheduled per backoff', async () => {
      // attempt_count starts at 1 → after this attempt it's 2; backoff slot
      // for attempt 2 is RETRY_BACKOFF_MINUTES[1] = 15 minutes from NOW.
      const row = seed({ id: 'NOTIF-FAIL-AGAIN', attempt_count: 1 });
      sendMock.mockResolvedValue({
        message_id: null,
        status: 'Failed',
        error_message: 'Postmark 504: upstream timeout',
      });

      const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-FAIL-AGAIN');

      expect(result.ok).toBe(true);
      expect(row.attempt_count).toBe(2);
      expect(row.status).toBe('Failed');
      expect(row.last_error).toBe('Postmark 504: upstream timeout');
      // 15 minutes after NOW (2026-05-11T08:00:00Z) → 08:15:00.000Z.
      expect(row.next_retry_at).toBe('2026-05-11T08:15:00.000Z');
    });

    it('Failed on the final attempt → row stays Failed, attempt_count reaches max, no further next_retry_at scheduled, exhausted afterwards', async () => {
      // attempt_count starts at max-1 (=2). After this attempt it becomes 3
      // (==max_attempts), so no further next_retry_at is scheduled and a
      // follow-up resend attempt must be refused with 'exhausted'.
      const row = seed({
        id: 'NOTIF-FINAL',
        attempt_count: DEFAULT_MAX_ATTEMPTS - 1,
      });
      sendMock.mockResolvedValue({
        message_id: null,
        status: 'Failed',
        error_message: 'Postmark 504: upstream timeout (final)',
      });

      const first = await resendFailedPatientNotification(CLINIC, 'NOTIF-FINAL');

      expect(first.ok).toBe(true);
      expect(row.status).toBe('Failed');
      expect(row.attempt_count).toBe(DEFAULT_MAX_ATTEMPTS);
      expect(row.last_error).toBe('Postmark 504: upstream timeout (final)');
      expect(row.next_retry_at).toBeNull();

      // A second click on "Resend now" must be refused as exhausted.
      sendMock.mockClear();
      const second = await resendFailedPatientNotification(CLINIC, 'NOTIF-FINAL');
      expect(second).toEqual({ ok: false, reason: 'exhausted' });
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  // ─── Manual override of the backoff window ────────────────────────────

  it('resends even when next_retry_at is in the future (manual bypass of the scheduled backoff)', async () => {
    // The scheduled sweep would skip this row because next_retry_at > NOW.
    // The manual "Resend now" button must NOT honour that gate — that is
    // the whole point of giving staff an immediate-resend control.
    const row = seed({
      id: 'NOTIF-FUTURE',
      attempt_count: 1,
      next_retry_at: FUTURE_ISO,
    });
    sendMock.mockResolvedValue({ message_id: 'mid-now', status: 'Delivered' });

    const result = await resendFailedPatientNotification(CLINIC, 'NOTIF-FUTURE');

    expect(result.ok).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(row.status).toBe('Delivered');
    expect(row.attempt_count).toBe(2);
    expect(row.next_retry_at).toBeNull();
  });
});
