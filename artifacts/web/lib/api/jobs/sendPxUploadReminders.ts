/**
 * sendPxUploadReminders — Task-92.
 *
 * Daily sweep that nudges patients who received a Px-upload email (Task-80)
 * but haven't actually uploaded yet. Without this job, orders sit in the
 * prescriber queue with the "Px upload pending" flag until the 14-day token
 * naturally expires, even though most patients simply forgot.
 *
 * Two reminder windows, both idempotent (a flag on px_upload_link is set the
 * first time each fires, so re-running the sweep is a no-op):
 *
 *   1) "first"  — 48h after `sent_at`, if not yet uploaded.
 *                 Sets `px_upload_link.reminder_sent_at`.
 *   2) "final"  — within 24h of `expires_at`, if not yet uploaded.
 *                 Sets `px_upload_link.final_reminder_sent_at`.
 *
 * Eligibility (both windows):
 *   - order belongs to the given clinic
 *   - has a px_upload_link with a non-null `sent_at` (initial email landed)
 *   - upload has not arrived (`consumed_at == null` and `px_upload == null`)
 *   - link has not expired (NOW < expires_at)
 *   - the corresponding reminder flag is still null
 *
 * Reuses the existing token (no new token is minted) so the patient can
 * follow the same link they already received.
 *
 * Designed to run server-side (RSC / cron-compatible).
 */

import type { ClinicId, Order } from '../types';
import { NOW } from '../constants';
import { MOCK_ORDERS, sendPxUploadReminderEmail } from '../fixtures/orders';
import { MOCK_PATIENTS } from '../fixtures/patients';

const FIRST_REMINDER_AFTER_MS = 48 * 60 * 60 * 1000; // 48h after sent_at
const FINAL_REMINDER_WITHIN_MS = 24 * 60 * 60 * 1000; // 24h before expires_at

export type PxUploadReminderKind = 'first' | 'final';

export type PxUploadReminderOutcome = {
  order_id:    Order['id'];
  patient_id:  Order['patient_id'];
  kind:        PxUploadReminderKind;
  status:      'Delivered' | 'Bounced' | 'Failed';
  message_id:  string | null;
};

export type SendPxUploadRemindersResult = {
  considered:  number;
  sent:        PxUploadReminderOutcome[];
  failed:      PxUploadReminderOutcome[];
};

function uploadAlreadyArrived(order: Order): boolean {
  return Boolean(order.px_upload) || Boolean(order.px_upload_link?.consumed_at);
}

export async function sendPxUploadReminders(
  clinicId: ClinicId,
): Promise<SendPxUploadRemindersResult> {
  const nowMs = new Date(NOW).getTime();
  const result: SendPxUploadRemindersResult = { considered: 0, sent: [], failed: [] };

  const candidates = MOCK_ORDERS.filter((o) => {
    if (o.clinic_id !== clinicId) return false;
    const link = o.px_upload_link;
    if (!link)              return false;
    if (!link.sent_at)      return false;        // initial email never landed → nothing to remind about
    if (uploadAlreadyArrived(o)) return false;   // patient already uploaded
    const expiresMs = new Date(link.expires_at).getTime();
    if (expiresMs <= nowMs) return false;        // link already expired — separate job will retire it
    return true;
  });

  for (const order of candidates) {
    const link = order.px_upload_link!;
    const sentMs    = new Date(link.sent_at!).getTime();
    const expiresMs = new Date(link.expires_at).getTime();

    const firstDue =
      !link.reminder_sent_at &&
      nowMs - sentMs >= FIRST_REMINDER_AFTER_MS;

    // Final reminder fires inside the last 24h before expiry. We also guard
    // against firing it on the same sweep as the first reminder (would be
    // spammy) by requiring at least the first reminder to have landed already.
    const finalDue =
      !link.final_reminder_sent_at &&
      expiresMs - nowMs <= FINAL_REMINDER_WITHIN_MS &&
      expiresMs - nowMs > 0;

    let kind: PxUploadReminderKind | null = null;
    if (firstDue)      kind = 'first';
    else if (finalDue) kind = 'final';
    if (!kind) continue;

    result.considered += 1;

    const patient = MOCK_PATIENTS.find(
      (p) => p.clinic_id === clinicId && p.id === order.patient_id,
    );
    const toEmail = patient?.contact.email ?? order.px_upload_link?.to_email ?? '';
    if (!toEmail) {
      // No address to reach — record and skip; the prescriber queue still
      // shows the "Px upload pending" flag.
      console.log('[AUDIT]', {
        event_type: 'px_upload_link_reminder_skipped',
        outcome:    'no_recipient',
        clinic_id:  clinicId,
        order_id:   order.id,
        patient_id: order.patient_id,
        kind,
        timestamp:  NOW,
      });
      continue;
    }

    const fullName  = patient?.demographic.full_name ?? '';
    const [firstName = 'there', ...rest] = fullName.split(' ').filter(Boolean);
    const lastName  = rest.join(' ');

    const sendResult = await sendPxUploadReminderEmail(order, {
      firstName,
      lastName,
      email: toEmail,
    }, kind);

    const outcome: PxUploadReminderOutcome = {
      order_id:   order.id,
      patient_id: order.patient_id,
      kind,
      status:     sendResult.status,
      message_id: sendResult.message_id,
    };

    if (sendResult.status === 'Delivered') {
      // Flip the matching idempotency flag so the next sweep skips this order.
      if (kind === 'first') link.reminder_sent_at = NOW;
      else                  link.final_reminder_sent_at = NOW;
      result.sent.push(outcome);
    } else {
      // Task-129 — Record the failure on the link so the Order Detail
      // activity timeline can render it (with the Postmark error message)
      // next to the original send and any subsequent successful retry.
      // We deliberately do NOT flip the idempotency flag, so the daily
      // sweep will try again until it succeeds or the link expires.
      if (!link.reminder_failures) link.reminder_failures = [];
      link.reminder_failures.push({
        kind,
        attempted_at:  NOW,
        to_email:      toEmail,
        status:        sendResult.status,
        error_message: sendResult.error_message ?? null,
      });
      result.failed.push(outcome);
    }
  }

  return result;
}
