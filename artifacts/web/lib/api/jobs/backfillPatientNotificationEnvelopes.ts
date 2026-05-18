/**
 * backfillPatientNotificationEnvelopes — Task-132 (Task-185 extends with HTML).
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
 * Task-185 — additionally fills `email_envelope.html_body` for rows whose
 * envelope was captured before the live HTML snapshot landed (Task-131).
 * The HTML is rendered with the same markup the live notification paths
 * use (amendments.ts / orders.ts) so the "Preview email" modal shows the
 * styled email everywhere, not just on new sends. Templates that have no
 * known HTML renderer (e.g. order_approved, order_dispatched, order_declined
 * — currently only sent as plain text) are left text-only and logged so we
 * never invent markup the patient didn't see.
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

export type HtmlBackfillEntry = {
  notification_id: string;
  template: string;
};

export type BackfillResult = {
  considered:        number;
  backfilled:        BackfillEntry[];
  unrecoverable:     BackfillEntry[];
  html_backfilled:   HtmlBackfillEntry[];
  html_unsupported:  HtmlBackfillEntry[];
  skipped:           number; // rows already snapshotted (incl. HTML), already flagged, or not Email
};

// Templates the backfill knows how to reconstruct a TEXT body for. Anything
// else is flagged `unsupported_template` so we never invent content the
// patient didn't see.
const SUPPORTED_TEMPLATES = new Set<string>([
  'order_approved',
  'order_dispatched',
  'order_declined',
  'order_cancelled_no_charge',
  'order_cancelled_refund',
]);

// Templates that additionally have a known HTML renderer in the live paths
// (orders.ts / amendments.ts). Backfilling HTML for templates outside this
// set would invent markup the patient never saw, so we leave them text-only
// and log via `html_unsupported`.
const HTML_SUPPORTED_TEMPLATES = new Set<string>([
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
    considered:       0,
    backfilled:       [],
    unrecoverable:    [],
    html_backfilled:  [],
    html_unsupported: [],
    skipped:          0,
  };

  for (const notif of rows) {
    // Skip non-Email channels (envelope is an email-only snapshot) and rows
    // already flagged as unrecoverable by a previous run (idempotent).
    if (notif.channel !== 'Email'
        || notif.email_envelope_unavailable_reason != null) {
      result.skipped += 1;
      continue;
    }

    // Branch 1 — envelope missing entirely: reconstruct from order + patient.
    if (notif.email_envelope == null) {
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
          html_included:   reconstructed.envelope.html_body != null,
        });
        if (reconstructed.envelope.html_body != null) {
          result.html_backfilled.push({
            notification_id: notif.id,
            template:        notif.template,
          });
        } else if (HTML_SUPPORTED_TEMPLATES.has(notif.template) === false) {
          result.html_unsupported.push({
            notification_id: notif.id,
            template:        notif.template,
          });
          console.log('[AUDIT]', {
            event_type:      'patient_notification_html_backfill_skipped',
            reason:          'no_html_renderer_for_template',
            notification_id: notif.id,
            template:        notif.template,
          });
        }
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
      continue;
    }

    // Branch 2 — envelope exists but is text-only: backfill html_body when
    // a renderer is known for the template; otherwise leave untouched and log.
    if (notif.email_envelope.html_body == null) {
      if (HTML_SUPPORTED_TEMPLATES.has(notif.template)) {
        const patient = MOCK_PATIENTS.find(
          (p) => p.clinic_id === notif.clinic_id && p.id === notif.patient_id,
        );
        const firstName = patient?.demographic.full_name?.split(' ')[0] ?? 'there';
        const html = buildHtmlForTemplate(notif.template as HtmlSupportedTemplate, {
          firstName,
          orderId: notif.order_id ?? '',
          payload: notif.payload,
        });
        if (html != null) {
          notif.email_envelope.html_body = html;
          result.html_backfilled.push({
            notification_id: notif.id,
            template:        notif.template,
          });
          console.log('[AUDIT]', {
            event_type:      'patient_notification_html_backfilled',
            notification_id: notif.id,
            clinic_id:       notif.clinic_id,
            patient_id:      notif.patient_id,
            order_id:        notif.order_id,
            template:        notif.template,
          });
          continue;
        }
      }
      // Template without a known HTML renderer — leave text-only, log once.
      result.html_unsupported.push({
        notification_id: notif.id,
        template:        notif.template,
      });
      console.log('[AUDIT]', {
        event_type:      'patient_notification_html_backfill_skipped',
        reason:          'no_html_renderer_for_template',
        notification_id: notif.id,
        template:        notif.template,
      });
      continue;
    }

    // Envelope is already fully populated (text + html). Nothing to do.
    result.skipped += 1;
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
  const html = HTML_SUPPORTED_TEMPLATES.has(notif.template)
    ? buildHtmlForTemplate(notif.template as HtmlSupportedTemplate, {
        firstName,
        orderId,
        payload: notif.payload,
      })
    : null;

  return {
    envelope: {
      to_email:  toEmail,
      subject:   built.subject,
      text_body: built.text_body,
      html_body: html,
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

type HtmlSupportedTemplate =
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

// Mirrors the branded HTML wrappers used by the live notification paths
// (amendments.ts processRefundAmendment, orders.ts cancelOrder auth-release
// branch) so the "Preview email" modal renders the same styled email staff
// see on new sends. Kept in lockstep with the source markup: any wording
// change there should be mirrored here so backfilled rows stay faithful.
function buildHtmlForTemplate(
  template: HtmlSupportedTemplate,
  ctx: { firstName: string; orderId: string; payload: Record<string, unknown> },
): string | null {
  const { firstName, orderId, payload } = ctx;
  const shell = (inner: string) =>
    `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0;"><tr><td align="center">` +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">` +
    `<tr><td style="background:#0a7e57;padding:20px 28px;color:#ffffff;font-weight:600;font-size:18px;">Livera</td></tr>` +
    `<tr><td style="padding:28px;font-size:15px;line-height:1.55;">${inner}</td></tr>` +
    `</table></td></tr></table></body></html>`;

  switch (template) {
    case 'order_cancelled_no_charge': {
      const reason = typeof payload.reason === 'string' ? payload.reason : null;
      // Mirrors the conditional copy used in orders.ts cancelOrder: when the
      // live send happened after a releaseAuth failure the payload carries
      // `release_auth_failed`, so we use the corresponding "pre-auth may
      // still be visible" wording instead of promising it was released.
      const releaseAuthFailed =
        payload.release_auth_failed != null && payload.release_auth_failed !== false;
      const authCopy = releaseAuthFailed
        ? `No charge has been taken. If you can still see a pending ` +
          `authorisation on your card, it will drop off automatically within ` +
          `a few working days — we won't capture it.`
        : `No charge has been taken — the pre-authorisation on your card ` +
          `has been released and you'll see it disappear from your ` +
          `statement within a few working days.`;
      return shell(
        `<p style="margin:0 0 14px;">Hi ${firstName},</p>` +
        `<p style="margin:0 0 14px;">We've cancelled order <strong>${orderId}</strong>. ${authCopy}</p>` +
        (reason
          ? `<p style="margin:0 0 14px;"><span style="color:#6b7280;">Reason recorded:</span> ${reason}</p>`
          : '') +
        `<p style="margin:0 0 20px;">If you have any questions, just reply to this email.</p>` +
        `<p style="margin:0;color:#6b7280;">Thanks,<br/>The Livera team</p>`,
      );
    }
    case 'order_cancelled_refund': {
      const amount =
        typeof payload.refunded_amount === 'number'
          ? `£${(payload.refunded_amount as number).toFixed(2)}`
          : null;
      const cardLast4 =
        typeof payload.card_last4 === 'string' ? payload.card_last4 : '••••';
      return shell(
        `<p style="margin:0 0 14px;">Hi ${firstName},</p>` +
        `<p style="margin:0 0 14px;">We've processed a refund` +
        (amount ? ` of <strong>${amount}</strong>` : '') +
        ` for order <strong>${orderId}</strong>. The funds will return to the card ending <strong>${cardLast4}</strong> within 3–5 working days.</p>` +
        `<p style="margin:0 0 20px;">If you have any questions, just reply to this email.</p>` +
        `<p style="margin:0;color:#6b7280;">Thanks,<br/>The Livera team</p>`,
      );
    }
  }
}
