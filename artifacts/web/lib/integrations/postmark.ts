/**
 * Livera Postmark integration — BLD-7.3 (Wave 5).
 *
 * Sends GP letters via Postmark transactional email with PDF attachment.
 *
 * Feature flag: LIVERA_POSTMARK_LIVE (default false in dev).
 *   false → mock mode: logs call, returns synthetic message_id, no real HTTP.
 *   true  → calls Postmark API with POSTMARK_SERVER_TOKEN env var.
 *
 * Error handling: throws APIError('POSTMARK_SEND_FAILED', ...) on HTTP/auth errors.
 * Caller (sendGPLetterAction) catches and surfaces UI message; all errors are audited
 * in sendGPLetter() fixture (Layer 3).
 *
 * IMPORTANT: This module is server-side only (imported from a server action).
 * It MUST NOT be imported from a client component.
 */

import { APIError, NOW } from '@/lib/api/constants';

// ---------------------------------------------------------------------------
// Mock message-ID generator — mirrors nextPCTM pattern (pharmacyComms.ts:22-26)
// ---------------------------------------------------------------------------

let postmarkMockCounter = 0;
function nextMockMessageId(): string {
  postmarkMockCounter += 1;
  const stamp = NOW.replace(/[^0-9]/g, '').slice(-10);
  return `mock-pm-${stamp}-${String(postmarkMockCounter).padStart(4, '0')}`;
}

export type PostmarkSendInput = {
  to_email: string;
  subject: string;
  email_body: string;
  pdf_buffer: Buffer;
  pdf_filename: string;
};

export type PostmarkSendResult = {
  message_id: string | null;
  accepted: boolean;
};

// Task-49 — patient transactional email (no PDF attachment).
export type PatientEmailInput = {
  to_email: string;
  subject: string;
  text_body: string;
  // Task-131 — optional HTML body. When present we send Postmark `HtmlBody`
  // alongside `TextBody` so the patient receives the styled email; the
  // plain-text version is kept as the text fallback for clients that block
  // HTML.
  html_body?: string | null;
  template: string;
};

export type PatientEmailResult = {
  message_id: string | null;
  status: 'Delivered' | 'Bounced' | 'Failed';
  error_message?: string;
};

// ---------------------------------------------------------------------------
// Mock mode (LIVERA_POSTMARK_LIVE=false or unset)
// ---------------------------------------------------------------------------

function mockSend(input: PostmarkSendInput): PostmarkSendResult {
  const message_id = nextMockMessageId();
  console.log('[POSTMARK_MOCK] sendViaPostmark —', {
    to:           input.to_email,
    subject:      input.subject,
    pdf_filename: input.pdf_filename,
    pdf_bytes:    input.pdf_buffer.length,
    message_id,
  });
  return { message_id, accepted: true };
}

// ---------------------------------------------------------------------------
// Live mode (LIVERA_POSTMARK_LIVE=true)
// ---------------------------------------------------------------------------

async function liveSend(input: PostmarkSendInput): Promise<PostmarkSendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    throw new APIError(
      'POSTMARK_SEND_FAILED',
      'POSTMARK_SERVER_TOKEN env var is not set. ' +
        'Set LIVERA_POSTMARK_LIVE=false in dev or provide the token.',
    );
  }

  const fromAddress = process.env.POSTMARK_FROM_ADDRESS ?? 'noreply@livera.health';

  const body = JSON.stringify({
    From:    fromAddress,
    To:      input.to_email,
    Subject: input.subject,
    TextBody: input.email_body,
    Attachments: [
      {
        Name:        input.pdf_filename,
        Content:     input.pdf_buffer.toString('base64'),
        ContentType: 'application/pdf',
      },
    ],
  });

  let res: Response;
  try {
    res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept':                  'application/json',
        'Content-Type':            'application/json',
        'X-Postmark-Server-Token': token,
      },
      body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new APIError('POSTMARK_SEND_FAILED', `Postmark HTTP request failed: ${msg}`);
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json() as { Message?: string }).Message ?? ''; } catch { /* noop */ }
    throw new APIError(
      'POSTMARK_SEND_FAILED',
      `Postmark returned ${res.status}: ${detail || res.statusText}`,
    );
  }

  const data = (await res.json()) as { MessageID?: string; ErrorCode?: number };
  if (data.ErrorCode && data.ErrorCode !== 0) {
    throw new APIError('POSTMARK_SEND_FAILED', `Postmark error code ${data.ErrorCode}`);
  }

  return { message_id: data.MessageID ?? null, accepted: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * sendViaPostmark — sends a GP letter email with PDF attachment via Postmark.
 *
 * Server-side only. Called from sendGPLetterAction (lib/actions/gpLetterActions.ts).
 *
 * @returns { message_id, accepted }
 * @throws  APIError('POSTMARK_SEND_FAILED', ...) on error
 */
export async function sendViaPostmark(
  input: PostmarkSendInput,
): Promise<PostmarkSendResult> {
  const flag = process.env.LIVERA_POSTMARK_LIVE;
  const isLive = flag === 'true'; // default false — do not send real emails in dev

  if (!isLive) return mockSend(input);
  return liveSend(input);
}

// ---------------------------------------------------------------------------
// sendPatientEmail — Task-49
//
// Plain-text transactional email to a patient (no PDF attachment). Used by the
// refund + cancellation flows to notify patients when:
//   - a refund amendment moves to 'applied' (order_cancelled_refund_processed)
//   - an auth-release cancellation completes with no charge (order_cancelled_no_charge)
//
// Mock mode (default in dev) just console-logs and returns a synthetic
// message_id with status='Delivered' so the patient notification log shows
// the expected outcome. Live mode calls Postmark and maps HTTP errors to
// Bounced (4xx 'inactive recipient') / Failed (everything else) so the
// notification log mirrors real delivery state.
// ---------------------------------------------------------------------------

// Task-78 — staff transactional email (same shape as sendPatientEmail).
// Used to notify a clinic's clinical-check inbox when a new intake order is
// submitted, so reviewers don't have to poll the queue.
export async function sendStaffEmail(
  input: PatientEmailInput,
): Promise<PatientEmailResult> {
  return sendPatientEmail(input);
}

export async function sendPatientEmail(
  input: PatientEmailInput,
): Promise<PatientEmailResult> {
  const flag = process.env.LIVERA_POSTMARK_LIVE;
  const isLive = flag === 'true';

  if (!isLive) {
    const message_id = nextMockMessageId();
    console.log('[POSTMARK_MOCK] sendPatientEmail —', {
      to:        input.to_email,
      subject:   input.subject,
      template:  input.template,
      has_html:  !!input.html_body,
      message_id,
    });
    return { message_id, status: 'Delivered' };
  }

  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    return {
      message_id:    null,
      status:        'Failed',
      error_message: 'POSTMARK_SERVER_TOKEN env var is not set',
    };
  }

  const fromAddress = process.env.POSTMARK_FROM_ADDRESS ?? 'noreply@livera.health';

  try {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept':                  'application/json',
        'Content-Type':            'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify({
        From:     fromAddress,
        To:       input.to_email,
        Subject:  input.subject,
        TextBody: input.text_body,
        // Task-131 — include HtmlBody only when the caller captured one so
        // text-only flows keep the same request shape.
        ...(input.html_body ? { HtmlBody: input.html_body } : {}),
      }),
    });

    if (!res.ok) {
      let detail = '';
      let errorCode: number | undefined;
      try {
        const parsed = (await res.json()) as { Message?: string; ErrorCode?: number };
        detail = parsed.Message ?? '';
        errorCode = parsed.ErrorCode;
      } catch { /* noop */ }
      // Postmark ErrorCode 406 = inactive recipient (hard bounce / suppressed)
      const isBounce = errorCode === 406;
      return {
        message_id:    null,
        status:        isBounce ? 'Bounced' : 'Failed',
        error_message: `Postmark ${res.status}: ${detail || res.statusText}`,
      };
    }

    const data = (await res.json()) as { MessageID?: string; ErrorCode?: number };
    if (data.ErrorCode && data.ErrorCode !== 0) {
      return {
        message_id:    null,
        status:        data.ErrorCode === 406 ? 'Bounced' : 'Failed',
        error_message: `Postmark error code ${data.ErrorCode}`,
      };
    }
    return { message_id: data.MessageID ?? null, status: 'Delivered' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { message_id: null, status: 'Failed', error_message: message };
  }
}
