'use server';

/**
 * Delivery-instructions server actions — Task-318.
 *
 * Mirrors the Task-194/293 wrapper pattern: every public action enforces
 * `write:orders` *before* the fixture mutator runs so callers without the
 * capability never alter state. The underlying fixture helpers record the
 * `delivery_instructions_(approved|rejected|edited)` audit lines and, for
 * approvals on already-approved orders, fire the Primed sync stub.
 */

import { requireServerActionUser, requirePermission } from '@/lib/auth/session';
import {
  approveDeliveryInstructions,
  rejectDeliveryInstructions,
  updateDeliveryInstructions,
} from '@/lib/api/fixtures/deliveryInstructions';
import type { ClinicId, Order } from '@/lib/api/types';

export async function approveDeliveryInstructionsAction(
  clinicId: ClinicId,
  orderId: string,
  payload?: { staff_value?: string | null },
): Promise<Order> {
  const actor = await requireServerActionUser();
  requirePermission(actor, 'write', 'orders');
  return approveDeliveryInstructions(clinicId, orderId, payload, actor);
}

export async function rejectDeliveryInstructionsAction(
  clinicId: ClinicId,
  orderId: string,
  payload: { reason: string },
): Promise<Order> {
  const actor = await requireServerActionUser();
  requirePermission(actor, 'write', 'orders');
  return rejectDeliveryInstructions(clinicId, orderId, payload, actor);
}

export async function updateDeliveryInstructionsAction(
  clinicId: ClinicId,
  orderId: string,
  payload: { staff_value: string | null; reason?: string },
): Promise<Order> {
  const actor = await requireServerActionUser();
  requirePermission(actor, 'write', 'orders');
  return updateDeliveryInstructions(clinicId, orderId, payload, actor);
}
