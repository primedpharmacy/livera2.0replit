/**
 * Primed dispatch payload (Task-318).
 *
 * Today there is no live Primed integration — `primed_order_id` and
 * `primed_clinical_check_completed` are placeholders. This module owns the
 * canonical payload shape that *would* be POSTed once a real client lands,
 * so the rest of the app can wire fields through and unit-test them now.
 *
 * The Task-318 contract: `delivery_instructions` is included in the payload
 * ONLY when staff have approved it AND the approved value is non-empty.
 * Otherwise the field is omitted entirely (never sent as an empty string).
 */

import type { Order } from '@/lib/api/types';

export type PrimedOrderPayload = {
  order_id: string;
  clinic_id: string;
  patient_id: string;
  product: Order['product'];
  delivery_instructions?: string;
};

export function buildPrimedOrderPayload(order: Order): PrimedOrderPayload {
  const payload: PrimedOrderPayload = {
    order_id: order.id,
    clinic_id: order.clinic_id,
    patient_id: order.patient_id,
    product: order.product,
  };

  const di = order.delivery_instructions;
  if (
    di &&
    di.review_status === 'approved' &&
    di.staff_value != null &&
    di.staff_value !== ''
  ) {
    payload.delivery_instructions = di.staff_value;
  }

  return payload;
}

/**
 * One-shot "deliver the instruction now" hook fired when staff approve the
 * instruction *after* the clinical decision has already shipped the order.
 *
 * No real Primed client exists yet — we log the would-be payload diff and
 * leave a TODO so the future sync code can plug in here. Callers should
 * await this so an [AUDIT] line is reliably emitted before they return.
 */
export async function syncDeliveryInstructionsToPrimed(order: Order): Promise<void> {
  const payload = buildPrimedOrderPayload(order);
  console.log('[AUDIT]', {
    event_type: 'primed_delivery_instructions_sync_stub',
    clinic_id: order.clinic_id,
    order_id: order.id,
    primed_order_id: order.primed_order_id,
    delivery_instructions: payload.delivery_instructions ?? null,
    timestamp: new Date().toISOString(),
  });
  // TODO(task-318 follow-up): wire to real Primed client once available.
}
