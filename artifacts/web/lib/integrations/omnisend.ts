/**
 * Omnisend integration stub — BLD-4.6.5 (Wave 4).
 *
 * Omnisend handles marketing/transactional email templates.
 * Used here for: "Order expired" template on order expiry (BLD-4.6.3/5).
 *
 * Payment copy rule (PRODUCT_VISION.md Chunk 4.6):
 *   Template body must NEVER say "refund". Use "order released" / "no charge taken".
 *
 * Feature-flagged by LIVERA_OMNISEND_LIVE (default false).
 * When false: stub logs and returns deterministic success.
 *
 * Fix Cycle 1 — POLISH: replaced new Date().toISOString() with NOW import.
 */

import { NOW } from '@/lib/api/constants';

const OMNISEND_LIVE = process.env['LIVERA_OMNISEND_LIVE'] === 'true';

export type OmnisendTemplate =
  | 'order_expired'
  | 'order_declined'
  | 'order_approved'
  | 'order_dispatched';

export interface OmnisendSendResult {
  success: boolean;
  template: OmnisendTemplate;
  patient_email: string;
  order_id: string;
}

/**
 * Send a transactional Omnisend template to a patient.
 * Failure is non-blocking on the order expiry path — caller catches and logs.
 */
export async function sendTemplate(
  template: OmnisendTemplate,
  patient_email: string,
  order_id: string,
): Promise<OmnisendSendResult> {
  console.log('[AUDIT]', {
    event_type:     'omnisend_send_attempt',
    template,
    patient_email,
    order_id,
    live:           OMNISEND_LIVE,
    timestamp:      NOW,
  });

  if (!OMNISEND_LIVE) {
    console.info('[OMNISEND]', `sendTemplate stub — template="${template}" to=${patient_email} order=${order_id}`);
    return { success: true, template, patient_email, order_id };
  }

  // Real Omnisend API wiring — post-launch
  throw new Error('LIVERA_OMNISEND_LIVE=true wiring not yet implemented');
}
