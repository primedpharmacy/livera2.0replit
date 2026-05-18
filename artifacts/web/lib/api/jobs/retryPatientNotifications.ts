/**
 * retryFailedPatientNotifications — Task-66.
 *
 * Scans MOCK_PATIENT_NOTIFICATIONS for entries that:
 *   - belong to the given clinic
 *   - are in status='Failed' (transient — NOT 'Bounced', which are hard
 *     suppressions and must never be retried)
 *   - have attempt_count < max_attempts
 *   - have an `email_envelope` snapshot (so we can resend without coupling
 *     back to the originating order / refund)
 *   - have next_retry_at <= NOW
 *
 * For each eligible row it re-invokes sendPatientEmail, increments
 * attempt_count, and flips status accordingly:
 *   - Delivered → success, last_error cleared, no further retries.
 *   - Bounced   → hard bounce on retry; recorded and not retried again.
 *   - Failed    → if attempts exhausted, stays Failed with the final
 *                 last_error; otherwise next_retry_at is rescheduled.
 *
 * Designed to run server-side (RSC / cron-compatible) and to be idempotent
 * within a single run — once attempt_count reaches max_attempts the row is
 * permanently skipped.
 */

import type { ClinicId } from '../types';
import { NOW } from '../constants';
import {
  MOCK_PATIENT_NOTIFICATIONS,
  applyRetryOutcome,
  type PatientNotification,
} from '../fixtures/patientNotifications';
import { sendPatientEmail } from '@/lib/integrations/postmark';

export type RetryPatientNotificationsResult = {
  considered:       number;
  attempted:        number;
  delivered:        PatientNotification[];
  still_failing:    PatientNotification[];
  bounced:          PatientNotification[];
  exhausted:        PatientNotification[]; // last attempt and still Failed
};

/**
 * Task-97 — staff-initiated single-row resend.
 *
 * Resends one Failed notification immediately (bypassing the next_retry_at
 * backoff window) and applies the outcome via the same `applyRetryOutcome`
 * path as the scheduled job, so attempt_count / next_retry_at bookkeeping
 * stays consistent.
 *
 * Refuses to resend rows that are not eligible (wrong clinic, not Failed,
 * already exhausted, missing email_envelope, or Bounced — hard bounces are
 * never retried per retry policy).
 */
export type ResendOutcome =
  | { ok: true;  notification: PatientNotification }
  | { ok: false; reason: 'not_found' | 'not_failed' | 'bounced' | 'exhausted' | 'no_envelope' };

export async function resendFailedPatientNotification(
  clinicId: ClinicId,
  notificationId: string,
): Promise<ResendOutcome> {
  const notif = MOCK_PATIENT_NOTIFICATIONS.find(
    (n) => n.id === notificationId && n.clinic_id === clinicId,
  );
  if (!notif)                                  return { ok: false, reason: 'not_found' };
  if (notif.status === 'Bounced')              return { ok: false, reason: 'bounced' };
  if (notif.status !== 'Failed')               return { ok: false, reason: 'not_failed' };
  if (notif.attempt_count >= notif.max_attempts) return { ok: false, reason: 'exhausted' };
  if (!notif.email_envelope)                   return { ok: false, reason: 'no_envelope' };

  const send = await sendPatientEmail(notif.email_envelope);

  applyRetryOutcome(notif, {
    status:        send.status,
    error_message: send.error_message ?? null,
    message_id:    send.message_id,
  }, NOW);

  console.log('[AUDIT]', {
    event_type:       'patient_notification_manual_resend',
    outcome:          send.status,
    notification_id:  notif.id,
    patient_id:       notif.patient_id,
    order_id:         notif.order_id,
    template:         notif.template,
    attempt_count:    notif.attempt_count,
    max_attempts:     notif.max_attempts,
    message_id:       send.message_id,
    error_message:    send.error_message ?? null,
    next_retry_at:    notif.next_retry_at,
    timestamp:        NOW,
  });

  return { ok: true, notification: notif };
}

export async function retryFailedPatientNotifications(
  clinicId: ClinicId,
): Promise<RetryPatientNotificationsResult> {
  const nowMs = new Date(NOW).getTime();

  const eligible = MOCK_PATIENT_NOTIFICATIONS.filter((n) => {
    if (n.clinic_id !== clinicId)            return false;
    if (n.status !== 'Failed')               return false;          // Bounced never retried
    if (!n.email_envelope)                   return false;          // nothing to resend
    if (n.attempt_count >= n.max_attempts)   return false;          // exhausted
    if (n.next_retry_at == null)             return false;          // not scheduled
    return new Date(n.next_retry_at).getTime() <= nowMs;
  });

  const result: RetryPatientNotificationsResult = {
    considered:    eligible.length,
    attempted:     0,
    delivered:     [],
    still_failing: [],
    bounced:       [],
    exhausted:     [],
  };

  for (const notif of eligible) {
    if (!notif.email_envelope) continue; // narrow for TS
    result.attempted += 1;

    const send = await sendPatientEmail(notif.email_envelope);

    applyRetryOutcome(notif, {
      status:        send.status,
      error_message: send.error_message ?? null,
      message_id:    send.message_id,
    }, NOW);

    console.log('[AUDIT]', {
      event_type:       'patient_notification_retry',
      outcome:          send.status,
      notification_id:  notif.id,
      patient_id:       notif.patient_id,
      order_id:         notif.order_id,
      template:         notif.template,
      attempt_count:    notif.attempt_count,
      max_attempts:     notif.max_attempts,
      message_id:       send.message_id,
      error_message:    send.error_message ?? null,
      next_retry_at:    notif.next_retry_at,
      timestamp:        NOW,
    });

    if (send.status === 'Delivered')      result.delivered.push(notif);
    else if (send.status === 'Bounced')   result.bounced.push(notif);
    else {
      result.still_failing.push(notif);
      if (notif.attempt_count >= notif.max_attempts) result.exhausted.push(notif);
    }
  }

  return result;
}
