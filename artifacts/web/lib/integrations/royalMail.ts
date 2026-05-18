/**
 * Royal Mail integration stubs — BLD-11.1 / BLD-11.3 (Wave 11).
 *
 * BLD-11.1: Webhook handler for 5 Royal Mail tracking events.
 * BLD-11.3: Postmark template trigger per event type.
 *
 * Production path:
 *   POST /api/webhooks/royal-mail  →  verifySignature()  →  handleRoyalMailEvent()
 *     → receiveRoyalMailWebhook() (fixture write)
 *     → sendPostmarkTemplate() (patient notification)
 *
 * Postmark template map (per event_type):
 *   accepted          → 'rm_accepted'          (confirmation dispatch)
 *   collected         → 'rm_collected'         (courier has it)
 *   in_transit        → (no patient email — internal only)
 *   out_for_delivery  → 'rm_out_for_delivery'  (arriving today)
 *   delivered         → 'rm_delivered'         (confirmation + feedback ask)
 *   exception         → 'rm_exception'         (action required — redelivery link)
 */

import type { CourierEvent } from '@/lib/api/types';

const POSTMARK_TEMPLATES: Partial<Record<CourierEvent['event_type'], string>> = {
  accepted:          'rm_accepted',
  collected:         'rm_collected',
  out_for_delivery:  'rm_out_for_delivery',
  delivered:         'rm_delivered',
  exception:         'rm_exception',
};

export interface RoyalMailWebhookPayload {
  tracking_number: string;
  event_type: CourierEvent['event_type'];
  occurred_at: string;
  location?: string;
  description: string;
  exception_code?: string;
}

/**
 * Verify Royal Mail HMAC-SHA256 signature.
 * Production: compare X-RM-Signature header against HMAC(secret, body).
 */
export function verifyRoyalMailSignature(body: string, signature: string): boolean {
  // Stub — real implementation uses crypto.createHmac
  console.info('[ROYAL_MAIL] Signature verification stub', { signature: signature.slice(0, 8) + '…' });
  return true;
}

/**
 * BLD-11.1 — Handle a Royal Mail webhook event.
 * Fires Postmark template if configured for this event type (BLD-11.3).
 */
export async function handleRoyalMailEvent(
  payload: RoyalMailWebhookPayload,
  recipientEmail: string | null,
  orderId: string,
): Promise<void> {
  const templateId = POSTMARK_TEMPLATES[payload.event_type];

  if (templateId && recipientEmail) {
    console.info('[POSTMARK][RM] Sending template', {
      template: templateId,
      to: recipientEmail,
      order_id: orderId,
      tracking: payload.tracking_number,
      event: payload.event_type,
    });
    // Production: await postmarkClient.sendEmailWithTemplate({ TemplateAlias: templateId, ... })
  }

  if (payload.event_type === 'exception') {
    console.warn('[ROYAL_MAIL] Delivery exception recorded', {
      order_id: orderId,
      exception_code: payload.exception_code,
      location: payload.location,
    });
  }

  console.info('[AUDIT]', {
    event_type: 'royal_mail_webhook_received',
    order_id: orderId,
    rm_event: payload.event_type,
    tracking: payload.tracking_number,
    occurred_at: payload.occurred_at,
    postmark_template: templateId ?? null,
    postmark_sent: !!templateId && !!recipientEmail,
  });
}

/**
 * BLD-11.5 — Build the courier status label for the dashboard exception stat.
 */
export function exceptionCodeLabel(code: string | null): string {
  switch (code) {
    case 'NOT_HOME':           return 'Not home — calling card left';
    case 'ADDRESS_NOT_FOUND':  return 'Address not found';
    case 'REFUSED':            return 'Delivery refused by recipient';
    case 'DAMAGED':            return 'Parcel damaged in transit';
    default:                   return code ?? 'Unknown exception';
  }
}
