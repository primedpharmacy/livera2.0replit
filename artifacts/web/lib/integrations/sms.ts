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

import { createHmac, timingSafeEqual } from 'crypto';
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
  // Task-101 — when TWILIO_STATUS_CALLBACK_URL is configured, ask Twilio to
  // POST asynchronous delivery updates (sent / delivered / undelivered /
  // failed) to our /api/webhooks/twilio/status endpoint so the per-patient
  // notification log reflects the true final carrier status, not just the
  // "accepted by carrier" snapshot returned synchronously here.
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  if (statusCallbackUrl) {
    params.set('StatusCallback', statusCallbackUrl);
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

// ── Task-101: Twilio status callback helpers ─────────────────────────────────
/**
 * Map a Twilio asynchronous status callback (MessageStatus + ErrorCode) onto
 * our PatientNotification status vocabulary.
 *
 *   MessageStatus 'delivered'                  → 'Delivered'
 *   MessageStatus 'undelivered'                → 'Bounced'   (carrier rejected)
 *   MessageStatus 'failed'                     → 'Failed'    ('Bounced' if the
 *                                                 ErrorCode is in
 *                                                 TWILIO_BOUNCE_CODES)
 *   Any intermediate status (queued/sending/
 *   sent/accepted/receiving/received/read)     → null  — ignore, not final
 *
 * Returns null when the callback represents a non-final state and the
 * notification row should be left unchanged.
 */
export function mapTwilioCallbackStatus(
  messageStatus: string | null | undefined,
  errorCode: number | null | undefined,
): 'Delivered' | 'Bounced' | 'Failed' | null {
  const status = (messageStatus ?? '').toLowerCase();
  const code   = typeof errorCode === 'number' ? errorCode : null;

  if (status === 'delivered') return 'Delivered';
  if (status === 'undelivered') return 'Bounced';
  if (status === 'failed') {
    return code !== null && TWILIO_BOUNCE_CODES.has(code) ? 'Bounced' : 'Failed';
  }
  // queued / sending / sent / accepted / receiving / received / read / unknown
  return null;
}

/**
 * Verify the `X-Twilio-Signature` header on an incoming status callback.
 *
 * Twilio signs the full request URL concatenated with the POST parameters
 * sorted alphabetically by key (key + value, no separator), HMAC-SHA1'd
 * against the account auth token and base64-encoded.
 * Reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 *   mock mode (LIVERA_SMS_LIVE !== 'true') → always returns true (skipped)
 *   live mode → requires TWILIO_AUTH_TOKEN; returns false on mismatch or
 *               when the header is absent
 *
 * @param url       Full public URL Twilio POSTed to (scheme + host + path +
 *                  query). When TWILIO_STATUS_CALLBACK_URL is set, callers
 *                  should pass that value to guarantee an exact match.
 * @param params    Form-encoded POST params Twilio sent
 * @param signature Value of the X-Twilio-Signature header
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  const isLive = process.env.LIVERA_SMS_LIVE === 'true';
  if (!isLive) return true;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || !signature) return false;

  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((k) => k + params[k]).join('');
  const expected = createHmac('sha1', authToken).update(data).digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Bounded in-process dedupe cache for Twilio status callbacks — Task-207.
 *
 * Twilio retries status callbacks aggressively (every few seconds, then with
 * exponential back-off) until it sees a 2xx. Task-138 made the notification
 * row itself idempotent, so duplicates were harmless — but the webhook route
 * was still parsing the body, running HMAC-SHA1 over the params, hitting the
 * fixture store, and emitting a 'notification_updated' audit line on every
 * retry. For a single message that bounces and gets retried 10 times that's
 * 10 identical audit entries to wade through.
 *
 * The cache keys on `${MessageSid}:${MessageStatus}` because Twilio guarantees
 * the SID is stable for a given outbound message and the status transitions
 * monotonically (queued → sending → sent → delivered/undelivered/failed).
 * A retry for the *same* terminal state is a true duplicate and can be
 * short-circuited; a transition to a *new* state is a distinct event and
 * must still be processed.
 *
 * Bounding:
 *   - TTL: entries older than TWILIO_DEDUPE_TTL_MS are treated as expired.
 *     Twilio's retry window for status callbacks tops out around ~4 hours,
 *     so 1 hour is plenty for catching the common case (back-to-back retries
 *     within minutes) without holding state forever.
 *   - Max size: when the Map exceeds TWILIO_DEDUPE_MAX_ENTRIES we evict the
 *     oldest insertion-order entries. Map preserves insertion order, so the
 *     first key from .keys() is the stalest. This caps memory regardless of
 *     traffic volume.
 *
 * In-process only — a horizontally scaled deployment would dedupe per
 * instance, not globally. That's fine: the underlying row update is already
 * idempotent (Task-138); this cache is a CPU + log-noise optimisation, not
 * a correctness gate.
 */
const TWILIO_DEDUPE_TTL_MS = 60 * 60 * 1000;
const TWILIO_DEDUPE_MAX_ENTRIES = 1000;
const twilioDedupeCache = new Map<string, number>();

function twilioDedupeKey(messageSid: string, messageStatus: string): string {
  return `${messageSid}:${messageStatus.toLowerCase()}`;
}

/**
 * Returns true if (MessageSid, MessageStatus) was successfully processed
 * within the TTL window. Expired entries are dropped as a side-effect.
 */
export function hasRecentlyProcessedTwilioCallback(
  messageSid: string,
  messageStatus: string,
  now: number = Date.now(),
): boolean {
  if (!messageSid || !messageStatus) return false;
  const key = twilioDedupeKey(messageSid, messageStatus);
  const seenAt = twilioDedupeCache.get(key);
  if (seenAt === undefined) return false;
  if (now - seenAt > TWILIO_DEDUPE_TTL_MS) {
    twilioDedupeCache.delete(key);
    return false;
  }
  return true;
}

/**
 * Record that (MessageSid, MessageStatus) has been processed. Evicts the
 * oldest entries when the cache exceeds TWILIO_DEDUPE_MAX_ENTRIES.
 */
export function markTwilioCallbackProcessed(
  messageSid: string,
  messageStatus: string,
  now: number = Date.now(),
): void {
  if (!messageSid || !messageStatus) return;
  const key = twilioDedupeKey(messageSid, messageStatus);
  // Re-insert to refresh insertion order (LRU on write).
  twilioDedupeCache.delete(key);
  twilioDedupeCache.set(key, now);

  while (twilioDedupeCache.size > TWILIO_DEDUPE_MAX_ENTRIES) {
    const oldest = twilioDedupeCache.keys().next().value;
    if (oldest === undefined) break;
    twilioDedupeCache.delete(oldest);
  }
}

/** Test-only: wipe the dedupe cache between cases. */
export function __resetTwilioDedupeCacheForTests(): void {
  twilioDedupeCache.clear();
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
