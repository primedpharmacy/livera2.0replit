/**
 * Livera SMS integration — Task-65 (mock), Task-73 (live Twilio wiring).
 *
 * Sends transactional SMS to patients when their preferred contact channel is
 * 'sms'. Used by the refund + cancellation notification flows alongside
 * sendPatientEmail() in postmark.ts.
 *
 * Feature flag: LIVERA_SMS_LIVE (default false in dev).
 *   false → mock mode: logs call, returns synthetic message_id, no real HTTP.
 *   true  → calls Twilio's Messages API. Required env vars:
 *             TWILIO_ACCOUNT_SID   — starts with "AC..."
 *             TWILIO_AUTH_TOKEN    — account auth token
 *             TWILIO_FROM_NUMBER   — E.164 sender, e.g. "+441234567890",
 *                                    OR a Twilio Messaging Service SID
 *                                    starting with "MG..." (passed via
 *                                    MessagingServiceSid instead of From).
 *
 * Provider response → notification status mapping:
 *   - Successful HTTP 2xx with status in {queued,accepted,sending,sent,delivered}
 *       → 'Delivered'   (final state confirmed only via webhook; treat
 *                        accepted-by-carrier as delivered for log purposes,
 *                        mirroring sendPatientEmail's Postmark behaviour)
 *   - Status 'undelivered' or known invalid-recipient error codes
 *     (21211, 21408, 21610, 21614, 30003, 30005, 30006)
 *       → 'Bounced'
 *   - Everything else (auth errors, 5xx, network, unknown codes)
 *       → 'Failed' with error_message populated
 *
 * Server-side only — must not be imported from a client component.
 */

import { NOW } from '@/lib/api/constants';

let smsMockCounter = 0;
function nextMockSmsId(): string {
  smsMockCounter += 1;
  const stamp = NOW.replace(/[^0-9]/g, '').slice(-10);
  return `mock-sms-${stamp}-${String(smsMockCounter).padStart(4, '0')}`;
}

export type PatientSmsInput = {
  to_phone: string;
  text_body: string;
  template: string;
};

export type PatientSmsResult = {
  message_id: string | null;
  status: 'Delivered' | 'Bounced' | 'Failed';
  error_message?: string;
};

// Twilio error codes that indicate the destination is unreachable / invalid /
// opted-out — treated as Bounced (parallel to Postmark ErrorCode 406).
// Reference: https://www.twilio.com/docs/api/errors
const TWILIO_BOUNCE_CODES = new Set<number>([
  21211, // Invalid 'To' phone number
  21408, // Permission to send to that region not enabled
  21610, // Recipient has opted out (STOP)
  21614, // 'To' number is not a valid mobile number
  30003, // Unreachable destination handset
  30005, // Unknown destination handset
  30006, // Landline or unreachable carrier
]);

// Successful intermediate Twilio statuses returned synchronously from the
// Messages create endpoint. Final 'delivered' only arrives via status callback.
const TWILIO_ACCEPTED_STATUSES = new Set<string>([
  'accepted', 'queued', 'sending', 'sent', 'delivered',
]);

type TwilioMessageResponse = {
  sid?: string;
  status?: string;
  error_code?: number | null;
  error_message?: string | null;
  message?: string;
  code?: number;
};

async function liveSend(input: PatientSmsInput): Promise<PatientSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromOrMsg  = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromOrMsg) {
    return {
      message_id:    null,
      status:        'Failed',
      error_message:
        'Twilio env vars missing (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).',
    };
  }

  const params = new URLSearchParams();
  params.set('To', input.to_phone);
  params.set('Body', input.text_body);
  // Twilio accepts either a From phone number or a MessagingServiceSid.
  // MessagingServiceSid IDs always start with "MG".
  if (fromOrMsg.startsWith('MG')) {
    params.set('MessagingServiceSid', fromOrMsg);
  } else {
    params.set('From', fromOrMsg);
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const url  = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept':        'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { message_id: null, status: 'Failed', error_message: `Twilio HTTP request failed: ${msg}` };
  }

  let data: TwilioMessageResponse = {};
  try { data = (await res.json()) as TwilioMessageResponse; } catch { /* noop */ }

  if (!res.ok) {
    const code   = typeof data.code === 'number' ? data.code : undefined;
    const detail = data.message ?? res.statusText;
    const isBounce = code !== undefined && TWILIO_BOUNCE_CODES.has(code);
    return {
      message_id:    null,
      status:        isBounce ? 'Bounced' : 'Failed',
      error_message: `Twilio ${res.status}${code ? ` (code ${code})` : ''}: ${detail}`,
    };
  }

  const status    = (data.status ?? '').toLowerCase();
  const errorCode = typeof data.error_code === 'number' ? data.error_code : null;

  if (errorCode !== null) {
    const isBounce = TWILIO_BOUNCE_CODES.has(errorCode);
    return {
      message_id:    data.sid ?? null,
      status:        isBounce ? 'Bounced' : 'Failed',
      error_message: `Twilio error_code ${errorCode}: ${data.error_message ?? ''}`.trim(),
    };
  }

  if (status === 'undelivered' || status === 'failed') {
    return {
      message_id:    data.sid ?? null,
      status:        status === 'undelivered' ? 'Bounced' : 'Failed',
      error_message: `Twilio status=${status}`,
    };
  }

  if (TWILIO_ACCEPTED_STATUSES.has(status)) {
    return { message_id: data.sid ?? null, status: 'Delivered' };
  }

  // Unknown status — treat as Failed so the email fallback kicks in.
  return {
    message_id:    data.sid ?? null,
    status:        'Failed',
    error_message: `Twilio returned unexpected status="${status || 'unknown'}"`,
  };
}

export async function sendPatientSMS(
  input: PatientSmsInput,
): Promise<PatientSmsResult> {
  const flag = process.env.LIVERA_SMS_LIVE;
  const isLive = flag === 'true';

  if (!isLive) {
    const message_id = nextMockSmsId();
    console.log('[SMS_MOCK] sendPatientSMS —', {
      to:       input.to_phone,
      template: input.template,
      length:   input.text_body.length,
      message_id,
    });
    return { message_id, status: 'Delivered' };
  }

  return liveSend(input);
}
