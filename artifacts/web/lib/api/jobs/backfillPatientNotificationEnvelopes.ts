/**
 * backfillPatientNotificationEnvelopes — Task-132.
 *
 * One-shot backfill for the `email_envelope` snapshot on patient notification
 * rows recorded before that field existed (and so silently hide the
 * "Preview email" action in the per-patient notification log).
 *
 * For each eligible row (Email channel, no envelope yet, no
 * unavailable-reason yet) the job reconstructs the envelope from the
 * originating order + patient + template the row was sent under, and writes
 * it back to the row in place. Rows that genuinely cannot be reconstructed
 * (missing patient, missing order, unknown template, no email on file) are
 * flagged via `email_envelope_unavailable_reason` so the UI can explain the
 * missing preview instead of silently hiding it.
 *
 * Designed to be idempotent: re-running the job is a no-op for rows that
 * have either been backfilled or flagged. The shape it writes is identical
 * to what `notifyPatient` produces today, so the retry job
 * (retryFailedPatientNotifications) keeps working unchanged on backfilled
 * rows — it only needs `email_envelope` to be populated.
 *
 * Server-side only; safe to run from a one-off script or admin route.
 */

import type { ClinicId } from '../types';
import {
  MOCK_PATIENT_NOTIFICATIONS,
  type PatientEmailEnvelope,
  type PatientNotification,
  type PatientNotificationType,
} from '../fixtures/patientNotifications';
import { MOCK_PATIENTS } from '../fixtures/patients';
import { MOCK_ORDERS } from '../fixtures/orders';

export type BackfillUnrecoverableReason =
  | 'patient_not_found'
  | 'order_not_found'
  | 'no_email_on_file'
  | 'unsupported_template';

export type BackfillEntry = {
  notification_id: string;
  reason?: BackfillUnrecoverableReason;
};

export type BackfillResult = {
  considered:    number;
  backfilled:    BackfillEntry[];
  unrecoverable: BackfillEntry[];
  skipped:       number; // rows already snapshotted, already flagged, or not Email
};

// Templates the backfill knows how to reconstruct. Anything else is flagged
// `unsupported_template` so we never invent content the patient didn't see.
const SUPPORTED_TEMPLATES = new Set<string>([
  'order_approved',
  'order_dispatched',
  'order_declined',
  'order_cancelled_no_charge',
  'order_cancelled_refund',
]);

export async function backfillPatientNotificationEnvelopes(
  clinicId?: ClinicId,
): Promise<BackfillResult> {
  const rows = clinicId
    ? MOCK_PATIENT_NOTIFICATIONS.filter((n) => n.clinic_id === clinicId)
    : MOCK_PATIENT_NOTIFICATIONS;

  const result: BackfillResult = {
    considered:    0,
    backfilled:    [],
    unrecoverable: [],
    skipped:       0,
  };

  for (const notif of rows) {
    // Skip rows that don't need backfilling: non-Email channels (envelope is
    // an email-only snapshot), rows that already carry a snapshot, and rows
    // already flagged as unrecoverable by a previous run (idempotent).
    if (notif.channel !== 'Email'
        || notif.email_envelope != null
        || notif.email_envelope_unavailable_reason != null) {
      result.skipped += 1;
      continue;
    }

    result.considered += 1;

    const reconstructed = reconstructEnvelope(notif);
    if ('envelope' in reconstructed) {
      notif.email_envelope = reconstructed.envelope;
      result.backfilled.push({ notification_id: notif.id });
      console.log('[AUDIT]', {
        event_type:      'patient_notification_envelope_backfilled',
        notification_id: notif.id,
        clinic_id:       notif.clinic_id,
        patient_id:      notif.patient_id,
        order_id:        notif.order_id,
        template:        notif.template,
      });
    } else {
      notif.email_envelope_unavailable_reason = reconstructed.reason;
      result.unrecoverable.push({ notification_id: notif.id, reason: reconstructed.reason });
      console.log('[AUDIT]', {
        event_type:      'patient_notification_envelope_unrecoverable',
        notification_id: notif.id,
        clinic_id:       notif.clinic_id,
        patient_id:      notif.patient_id,
        order_id:        notif.order_id,
        template:        notif.template,
        reason:          reconstructed.reason,
      });
    }
  }

  return result;
}

type Reconstruction =
  | { envelope: PatientEmailEnvelope }
  | { reason: BackfillUnrecoverableReason };

function reconstructEnvelope(notif: PatientNotification): Reconstruction {
  if (!SUPPORTED_TEMPLATES.has(notif.template)) {
    return { reason: 'unsupported_template' };
  }

  const patient = MOCK_PATIENTS.find(
    (p) => p.clinic_id === notif.clinic_id && p.id === notif.patient_id,
  );
  if (!patient) return { reason: 'patient_not_found' };

  const toEmail = patient.contact.email;
  if (!toEmail) return { reason: 'no_email_on_file' };

  // Every supported template is order-scoped — order_id must resolve.
  const orderId = notif.order_id;
  const order = orderId
    ? MOCK_ORDERS.find((o) => o.clinic_id === notif.clinic_id && o.id === orderId)
    : null;
  if (!orderId || !order) return { reason: 'order_not_found' };

  const firstName = patient.demographic.full_name?.split(' ')[0] ?? 'there';
  const built = buildBodyForTemplate(notif.template as SupportedTemplate, {
    firstName,
    orderId,
    payload: notif.payload,
  });

  return {
    envelope: {
      to_email:  toEmail,
      subject:   built.subject,
      text_body: built.text_body,
      // Older rows never had an HTML snapshot recorded; the preview modal
      // already falls back to the text body when html_body is absent.
      html_body: null,
      template:  notif.template,
    },
  };
}

type SupportedTemplate =
  | 'order_approved'
  | 'order_dispatched'
  | 'order_declined'
  | 'order_cancelled_no_charge'
  | 'order_cancelled_refund';

type BuiltBody = { subject: string; text_body: string };

// Mirrors the wording used by the live notification paths (orders.ts,
// amendments.ts) so a reconstructed envelope is a faithful approximation of
// what the patient would have received. The plain-text body is intentionally
// modest: we only assert what the row's payload still tells us about, and
// fall back to neutral copy when fields are missing.
function buildBodyForTemplate(
  template: SupportedTemplate,
  ctx: { firstName: string; orderId: string; payload: Record<string, unknown> },
): BuiltBody {
  const { firstName, orderId, payload } = ctx;

  switch (template) {
    case 'order_approved': {
      return {
        subject: `Your order ${orderId} has been approved`,
        text_body:
          `Hi ${firstName},\n\n` +
          `Good news — your order ${orderId} has been approved by our clinical team and is being prepared for dispatch.\n\n` +
          `We will email you again as soon as it has been handed to the courier.\n\n` +
          `Thanks,\nThe Livera team`,
      };
    }
    case 'order_dispatched': {
      const tracking =
        typeof payload.tracking_number === 'string' ? payload.tracking_number : null;
      return {
        subject: `Your order ${orderId} is on its way`,
        text_body:
          `Hi ${firstName},\n\n` +
          `Your order ${orderId} has been dispatched` +
          (tracking ? `. Tracking number: ${tracking}.` : '.') +
          `\n\n` +
          `Thanks,\nThe Livera team`,
      };
    }
    case 'order_declined': {
      const reason = typeof payload.reason === 'string' ? payload.reason : null;
      return {
        subject: `An update on your order ${orderId}`,
        text_body:
          `Hi ${firstName},\n\n` +
          `After clinical review we are unable to approve order ${orderId} at this time.` +
          (reason ? `\n\nReason recorded: ${reason}` : '') +
          `\n\nIf you have any questions, just reply to this email and our team will be in touch.\n\n` +
          `Thanks,\nThe Livera team`,
      };
    }
    case 'order_cancelled_no_charge': {
      const reason = typeof payload.reason === 'string' ? payload.reason : null;
      return {
        subject: `Your order ${orderId} has been cancelled`,
        text_body:
          `Hi ${firstName},\n\n` +
          `We've cancelled order ${orderId}. No charge has been taken — any pre-authorisation on your card will drop off your statement within a few working days.` +
          (reason ? `\n\nReason recorded: ${reason}` : '') +
          `\n\nIf you have any questions, just reply to this email.\n\n` +
          `Thanks,\nThe Livera team`,
      };
    }
    case 'order_cancelled_refund': {
      const amount =
        typeof payload.refunded_amount === 'number'
          ? `£${(payload.refunded_amount as number).toFixed(2)}`
          : null;
      const cardLast4 =
        typeof payload.card_last4 === 'string' ? payload.card_last4 : '••••';
      return {
        subject: `Refund processed for order ${orderId}`,
        text_body:
          `Hi ${firstName},\n\n` +
          `We've processed a refund` +
          (amount ? ` of ${amount}` : '') +
          ` for order ${orderId}. The funds will return to the card ending ${cardLast4} within 3–5 working days.\n\n` +
          `If you have any questions, just reply to this email.\n\n` +
          `Thanks,\nThe Livera team`,
      };
    }
  }
}
