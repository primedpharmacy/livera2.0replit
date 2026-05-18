/**
 * Per-patient notification log fixture (BLD-FCM-LOG-01 surface).
 *
 * Task-38 — adds an `order_cancelled_refund_processed` fixture so the
 * notification log shows that the patient was emailed when a refund was
 * processed against a cancelled order. Live Postmark send is post-launch;
 * for now this fixture is the source of truth visible in the per-patient
 * notification log UI.
 *
 * Task-66 — adds retry bookkeeping fields (`attempt_count`, `max_attempts`,
 * `last_error`, `last_attempt_at`, `next_retry_at`) plus an `email_envelope`
 * snapshot so the `retryFailedPatientNotifications` job can resend a Failed
 * notification without having to reconstruct the original email content from
 * the originating order / refund. Hard bounces (status='Bounced') are NOT
 * retried — only transient 'Failed' rows.
 *
 * The shape mirrors the columns used by the BLD-FCM-LOG-01 prototype
 * (channel, template, status, payload) and extends them with the retry
 * metadata above.
 */

import type { ClinicId } from '../types';
import { scopedToClinic, delay, NOW } from '../constants';

export type PatientNotificationChannel = 'Email' | 'SMS' | 'Push' | 'InApp';
export type PatientNotificationStatus = 'Delivered' | 'Queued' | 'Failed' | 'Bounced';

export type PatientNotificationType =
  | 'order_cancelled_refund_processed'
  | 'order_cancelled_no_charge'
  | 'order_approved'
  | 'order_dispatched'
  | 'order_declined';

// Task-66 — snapshot of the email content captured at first-send time so the
// retry job can resend without coupling back to the originating order/refund.
export type PatientEmailEnvelope = {
  to_email: string;
  subject: string;
  text_body: string;
  // Task-131 — optional HTML snapshot captured at first-send time so the
  // "Preview email" modal can render the styled email the patient actually
  // received (branding, buttons, formatting) rather than only the plain-text
  // fallback. Older rows without an HTML snapshot fall back to `text_body`.
  html_body?: string | null;
  template: string;
};

export type PatientNotification = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string;
  order_id: string | null;
  type: PatientNotificationType;
  channel: PatientNotificationChannel;
  template: string;
  status: PatientNotificationStatus;
  sent_at: string;
  payload: Record<string, unknown>;
  // ── Task-66 retry bookkeeping ──────────────────────────────────────────
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  email_envelope: PatientEmailEnvelope | null;
};

// Task-66 — default retry policy. 3 attempts total (initial + 2 retries) so the
// backoff schedule only needs two slots: 5 min after attempt 1, 15 min after
// attempt 2. After attempt 3 the row is exhausted and no further retry is
// scheduled.
export const DEFAULT_MAX_ATTEMPTS = 3;
export const RETRY_BACKOFF_MINUTES = [5, 15] as const;

export function nextRetryAtFor(attemptCount: number, fromIso: string = NOW): string | null {
  // attemptCount is the count *after* the just-completed attempt. The next
  // retry waits RETRY_BACKOFF_MINUTES[attemptCount-1] from fromIso. Returns
  // null when no further retries are scheduled.
  if (attemptCount < 1 || attemptCount >= DEFAULT_MAX_ATTEMPTS) return null;
  const minutes = RETRY_BACKOFF_MINUTES[attemptCount - 1];
  if (minutes == null) return null;
  return new Date(new Date(fromIso).getTime() + minutes * 60 * 1000).toISOString();
}

export const MOCK_PATIENT_NOTIFICATIONS: PatientNotification[] = [
  {
    id: 'NOTIF-001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    order_id: 'ORD-00450',
    type: 'order_cancelled_refund_processed',
    channel: 'Email',
    template: 'order_cancelled_refund',
    status: 'Delivered',
    sent_at: '2026-05-10T14:32:00Z',
    payload: {
      order_id: 'ORD-00450',
      refunded_amount: 179.00,
      card_last4: '4242',
      reason: 'Order cancellation — relocating overseas',
    },
    attempt_count:   1,
    max_attempts:    DEFAULT_MAX_ATTEMPTS,
    last_error:      null,
    last_attempt_at: '2026-05-10T14:32:00Z',
    next_retry_at:   null,
    // Task-98 — snapshot of the email the patient received, surfaced by the
    // "Preview email" action in the per-patient notification log.
    email_envelope:  {
      to_email: 'patient+pt00198@example.com',
      subject:  'Your refund for order ORD-00450 has been processed',
      template: 'order_cancelled_refund',
      text_body:
        'Hi Alex,\n\n' +
        'We have processed a refund of £179.00 to the card ending 4242 for your cancelled order ORD-00450.\n\n' +
        'Reason: Order cancellation — relocating overseas.\n\n' +
        'Refunds typically appear on your statement within 5–10 working days, depending on your bank.\n\n' +
        'If you have any questions, just reply to this email and our team will be in touch.\n\n' +
        'Thanks,\n' +
        'The FeelTru team',
      html_body:
        '<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;color:#1f2937;">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0;">' +
        '<tr><td align="center">' +
        '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">' +
        '<tr><td style="background:#0a7e57;padding:20px 28px;color:#ffffff;font-weight:600;font-size:18px;">FeelTru</td></tr>' +
        '<tr><td style="padding:28px;font-size:15px;line-height:1.55;">' +
        '<p style="margin:0 0 14px;">Hi Alex,</p>' +
        '<p style="margin:0 0 14px;">We have processed a refund of <strong>£179.00</strong> to the card ending <strong>4242</strong> for your cancelled order <strong>ORD-00450</strong>.</p>' +
        '<p style="margin:0 0 14px;"><span style="color:#6b7280;">Reason:</span> Order cancellation — relocating overseas.</p>' +
        '<p style="margin:0 0 20px;">Refunds typically appear on your statement within 5–10 working days, depending on your bank.</p>' +
        '<p style="margin:0 0 20px;"><a href="mailto:hello@feeltru.example" style="display:inline-block;background:#0a7e57;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Contact our team</a></p>' +
        '<p style="margin:0;color:#6b7280;">Thanks,<br/>The FeelTru team</p>' +
        '</td></tr>' +
        '</table>' +
        '</td></tr></table></body></html>',
    },
  },
  // Task-128 — Failed row with retry budget remaining so reviewers can see and
  // click the "Resend now" button in the per-patient Notification log tab.
  // The retry job runs against this exact shape: status='Failed',
  // attempt_count < max_attempts, and a populated email_envelope so the
  // resend has everything it needs without reconstructing from the order.
  {
    id: 'NOTIF-002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    order_id: 'ORD-00451',
    type: 'order_approved',
    channel: 'Email',
    template: 'order_approved',
    status: 'Failed',
    sent_at: '2026-05-18T09:12:00Z',
    payload: {
      order_id: 'ORD-00451',
    },
    attempt_count:   1,
    max_attempts:    DEFAULT_MAX_ATTEMPTS,
    last_error:      'Postmark 504: upstream timeout while accepting message',
    last_attempt_at: '2026-05-18T09:12:00Z',
    next_retry_at:   '2026-05-18T09:17:00Z',
    email_envelope:  {
      to_email: 'patient+pt00198@example.com',
      subject:  'Your order ORD-00451 has been approved',
      template: 'order_approved',
      text_body:
        'Hi Alex,\n\n' +
        'Good news — your order ORD-00451 has been approved by our clinical team and is being prepared for dispatch.\n\n' +
        'We will email you again as soon as it has been handed to the courier.\n\n' +
        'Thanks,\n' +
        'The FeelTru team',
    },
  },
  // Task-128 — Bounced row to prove that the "Resend now" button does NOT
  // appear for hard bounces (the address is invalid, so retrying would be
  // pointless and could harm sender reputation).
  {
    id: 'NOTIF-003',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    order_id: 'ORD-00452',
    type: 'order_dispatched',
    channel: 'Email',
    template: 'order_dispatched',
    status: 'Bounced',
    sent_at: '2026-05-17T16:04:00Z',
    payload: {
      order_id: 'ORD-00452',
      tracking_number: 'AB123456789GB',
    },
    attempt_count:   1,
    max_attempts:    DEFAULT_MAX_ATTEMPTS,
    last_error:      'Hard bounce: mailbox does not exist (550 5.1.1)',
    last_attempt_at: '2026-05-17T16:04:00Z',
    next_retry_at:   null,
    email_envelope:  {
      to_email: 'patient+pt00198@example.com',
      subject:  'Your order ORD-00452 is on its way',
      template: 'order_dispatched',
      text_body:
        'Hi Alex,\n\n' +
        'Your order ORD-00452 has been dispatched. Tracking number: AB123456789GB.\n\n' +
        'Thanks,\n' +
        'The FeelTru team',
    },
  },
  // Task-137 — SMS row marked Bounced by the Twilio async status callback.
  // `payload.sms_error_message` and `last_error` carry the carrier reason so
  // the per-patient notification log can show clinicians WHY the SMS failed
  // (e.g. "Unreachable destination handset") instead of a bare 'Bounced' chip.
  // No email_envelope — SMS rows are not retried; the carrier-final status
  // is terminal and the staff action is to switch channel or fix the number.
  {
    id: 'NOTIF-004',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    order_id: 'ORD-00453',
    type: 'order_approved',
    channel: 'SMS',
    template: 'order_approved',
    status: 'Bounced',
    sent_at: '2026-05-18T08:01:00Z',
    payload: {
      order_id: 'ORD-00453',
      sms_message_id: 'SM7c5d2e8a1b9f4e6a8d2c1f3e9b7a6d2c',
      sms_to_phone: '+447700900123',
      sms_error_message: 'Unreachable destination handset (Twilio 30003)',
    },
    attempt_count:   1,
    max_attempts:    DEFAULT_MAX_ATTEMPTS,
    last_error:      'Unreachable destination handset (Twilio 30003)',
    last_attempt_at: '2026-05-18T08:01:00Z',
    next_retry_at:   null,
    email_envelope:  null,
  },
  // Task-137 — SMS marked Failed by the carrier (landline / unroutable). Same
  // shape as above; UI must surface the carrier reason so clinicians know to
  // collect a mobile number rather than retry the same one.
  {
    id: 'NOTIF-005',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    order_id: 'ORD-00454',
    type: 'order_dispatched',
    channel: 'SMS',
    template: 'order_dispatched',
    status: 'Failed',
    sent_at: '2026-05-18T07:42:00Z',
    payload: {
      order_id: 'ORD-00454',
      sms_message_id: 'SM3a1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d',
      sms_to_phone: '+441234567890',
      sms_error_message: 'Landline or unreachable carrier (Twilio 30006)',
    },
    attempt_count:   1,
    max_attempts:    DEFAULT_MAX_ATTEMPTS,
    last_error:      'Landline or unreachable carrier (Twilio 30006)',
    last_attempt_at: '2026-05-18T07:42:00Z',
    next_retry_at:   null,
    email_envelope:  null,
  },
];

// Task-49 — append a notification record after a real Postmark send. Returns
// the appended record so callers can audit / surface its ID.
//
// Task-66 — accepts `email_envelope` (snapshot used by the retry job) and
// `error_message` (becomes `last_error` when status is 'Failed' / 'Bounced').
// When status='Failed' a `next_retry_at` is scheduled using the default
// backoff; 'Delivered' and 'Bounced' never schedule retries.
export function recordPatientNotification(input: {
  clinic_id: ClinicId;
  patient_id: string;
  order_id: string | null;
  type: PatientNotificationType;
  template: string;
  status: PatientNotificationStatus;
  payload: Record<string, unknown>;
  channel?: PatientNotificationChannel;
  sent_at?: string;
  email_envelope?: PatientEmailEnvelope | null;
  error_message?: string | null;
}): PatientNotification {
  const next = String(MOCK_PATIENT_NOTIFICATIONS.length + 1).padStart(3, '0');
  const sentAt = input.sent_at ?? NOW;
  const attemptCount = 1;
  const record: PatientNotification = {
    id: `NOTIF-${next}`,
    clinic_id:  input.clinic_id,
    patient_id: input.patient_id,
    order_id:   input.order_id,
    type:       input.type,
    channel:    input.channel ?? 'Email',
    template:   input.template,
    status:     input.status,
    sent_at:    sentAt,
    payload:    input.payload,
    attempt_count:   attemptCount,
    max_attempts:    DEFAULT_MAX_ATTEMPTS,
    last_error:      input.status === 'Delivered' ? null : (input.error_message ?? null),
    last_attempt_at: sentAt,
    next_retry_at:   input.status === 'Failed' ? nextRetryAtFor(attemptCount, sentAt) : null,
    email_envelope:  input.email_envelope ?? null,
  };
  MOCK_PATIENT_NOTIFICATIONS.push(record);
  return record;
}

// Task-66 — mutate a notification after a retry attempt. Centralised so the
// retry job and tests stay in sync with the retry policy.
export function applyRetryOutcome(
  notif: PatientNotification,
  outcome: { status: PatientNotificationStatus; error_message?: string | null; message_id?: string | null },
  attemptedAt: string = NOW,
): PatientNotification {
  notif.attempt_count   = notif.attempt_count + 1;
  notif.status          = outcome.status;
  notif.last_attempt_at = attemptedAt;
  notif.last_error      = outcome.status === 'Delivered' ? null : (outcome.error_message ?? notif.last_error);
  // Only schedule another retry while transient-failing and below max_attempts.
  notif.next_retry_at =
    outcome.status === 'Failed' && notif.attempt_count < notif.max_attempts
      ? nextRetryAtFor(notif.attempt_count, attemptedAt)
      : null;
  if (outcome.message_id) {
    notif.payload = { ...notif.payload, postmark_message_id: outcome.message_id };
  }
  return notif;
}

// Task-101 — apply an asynchronous Twilio status callback to the matching SMS
// notification row. We look the row up by `payload.sms_message_id` (Twilio
// MessageSid stored when the synchronous send returned). Returns the mutated
// notification, or null when no matching row exists (e.g. callback arrives
// for an SMS sent outside Livera, or against a wiped dev fixture set).
//
// Carrier-final statuses are terminal: no retry is ever scheduled from a
// status callback — the SMS already left our system. Bounced/Failed rows
// produced this way will not be picked up by retryFailedPatientNotifications
// because `next_retry_at` stays null.
export function applyTwilioStatusCallback(
  smsMessageId: string,
  outcome: { status: PatientNotificationStatus; error_message?: string | null },
  occurredAt: string = NOW,
): PatientNotification | null {
  const notif = MOCK_PATIENT_NOTIFICATIONS.find(
    (n) =>
      n.channel === 'SMS' &&
      (n.payload as { sms_message_id?: unknown }).sms_message_id === smsMessageId,
  );
  if (!notif) return null;

  notif.status          = outcome.status;
  notif.last_attempt_at = occurredAt;
  notif.last_error      =
    outcome.status === 'Delivered' ? null : (outcome.error_message ?? notif.last_error);
  notif.next_retry_at   = null;
  if (outcome.error_message) {
    notif.payload = { ...notif.payload, sms_error_message: outcome.error_message };
  }
  return notif;
}

export async function listPatientNotifications(
  clinic_id: ClinicId,
  opts?: { patient_id?: string; order_id?: string },
): Promise<PatientNotification[]> {
  await delay();
  let results = scopedToClinic(MOCK_PATIENT_NOTIFICATIONS, clinic_id);
  if (opts?.patient_id) results = results.filter((n) => n.patient_id === opts.patient_id);
  if (opts?.order_id) results = results.filter((n) => n.order_id === opts.order_id);
  return results;
}
