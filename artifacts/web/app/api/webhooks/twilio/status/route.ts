/**
 * Twilio status callback webhook — Task-101.
 *
 * POST /api/webhooks/twilio/status
 *
 * Twilio POSTs an application/x-www-form-urlencoded payload to this endpoint
 * whenever an outbound SMS transitions through queued → sending → sent →
 * delivered / undelivered / failed. The synchronous response from the
 * Messages API (handled in lib/integrations/sms.ts) only confirms that
 * Twilio accepted the message; the *carrier-final* status arrives here
 * asynchronously, often minutes later.
 *
 * Body fields used:
 *   MessageSid     — matches the `sms_message_id` stored on the originating
 *                    PatientNotification.payload
 *   MessageStatus  — queued | sending | sent | delivered | undelivered | failed
 *   ErrorCode      — numeric Twilio error code (optional)
 *
 * Signature verification:
 *   The X-Twilio-Signature header is HMAC-SHA1 over `url + sorted(k+v)` keyed
 *   on TWILIO_AUTH_TOKEN. Validated via verifyTwilioSignature() in sms.ts.
 *   In stub mode (LIVERA_SMS_LIVE !== 'true') the check is skipped so
 *   developers can replay callbacks locally.
 *
 * Design invariants:
 *   - Always return HTTP 200 on success and on benign no-ops (unknown SID,
 *     intermediate status). Twilio retries on non-2xx and we don't want to
 *     storm the carrier with retries for SMSes we didn't originate.
 *   - Return HTTP 403 only when signature verification fails in live mode —
 *     this is the documented Twilio response for an invalid signature.
 *   - Intermediate statuses (queued / sending / sent / accepted) are
 *     acknowledged with `{ ok: true, ignored: 'intermediate_status' }` but
 *     do NOT mutate the notification row. Final state only.
 *
 * Configuration:
 *   - Set TWILIO_STATUS_CALLBACK_URL to the public URL of this endpoint
 *     (e.g. `https://app.livera.health/api/webhooks/twilio/status`). Once
 *     set, sendPatientSMS will include it as `StatusCallback` on each
 *     outbound message and Twilio will POST here.
 *   - Set LIVERA_SMS_LIVE=true to enforce signature verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyTwilioSignature,
  mapTwilioCallbackStatus,
} from '@/lib/integrations/sms';
import { applyTwilioStatusCallback } from '@/lib/api/fixtures/patientNotifications';
import { NOW } from '@/lib/api/constants';

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.log('[AUDIT]', {
      event_type: 'twilio_status_callback_failed',
      reason: 'read_body_error',
      error: err instanceof Error ? err.message : String(err),
      timestamp: NOW,
    });
    return NextResponse.json({ ok: false, reason: 'read_body_error' }, { status: 200 });
  }

  // Twilio sends form-urlencoded. Parse into a plain string-keyed object so
  // both the signature check and the field lookups operate on the same shape.
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawBody)) {
    params[k] = v;
  }

  // Use the configured public URL when available (must match exactly what
  // Twilio signed). Fall back to the request URL otherwise — works behind
  // most proxies but TWILIO_STATUS_CALLBACK_URL is the safer bet.
  const signedUrl = process.env.TWILIO_STATUS_CALLBACK_URL ?? request.url;
  const signature = request.headers.get('X-Twilio-Signature');

  const valid = verifyTwilioSignature(signedUrl, params, signature);
  if (!valid) {
    console.log('[AUDIT]', {
      event_type: 'twilio_status_callback_rejected',
      reason: 'signature_mismatch',
      message_sid: params.MessageSid ?? null,
      timestamp: NOW,
    });
    return NextResponse.json({ ok: false, reason: 'signature_mismatch' }, { status: 403 });
  }

  const messageSid    = params.MessageSid ?? '';
  const messageStatus = params.MessageStatus ?? '';
  const errorCodeRaw  = params.ErrorCode ?? '';
  const errorCode     = errorCodeRaw === '' ? null : Number.parseInt(errorCodeRaw, 10);

  if (!messageSid) {
    console.log('[AUDIT]', {
      event_type: 'twilio_status_callback_invalid',
      reason: 'missing_message_sid',
      timestamp: NOW,
    });
    return NextResponse.json({ ok: false, reason: 'missing_message_sid' }, { status: 200 });
  }

  const mapped = mapTwilioCallbackStatus(messageStatus, errorCode);
  if (mapped === null) {
    // Intermediate state (queued / sending / sent / accepted). Acknowledge
    // but don't mutate the row — wait for the carrier-final callback.
    console.log('[TWILIO_STATUS]', {
      action: 'intermediate_ignored',
      message_sid: messageSid,
      message_status: messageStatus,
    });
    return NextResponse.json(
      { ok: true, ignored: 'intermediate_status', message_status: messageStatus },
      { status: 200 },
    );
  }

  const errorMessage =
    mapped === 'Delivered'
      ? null
      : `Twilio callback status=${messageStatus}${
          errorCode !== null && !Number.isNaN(errorCode) ? ` (error_code ${errorCode})` : ''
        }`;

  const updated = applyTwilioStatusCallback(messageSid, {
    status: mapped,
    error_message: errorMessage,
  });

  if (!updated) {
    // SMS we don't recognise (sent outside Livera, or fixture wiped). Log and
    // 200 so Twilio doesn't retry.
    console.log('[AUDIT]', {
      event_type: 'twilio_status_callback_orphan',
      reason: 'no_matching_notification',
      message_sid: messageSid,
      message_status: messageStatus,
      timestamp: NOW,
    });
    return NextResponse.json(
      { ok: true, ignored: 'no_matching_notification' },
      { status: 200 },
    );
  }

  console.log('[TWILIO_STATUS]', {
    action: 'notification_updated',
    notification_id: updated.id,
    message_sid: messageSid,
    new_status: updated.status,
  });

  return NextResponse.json(
    { ok: true, notification_id: updated.id, status: updated.status },
    { status: 200 },
  );
}
