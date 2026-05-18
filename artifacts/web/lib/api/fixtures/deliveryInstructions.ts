/**
 * Delivery instructions — Task-318.
 *
 * Patient types a courier note at checkout; staff review/edit/approve before
 * the order's Primed payload is allowed to carry it. This module owns:
 *   - The intake sanitiser (length cap, CR/LF squash, control-char strip).
 *   - The "Delivery instructions need review" contextual flag.
 *   - The fixture mutators (approve / reject / update) used by both the
 *     server-action wrappers and the unit tests.
 */

import type { ClinicId, Order, User } from '../types';
import { delay, APIError, NOW } from '../constants';
import { MOCK_ORDERS } from './orders.data';
import { recordAudit } from '../audit';
import { syncDeliveryInstructionsToPrimed } from '@/lib/integrations/primed';

export const DELIVERY_INSTRUCTIONS_MAX_LEN = 250;
export const DELIVERY_INSTRUCTIONS_MAX_LINES = 5;
export const DELIVERY_INSTRUCTIONS_REVIEW_FLAG = 'Delivery instructions need review';

/**
 * Sanitise a raw delivery-instructions string from the patient (or staff
 * editor). Returns `null` if the input is missing, whitespace-only, or
 * otherwise empty after cleaning. Throws APIError('VALIDATION') if the
 * caller sent a value that exceeds the configured cap.
 *
 * Rules (task brief):
 *   - Trim whitespace; null on empty.
 *   - Squash CRLF → \n; drop control chars other than \n and tab.
 *   - Cap to DELIVERY_INSTRUCTIONS_MAX_LINES lines (extras dropped silently
 *     once the leading lines are kept — preserves what the patient typed
 *     up to the cap rather than rejecting the whole thing).
 *   - Length cap is hard: reject (don't truncate) so the server and the
 *     client both agree on what the patient typed.
 */
export function sanitiseDeliveryInstructions(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') {
    throw new APIError('VALIDATION', 'delivery_instructions must be a string');
  }
  // Normalise CRLF first so the control-char regex below doesn't kill \r
  // before we've collapsed line endings.
  let cleaned = raw.replace(/\r\n?/g, '\n');
  // Strip ASCII control characters except newline (\n = 0x0A) and tab
  // (\t = 0x09). Tabs are preserved so courier-label printing isn't
  // surprising; \n is the only multi-line marker we accept.
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
  const trimmed = cleaned.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > DELIVERY_INSTRUCTIONS_MAX_LEN) {
    throw new APIError(
      'VALIDATION',
      `Delivery instructions must be ${DELIVERY_INSTRUCTIONS_MAX_LEN} characters or fewer`,
    );
  }
  const lines = trimmed.split('\n');
  if (lines.length > DELIVERY_INSTRUCTIONS_MAX_LINES) {
    return lines.slice(0, DELIVERY_INSTRUCTIONS_MAX_LINES).join('\n');
  }
  return trimmed;
}

/**
 * Build the initial `delivery_instructions` object stored on a new intake
 * order. Returns `null` if the patient didn't enter anything.
 */
export function initialDeliveryInstructions(
  raw: string | null | undefined,
): Order['delivery_instructions'] {
  const value = sanitiseDeliveryInstructions(raw);
  if (value == null) return null;
  return {
    patient_submitted: value,
    staff_value: value,
    review_status: 'unreviewed',
    reviewed_by_user_id: null,
    reviewed_at: null,
    edits: [],
  };
}

/**
 * Read-time normalisation: ensures the
 * "Delivery instructions need review" contextual flag is present iff the
 * order has an unreviewed instruction. Mirrors the Task-163
 * normalizeSelfReportedBmiFlag pattern (returns a shallow copy when it has
 * to alter `contextual_flags`).
 */
export function normalizeDeliveryInstructionsFlag(order: Order): Order {
  const di = order.delivery_instructions;
  const flags = order.contextual_flags ?? [];
  const hasFlag = flags.includes(DELIVERY_INSTRUCTIONS_REVIEW_FLAG);
  const shouldHaveFlag = !!di && di.review_status === 'unreviewed';
  if (hasFlag === shouldHaveFlag) return order;
  const next = shouldHaveFlag
    ? [...flags, DELIVERY_INSTRUCTIONS_REVIEW_FLAG]
    : flags.filter((f) => f !== DELIVERY_INSTRUCTIONS_REVIEW_FLAG);
  return { ...order, contextual_flags: next };
}

function findOrderOrThrow(clinic_id: ClinicId, id: string): Order {
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');
  if (!o.delivery_instructions) {
    throw new APIError(
      'VALIDATION',
      'Order has no delivery instructions to review',
    );
  }
  return o;
}

export async function updateDeliveryInstructions(
  clinic_id: ClinicId,
  order_id: string,
  payload: { staff_value: string | null; reason?: string },
  actor: User,
): Promise<Order> {
  await delay(150);
  const o = findOrderOrThrow(clinic_id, order_id);
  const di = o.delivery_instructions!;
  const next = sanitiseDeliveryInstructions(payload.staff_value);
  if (next === di.staff_value) {
    // No-op — return unchanged so the UI can refresh without an audit entry.
    return o;
  }
  const before = { ...di };
  di.edits = [
    ...di.edits,
    {
      from: di.staff_value,
      to: next,
      edited_by_user_id: actor.id,
      edited_at: NOW,
      ...(payload.reason ? { reason: payload.reason } : {}),
    },
  ];
  di.staff_value = next;
  o.updated_at = NOW;

  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'order', id: order_id },
    event_type: 'delivery_instructions_edited',
    summary: `Delivery instructions edited on ${order_id} by ${actor.full_name}.`,
    before: { staff_value: before.staff_value },
    after: { staff_value: next },
  });

  return o;
}

export async function approveDeliveryInstructions(
  clinic_id: ClinicId,
  order_id: string,
  payload: { staff_value?: string | null } | undefined,
  actor: User,
): Promise<Order> {
  await delay(150);
  const o = findOrderOrThrow(clinic_id, order_id);
  const di = o.delivery_instructions!;

  // If the staff value changed in the same click as Approve, capture it as
  // an edit entry first (preserves the "approve == approve current value"
  // contract while letting staff make one final tweak).
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'staff_value')) {
    const next = sanitiseDeliveryInstructions(payload.staff_value ?? null);
    if (next !== di.staff_value) {
      di.edits = [
        ...di.edits,
        {
          from: di.staff_value,
          to: next,
          edited_by_user_id: actor.id,
          edited_at: NOW,
        },
      ];
      di.staff_value = next;
    }
  }

  const wasApproved = di.review_status === 'approved';
  di.review_status = 'approved';
  di.reviewed_by_user_id = actor.id;
  di.reviewed_at = NOW;
  o.updated_at = NOW;

  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'order', id: order_id },
    event_type: 'delivery_instructions_approved',
    summary: `Delivery instructions approved on ${order_id} by ${actor.full_name}.`,
    after: { staff_value: di.staff_value, review_status: 'approved' },
  });

  // If the order itself was already approved before the instruction got its
  // staff review, fire the one-shot "now ready to ship" hook so the wider
  // audit trail captures the moment the Primed payload became authoritative.
  if (
    !wasApproved &&
    o.clinical_decision?.decision === 'approved' &&
    di.staff_value != null &&
    di.staff_value !== ''
  ) {
    try {
      await syncDeliveryInstructionsToPrimed(o);
      // Durable spine: pair the `[AUDIT]` log line emitted inside
      // `syncDeliveryInstructionsToPrimed` with a `recordAudit` entry so the
      // order's Activity tab and the global audit search can both surface the
      // one-shot "ready to ship" moment.
      void recordAudit({
        clinic_id,
        actor,
        entity: { type: 'order', id: order_id },
        event_type: 'delivery_instructions_ready_to_ship',
        summary: `Delivery instructions for ${order_id} now ready to ship to Primed.`,
        after: { staff_value: di.staff_value },
      });
    } catch (err) {
      console.log('[AUDIT]', {
        event_type: 'primed_delivery_instructions_sync_failed',
        clinic_id,
        order_id,
        error: err instanceof Error ? err.message : String(err),
        timestamp: NOW,
      });
    }
  }

  return o;
}

export async function rejectDeliveryInstructions(
  clinic_id: ClinicId,
  order_id: string,
  payload: { reason: string },
  actor: User,
): Promise<Order> {
  await delay(150);
  const reason = (payload.reason ?? '').trim();
  if (!reason) {
    throw new APIError(
      'VALIDATION',
      'A reason is required to reject delivery instructions.',
    );
  }
  const o = findOrderOrThrow(clinic_id, order_id);
  const di = o.delivery_instructions!;
  const priorValue = di.staff_value;
  if (priorValue != null) {
    di.edits = [
      ...di.edits,
      {
        from: priorValue,
        to: null,
        edited_by_user_id: actor.id,
        edited_at: NOW,
        reason,
      },
    ];
  }
  di.staff_value = null;
  di.review_status = 'rejected';
  di.reviewed_by_user_id = actor.id;
  di.reviewed_at = NOW;
  o.updated_at = NOW;

  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'order', id: order_id },
    event_type: 'delivery_instructions_rejected',
    summary: `Delivery instructions rejected on ${order_id} by ${actor.full_name}.`,
    before: { staff_value: priorValue },
    after: { staff_value: null, review_status: 'rejected', reason },
  });

  return o;
}
