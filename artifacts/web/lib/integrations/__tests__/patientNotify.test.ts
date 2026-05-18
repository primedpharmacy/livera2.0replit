/**
 * Integration-style tests — notifyPatient() (Task-102)
 *
 * Exercises the SMS-first → email-fallback dispatcher in patientNotify.ts.
 * sendPatientSMS and sendPatientEmail are mocked at the module boundary so no
 * real Twilio / Postmark HTTP calls happen; the underlying fetch is also
 * stubbed as a belt-and-braces guard for CI.
 *
 * Covered scenarios:
 *   - preferred=sms + phone on file + SMS Delivered    → SMS log only
 *   - preferred=sms + phone on file + SMS Failed       → SMS log + email fallback
 *   - preferred=sms + phone on file + SMS Bounced      → SMS log + email fallback
 *   - preferred=sms + no phone on file                 → email fallback (no SMS attempt)
 *   - preferred=sms + no phone + no email              → skipped_reason='no_destination'
 *   - preferred=email                                  → email only
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/integrations/sms', () => ({
  sendPatientSMS: vi.fn(),
}));
vi.mock('@/lib/integrations/postmark', () => ({
  sendPatientEmail: vi.fn(),
}));

import { notifyPatient, type NotifyPatientInput } from '../patientNotify';
import { sendPatientSMS } from '@/lib/integrations/sms';
import { sendPatientEmail } from '@/lib/integrations/postmark';
import { MOCK_PATIENT_NOTIFICATIONS } from '@/lib/api/fixtures/patientNotifications';
import type { ClinicId } from '@/lib/api/types';

const smsMock   = sendPatientSMS   as unknown as ReturnType<typeof vi.fn>;
const emailMock = sendPatientEmail as unknown as ReturnType<typeof vi.fn>;

let notifSnapshotLen = 0;

function baseInput(overrides: Partial<NotifyPatientInput> = {}): NotifyPatientInput {
  return {
    clinic_id:        'C-001' as ClinicId,
    patient_id:       'P-001',
    order_id:         'O-001',
    type:             'RefundIssued',
    template:         'refund_initiated',
    preferred_channel: 'sms',
    to_email:         'patient@example.test',
    to_phone:         '+447700900000',
    email: { subject: 'Your refund', body: 'Hi, your refund is on its way.' },
    sms:   { body: 'Your refund is on its way.' },
    payload: { refund_id: 'R-001' },
    ...overrides,
  };
}

beforeEach(() => {
  smsMock.mockReset();
  emailMock.mockReset();
  // Stub fetch so any accidental real network call would explode loudly.
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('fetch must not be called from notifyPatient tests');
  }));
  notifSnapshotLen = MOCK_PATIENT_NOTIFICATIONS.length;
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Roll back any notification rows appended by this test so the shared
  // fixture array stays clean for other suites.
  MOCK_PATIENT_NOTIFICATIONS.splice(
    notifSnapshotLen,
    MOCK_PATIENT_NOTIFICATIONS.length - notifSnapshotLen,
  );
});

describe('notifyPatient — SMS Delivered', () => {
  it('records a single SMS notification and does not send email', async () => {
    smsMock.mockResolvedValueOnce({ message_id: 'SM-OK', status: 'Delivered' });

    const result = await notifyPatient(baseInput());

    expect(smsMock).toHaveBeenCalledTimes(1);
    expect(emailMock).not.toHaveBeenCalled();
    expect(result.skipped_reason).toBeUndefined();
    expect(result.notifications).toHaveLength(1);

    const [notif] = result.notifications;
    expect(notif.channel).toBe('SMS');
    expect(notif.status).toBe('Delivered');
    expect(notif.payload).toMatchObject({ sms_message_id: 'SM-OK', refund_id: 'R-001' });
    expect(notif.payload).not.toHaveProperty('sms_error_message');
  });

  it('forwards the SMS body and template to sendPatientSMS', async () => {
    smsMock.mockResolvedValueOnce({ message_id: 'SM-OK', status: 'Delivered' });

    await notifyPatient(baseInput());

    expect(smsMock).toHaveBeenCalledWith({
      to_phone:  '+447700900000',
      text_body: 'Your refund is on its way.',
      template:  'refund_initiated',
    });
  });
});

describe('notifyPatient — SMS Failed / Bounced triggers email fallback', () => {
  it('falls back to email when SMS Failed, tags the email row with email_fallback_from=sms', async () => {
    smsMock.mockResolvedValueOnce({
      message_id:    null,
      status:        'Failed',
      error_message: 'Twilio HTTP request failed: ECONNRESET',
    });
    emailMock.mockResolvedValueOnce({ message_id: 'PM-OK', status: 'Delivered' });

    const result = await notifyPatient(baseInput());

    expect(smsMock).toHaveBeenCalledTimes(1);
    expect(emailMock).toHaveBeenCalledTimes(1);
    expect(result.notifications).toHaveLength(2);

    const [sms, email] = result.notifications;
    expect(sms.channel).toBe('SMS');
    expect(sms.status).toBe('Failed');
    expect(sms.payload).toMatchObject({ sms_error_message: expect.stringContaining('ECONNRESET') });

    expect(email.channel).toBe('Email');
    expect(email.status).toBe('Delivered');
    expect(email.payload).toMatchObject({
      postmark_message_id: 'PM-OK',
      email_fallback_from: 'sms',
    });
    expect(email.email_envelope).toEqual({
      to_email:  'patient@example.test',
      subject:   'Your refund',
      text_body: 'Hi, your refund is on its way.',
      html_body: null,
      template:  'refund_initiated',
    });

    expect(emailMock).toHaveBeenCalledWith({
      to_email:  'patient@example.test',
      subject:   'Your refund',
      text_body: 'Hi, your refund is on its way.',
      html_body: null,
      template:  'refund_initiated',
    });
  });

  it('also falls back to email when SMS Bounced (e.g. opted-out 21610)', async () => {
    smsMock.mockResolvedValueOnce({
      message_id:    'SM-bounced',
      status:        'Bounced',
      error_message: 'Twilio error_code 21610: Recipient has opted out',
    });
    emailMock.mockResolvedValueOnce({ message_id: 'PM-OK', status: 'Delivered' });

    const result = await notifyPatient(baseInput());

    expect(result.notifications.map((n) => [n.channel, n.status])).toEqual([
      ['SMS',   'Bounced'],
      ['Email', 'Delivered'],
    ]);
    expect(result.notifications[1].payload).toMatchObject({ email_fallback_from: 'sms' });
  });
});

describe('notifyPatient — SMS preferred but no phone on file', () => {
  it('skips the SMS attempt entirely and emails the patient as a fallback', async () => {
    emailMock.mockResolvedValueOnce({ message_id: 'PM-OK', status: 'Delivered' });

    const result = await notifyPatient(baseInput({ to_phone: null }));

    expect(smsMock).not.toHaveBeenCalled();
    expect(emailMock).toHaveBeenCalledTimes(1);
    expect(result.notifications).toHaveLength(1);

    const [email] = result.notifications;
    expect(email.channel).toBe('Email');
    expect(email.status).toBe('Delivered');
    // The "fallback from sms" tag must still be applied so the notification
    // log makes the choice transparent to clinic staff.
    expect(email.payload).toMatchObject({ email_fallback_from: 'sms' });
  });

  it('returns skipped_reason="no_destination" when SMS is preferred but neither phone nor email is on file', async () => {
    const result = await notifyPatient(baseInput({ to_phone: null, to_email: null }));

    expect(smsMock).not.toHaveBeenCalled();
    expect(emailMock).not.toHaveBeenCalled();
    expect(result.notifications).toEqual([]);
    expect(result.skipped_reason).toBe('no_destination');
  });
});

describe('notifyPatient — email-preferred patients', () => {
  it('skips SMS and emails directly without any fallback marker', async () => {
    emailMock.mockResolvedValueOnce({ message_id: 'PM-OK', status: 'Delivered' });

    const result = await notifyPatient(baseInput({ preferred_channel: 'email' }));

    expect(smsMock).not.toHaveBeenCalled();
    expect(emailMock).toHaveBeenCalledTimes(1);
    expect(result.notifications).toHaveLength(1);

    const [email] = result.notifications;
    expect(email.channel).toBe('Email');
    expect(email.payload).not.toHaveProperty('email_fallback_from');
  });
});
