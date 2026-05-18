/**
 * Livera SMS integration — Task-65.
 *
 * Sends transactional SMS to patients when their preferred contact channel is
 * 'sms'. Used by the refund + cancellation notification flows alongside
 * sendPatientEmail() in postmark.ts.
 *
 * Feature flag: LIVERA_SMS_LIVE (default false in dev).
 *   false → mock mode: logs call, returns synthetic message_id, no real HTTP.
 *   true  → would call the real SMS provider. No provider is wired yet, so
 *           live mode currently returns status='Failed' with an explanatory
 *           error_message so the caller's email fallback kicks in.
 *
 * Server-side only.
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

  // No real SMS provider has been wired yet. Return a Failed result so the
  // caller falls back to email rather than silently dropping the message.
  return {
    message_id:    null,
    status:        'Failed',
    error_message: 'No live SMS provider configured (LIVERA_SMS_LIVE=true but provider not wired).',
  };
}
