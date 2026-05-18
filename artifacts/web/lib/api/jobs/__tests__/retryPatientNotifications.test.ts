/**
 * Unit tests — retryFailedPatientNotifications (Task-151).
 *
 * Task-66's retry job decides which notifications are eligible for resend,
 * drives the Postmark call, and applies per-attempt status / attempt_count /
 * next_retry_at bookkeeping. Task-106 covered the cron route + scheduler
 * sweep, but the core eligibility filter and outcome bookkeeping had no
 * direct coverage. These tests pin:
 *
 *   1. Eligibility filter
 *      - wrong clinic                          → skipped
 *      - status='Bounced'                      → skipped (hard bounce)
 *      - status='Delivered'                    → skipped (already done)
 *      - missing email_envelope                → skipped (nothing to resend)
 *      - attempt_count >= max_attempts         → skipped (exhausted)
 *      - next_retry_at in the future           → skipped (not due)
 *      - next_retry_at null                    → skipped (not scheduled)
 *   2. Send outcomes (sendPatientEmail stubbed)
 *      - Delivered → attempt_count++, status='Delivered', last_error
 *        cleared, next_retry_at cleared
 *      - Bounced   → attempt_count++, status='Bounced', last_error set,
 *        next_retry_at cleared
 *      - Failed (with budget remaining) → attempt_count++, status='Failed',
 *        last_error set, next_retry_at rescheduled per backoff
 *   3. Exhausted case: final attempt stays 'Failed', attempt_count reaches
 *      max_attempts, no further next_retry_at scheduled, surfaced in
 *      result.exhausted.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../constants', async () => {
  const actual = await vi.importActual<typeof import('../../constants')>('../../constants');
  return { ...actual, NOW: '2026-05-11T08:00:00Z' };
});

vi.mock('@/lib/integrations/postmark', () => ({
  sendPatientEmail: vi.fn(),
}));

import { retryFailedPatientNotifications } from '../retryPatientNotifications';
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
  };
  const row: PatientNotification = { ...base, ...overrides };
  MOCK_PATIENT_NOTIFICATIONS.push(row);
  return row;
}

describe('retryFailedPatientNotifications', () => {
  beforeEach(() => {
    snapshot();
    // Wipe so each test seeds exactly what it needs.
    MOCK_PATIENT_NOTIFICATIONS.splice(0, MOCK_PATIENT_NOTIFICATIONS.length);
    sendMock.mockReset();
  });

  afterEach(() => {
    restore();
  });

  // ─── Eligibility filter ───────────────────────────────────────────────

  describe('eligibility filter', () => {
    it('skips rows that belong to a different clinic', async () => {
      seed({ id: 'NOTIF-OTHER', clinic_id: OTHER_CLINIC });
      sendMock.mockResolvedValue({ message_id: 'mid', status: 'Delivered' });

      const result = await retryFailedPatientNotifications(CLINIC);

      expect(result.considered).toBe(0);
      expect(result.attempted).toBe(0);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("skips rows with status='Bounced' (hard bounces are never retried)", async () => {
      seed({ id: 'NOTIF-BOUNCED', status: 'Bounced' });
      sendMock.mockResolvedValue({ message_id: 'mid', status: 'Delivered' });

      const result = await retryFailedPatientNotifications(CLINIC);

      expect(result.considered).toBe(0);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("skips rows with status='Delivered'", async () => {
      seed({ id: 'NOTIF-OK', status: 'Delivered', last_error: null, next_retry_at: null });
      const result = await retryFailedPatientNotifications(CLINIC);
      expect(result.considered).toBe(0);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('skips rows missing an email_envelope (nothing to resend)', async () => {
      seed({ id: 'NOTIF-NO-ENV', email_envelope: null });
      const result = await retryFailedPatientNotifications(CLINIC);
      expect(result.considered).toBe(0);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('skips rows with attempt_count >= max_attempts (exhausted)', async () => {
      seed({ id: 'NOTIF-EXH', attempt_count: DEFAULT_MAX_ATTEMPTS });
      const result = await retryFailedPatientNotifications(CLINIC);
      expect(result.considered).toBe(0);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('skips rows whose next_retry_at is in the future', async () => {
      seed({ id: 'NOTIF-FUTURE', next_retry_at: FUTURE_ISO });
      const result = await retryFailedPatientNotifications(CLINIC);
      expect(result.considered).toBe(0);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('skips rows whose next_retry_at is null (not scheduled)', async () => {
      seed({ id: 'NOTIF-UNSCHED', next_retry_at: null });
      const result = await retryFailedPatientNotifications(CLINIC);
      expect(result.considered).toBe(0);
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  // ─── Send outcomes ────────────────────────────────────────────────────

  describe('send outcomes', () => {
    it('Delivered → attempt_count++, status flips, last_error cleared, next_retry_at cleared', async () => {
      const row = seed({ id: 'NOTIF-DELIVERED', attempt_count: 1 });
      sendMock.mockResolvedValue({ message_id: 'mid-delivered', status: 'Delivered' });

      const result = await retryFailedPatientNotifications(CLINIC);

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(row.email_envelope);
      expect(result.considered).toBe(1);
      expect(result.attempted).toBe(1);
      expect(result.delivered).toHaveLength(1);
      expect(result.bounced).toHaveLength(0);
      expect(result.still_failing).toHaveLength(0);
      expect(result.exhausted).toHaveLength(0);

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

      const result = await retryFailedPatientNotifications(CLINIC);

      expect(result.bounced).toHaveLength(1);
      expect(result.delivered).toHaveLength(0);
      expect(result.still_failing).toHaveLength(0);

      expect(row.attempt_count).toBe(2);
      expect(row.status).toBe('Bounced');
      expect(row.last_error).toBe('Postmark 406: InactiveRecipient');
      expect(row.next_retry_at).toBeNull();
    });

    it('Failed with budget remaining → attempt_count++, last_error captured, next_retry_at rescheduled per backoff', async () => {
      // attempt_count starts at 1 → after this attempt it's 2; backoff slot
      // for attempt 2 is RETRY_BACKOFF_MINUTES[1] = 15 minutes.
      const row = seed({ id: 'NOTIF-FAIL-AGAIN', attempt_count: 1 });
      sendMock.mockResolvedValue({
        message_id: null,
        status: 'Failed',
        error_message: 'Postmark 504: upstream timeout',
      });

      const result = await retryFailedPatientNotifications(CLINIC);

      expect(result.still_failing).toHaveLength(1);
      expect(result.exhausted).toHaveLength(0);

      expect(row.attempt_count).toBe(2);
      expect(row.status).toBe('Failed');
      expect(row.last_error).toBe('Postmark 504: upstream timeout');
      // 15 minutes after NOW (2026-05-11T08:00:00Z) → 08:15:00.000Z
      expect(row.next_retry_at).toBe('2026-05-11T08:15:00.000Z');
    });
  });

  // ─── Exhausted case ───────────────────────────────────────────────────

  it('exhausted: final attempt stays Failed, attempt_count reaches max, no further next_retry_at', async () => {
    // attempt_count starts at max-1 (=2). After this attempt it becomes 3
    // (==max_attempts), so no further next_retry_at is scheduled and the
    // row is reported in result.exhausted.
    const row = seed({
      id: 'NOTIF-EXHAUSTED',
      attempt_count: DEFAULT_MAX_ATTEMPTS - 1,
    });
    sendMock.mockResolvedValue({
      message_id: null,
      status: 'Failed',
      error_message: 'Postmark 504: upstream timeout (final)',
    });

    const result = await retryFailedPatientNotifications(CLINIC);

    expect(result.attempted).toBe(1);
    expect(result.still_failing).toHaveLength(1);
    expect(result.exhausted).toHaveLength(1);
    expect(result.exhausted[0]!.id).toBe('NOTIF-EXHAUSTED');

    expect(row.status).toBe('Failed');
    expect(row.attempt_count).toBe(DEFAULT_MAX_ATTEMPTS);
    expect(row.last_error).toBe('Postmark 504: upstream timeout (final)');
    expect(row.next_retry_at).toBeNull();

    // Re-running the sweep must skip the now-exhausted row.
    sendMock.mockClear();
    const second = await retryFailedPatientNotifications(CLINIC);
    expect(second.considered).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
