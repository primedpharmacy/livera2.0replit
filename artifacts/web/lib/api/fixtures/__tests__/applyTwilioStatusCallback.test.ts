/**
 * Unit tests — applyTwilioStatusCallback() (Task-138)
 *
 * Twilio re-delivers status callbacks on any non-2xx and may resend its first
 * POST if the original is dropped, so the handler must be idempotent:
 *   - once the row is in a terminal carrier-final state
 *     (Delivered / Bounced / Failed), further callbacks must NOT mutate it
 *   - a duplicate callback matching the current non-terminal status is a
 *     no-op and must not restamp last_attempt_at
 *   - an unknown MessageSid returns null without throwing
 *   - the first carrier-final callback for a non-terminal row applies as
 *     before (regression guard)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MOCK_PATIENT_NOTIFICATIONS,
  applyTwilioStatusCallback,
  type PatientNotification,
} from '../patientNotifications';

const SMS_SID = 'SM_test_138_idempotent';

let baseline: PatientNotification[];

function snapshot() {
  return MOCK_PATIENT_NOTIFICATIONS.map((n) => ({
    ...n,
    payload: { ...n.payload },
    email_envelope: n.email_envelope ? { ...n.email_envelope } : null,
  }));
}

function seedRow(overrides: Partial<PatientNotification> = {}): PatientNotification {
  const row: PatientNotification = {
    id: 'NOTIF-T138',
    clinic_id: 'feeltru',
    patient_id: 'PT-T138',
    order_id: 'ORD-T138',
    type: 'order_approved',
    channel: 'SMS',
    template: 'order_approved',
    status: 'Queued',
    sent_at: '2026-05-18T10:00:00Z',
    payload: {
      order_id: 'ORD-T138',
      sms_message_id: SMS_SID,
      sms_to_phone: '+447700900999',
    },
    attempt_count: 1,
    max_attempts: 3,
    last_error: null,
    last_attempt_at: '2026-05-18T10:00:00Z',
    next_retry_at: null,
    email_envelope: null,
    email_envelope_unavailable_reason: null,
    sms_error_code: null,
    ...overrides,
  };
  MOCK_PATIENT_NOTIFICATIONS.push(row);
  return row;
}

beforeEach(() => {
  baseline = snapshot();
});

afterEach(() => {
  MOCK_PATIENT_NOTIFICATIONS.length = 0;
  MOCK_PATIENT_NOTIFICATIONS.push(...baseline);
});

describe('applyTwilioStatusCallback — Task-138 idempotency', () => {
  it('returns null for an unknown MessageSid without throwing', () => {
    const result = applyTwilioStatusCallback('SM_does_not_exist', {
      status: 'Delivered',
    });
    expect(result).toBeNull();
  });

  it('applies the first terminal callback to a non-terminal row', () => {
    const row = seedRow({ status: 'Queued' });
    const result = applyTwilioStatusCallback(
      SMS_SID,
      { status: 'Delivered' },
      '2026-05-18T10:05:00Z',
    );
    expect(result).not.toBeNull();
    expect(row.status).toBe('Delivered');
    expect(row.last_attempt_at).toBe('2026-05-18T10:05:00Z');
    expect(row.last_error).toBeNull();
    expect(row.next_retry_at).toBeNull();
  });

  it('leaves a Delivered row unchanged when a duplicate Delivered arrives', () => {
    const row = seedRow({
      status: 'Delivered',
      last_attempt_at: '2026-05-18T10:05:00Z',
      last_error: null,
    });
    const before = { ...row, payload: { ...row.payload } };

    const result = applyTwilioStatusCallback(
      SMS_SID,
      { status: 'Delivered' },
      '2026-05-18T10:30:00Z',
    );

    expect(result).toBe(row);
    expect(row.status).toBe(before.status);
    expect(row.last_attempt_at).toBe(before.last_attempt_at);
    expect(row.last_error).toBe(before.last_error);
    expect(row.payload).toEqual(before.payload);
  });

  it('does not demote a Delivered (terminal) row when a late intermediate-mapped status arrives', () => {
    // Out-of-order: a stale 'sent' callback gets mapped/forwarded later. The
    // route normally filters intermediates, but defence-in-depth: even if one
    // reaches the function it must not overwrite the terminal Delivered.
    const row = seedRow({
      status: 'Delivered',
      last_attempt_at: '2026-05-18T10:05:00Z',
      last_error: null,
    });
    const before = { ...row, payload: { ...row.payload } };

    const result = applyTwilioStatusCallback(
      SMS_SID,
      { status: 'Queued', error_message: 'should be ignored' },
      '2026-05-18T11:00:00Z',
    );

    expect(result).toBe(row);
    expect(row.status).toBe('Delivered');
    expect(row.last_attempt_at).toBe(before.last_attempt_at);
    expect(row.last_error).toBeNull();
    expect(row.payload).toEqual(before.payload);
  });

  it('does not allow a duplicate Failed callback to restamp last_attempt_at on a terminal row', () => {
    const row = seedRow({
      status: 'Failed',
      last_attempt_at: '2026-05-18T10:05:00Z',
      last_error: 'Landline or unreachable carrier (Twilio 30006)',
      payload: {
        order_id: 'ORD-T138',
        sms_message_id: SMS_SID,
        sms_to_phone: '+447700900999',
        sms_error_message: 'Landline or unreachable carrier (Twilio 30006)',
      },
    });
    const beforeAttempt = row.last_attempt_at;
    const beforeError = row.last_error;
    const beforePayload = { ...row.payload };

    const result = applyTwilioStatusCallback(
      SMS_SID,
      {
        status: 'Failed',
        error_message: 'Different newer reason string',
      },
      '2026-05-18T11:30:00Z',
    );

    expect(result).toBe(row);
    expect(row.status).toBe('Failed');
    expect(row.last_attempt_at).toBe(beforeAttempt);
    expect(row.last_error).toBe(beforeError);
    expect(row.payload).toEqual(beforePayload);
  });

  it('does not replace one terminal state with another from a stale retry', () => {
    // Delivered should win over a late-arriving Failed retry from Twilio.
    const row = seedRow({
      status: 'Delivered',
      last_attempt_at: '2026-05-18T10:05:00Z',
      last_error: null,
    });

    const result = applyTwilioStatusCallback(
      SMS_SID,
      { status: 'Failed', error_message: 'Stale failure' },
      '2026-05-18T11:00:00Z',
    );

    expect(result).toBe(row);
    expect(row.status).toBe('Delivered');
    expect(row.last_attempt_at).toBe('2026-05-18T10:05:00Z');
    expect(row.last_error).toBeNull();
  });

  it('no-ops on a duplicate callback for a non-terminal row (no restamp)', () => {
    const row = seedRow({
      status: 'Queued',
      last_attempt_at: '2026-05-18T10:00:00Z',
    });

    const result = applyTwilioStatusCallback(
      SMS_SID,
      { status: 'Queued' },
      '2026-05-18T10:45:00Z',
    );

    expect(result).toBe(row);
    expect(row.status).toBe('Queued');
    expect(row.last_attempt_at).toBe('2026-05-18T10:00:00Z');
  });
});
