/**
 * Livera patient notification dispatcher — Task-65.
 *
 * Honours patient.contact.preferred_channel ('email' | 'sms' | 'phone') when
 * sending refund + cancellation notifications.
 *
 *   preferred = 'sms'                 → SMS first, fall back to email on
 *                                       Failed/Bounced or when no phone is
 *                                       on file.
 *   preferred = 'email' | 'phone'     → email (we don't make outbound calls).
 *
 * Each successful or final-failed attempt is written to
 * MOCK_PATIENT_NOTIFICATIONS with the right channel via
 * recordPatientNotification, so the per-patient notification log surfaces
 * exactly what was attempted (BLD-FCM-LOG-01 surface).
 *
 * Server-side only.
 */

import type { ClinicId } from '@/lib/api/types';
import { sendPatientEmail } from '@/lib/integrations/postmark';
import { sendPatientSMS } from '@/lib/integrations/sms';
import {
  recordPatientNotification,
  type PatientNotification,
  type PatientNotificationType,
} from '@/lib/api/fixtures/patientNotifications';

export type PreferredChannel = 'email' | 'sms' | 'phone';

export type NotifyPatientInput = {
  clinic_id: ClinicId;
  patient_id: string;
  order_id: string | null;
  type: PatientNotificationType;
  template: string;
  preferred_channel: PreferredChannel;
  to_email: string | null;
  to_phone: string | null;
  email: { subject: string; body: string };
  sms: { body: string };
  payload: Record<string, unknown>;
};

export type NotifyPatientResult = {
  notifications: PatientNotification[];
  skipped_reason?: 'no_destination';
};

export async function notifyPatient(
  input: NotifyPatientInput,
): Promise<NotifyPatientResult> {
  const notifications: PatientNotification[] = [];

  const wantsSms = input.preferred_channel === 'sms';
  const smsPossible = wantsSms && !!input.to_phone;
  const emailPossible = !!input.to_email;

  if (!smsPossible && !emailPossible) {
    return { notifications, skipped_reason: 'no_destination' };
  }

  let needsEmailFallback = false;

  if (smsPossible) {
    const smsResult = await sendPatientSMS({
      to_phone:  input.to_phone!,
      text_body: input.sms.body,
      template:  input.template,
    });

    notifications.push(
      recordPatientNotification({
        clinic_id:  input.clinic_id,
        patient_id: input.patient_id,
        order_id:   input.order_id,
        type:       input.type,
        template:   input.template,
        status:     smsResult.status,
        channel:    'SMS',
        payload: {
          ...input.payload,
          sms_message_id: smsResult.message_id,
          ...(smsResult.error_message ? { sms_error_message: smsResult.error_message } : {}),
        },
      }),
    );

    if (smsResult.status !== 'Delivered') needsEmailFallback = true;
  } else if (wantsSms) {
    // SMS was preferred but impossible (no phone on file). Fall back to email.
    needsEmailFallback = true;
  }

  // Send email when the patient prefers email/phone, OR when SMS failed/was
  // impossible and we have an email on file to fall back to.
  const shouldEmail =
    emailPossible && (!wantsSms || needsEmailFallback);

  if (shouldEmail) {
    // Task-66 — capture the outbound envelope so retryFailedPatientNotifications
    // can resend without reconstructing the message from the originating
    // order/refund. Stored on the recorded notification as `email_envelope`.
    const envelope = {
      to_email:  input.to_email!,
      subject:   input.email.subject,
      text_body: input.email.body,
      template:  input.template,
    };
    const emailResult = await sendPatientEmail(envelope);

    notifications.push(
      recordPatientNotification({
        clinic_id:  input.clinic_id,
        patient_id: input.patient_id,
        order_id:   input.order_id,
        type:       input.type,
        template:   input.template,
        status:     emailResult.status,
        channel:    'Email',
        payload: {
          ...input.payload,
          postmark_message_id: emailResult.message_id,
          ...(emailResult.error_message ? { error_message: emailResult.error_message } : {}),
          ...(needsEmailFallback ? { email_fallback_from: 'sms' } : {}),
        },
        email_envelope: envelope,
        error_message:  emailResult.error_message ?? null,
      }),
    );
  }

  return { notifications };
}
