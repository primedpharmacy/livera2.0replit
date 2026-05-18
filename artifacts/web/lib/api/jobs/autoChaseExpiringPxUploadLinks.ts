/**
 * autoChaseExpiringPxUploadLinks — Task-175.
 *
 * The "Awaiting Px upload" dashboard widget (Task-125) flags every order
 * whose patient hasn't uploaded their GLP-1 prescription yet. For clinics
 * with dozens of pending uploads, staff would otherwise have to click
 * "Resend link" by hand on each row once the original token expires.
 *
 * This job sweeps those orders and, for the subset whose `px_upload_link`
 * is already past `expires_at`, auto-rotates the token via
 * `autoResendPxUploadLink` — reusing the same email plumbing staff use
 * manually but auditing under actor_id 'system' and recording each attempt
 * on `px_upload_link.auto_resends[]`.
 *
 * Why expired-only (not "within 24h"): `sendPxUploadReminders` already
 * fires a final reminder within the 24h pre-expiry window using the
 * existing (still-valid) token. If this job *also* fired in that window
 * it would rotate the token and invalidate the link in the reminder
 * email the patient just received minutes earlier. Splitting the
 * responsibility — reminders nudge *before* expiry, auto-chase replaces
 * *after* expiry — eliminates that conflict and means a failed auto-send
 * never strands a patient with an otherwise-valid token (the prior token
 * is already dead).
 *
 * Eligibility (per clinic):
 *   - order belongs to the given clinic
 *   - `contextual_flags` includes "Px upload pending"
 *   - `px_upload` is null and the link's `consumed_at` is null
 *   - a `px_upload_link` exists (i.e. the patient was issued one at intake)
 *   - link's `expires_at` is in the past (already expired)
 *   - the auto-chase has not already been escalated for this order
 *   - `auto_resends.length < MAX_AUTO_RESENDS`
 *
 * Guardrail: after MAX_AUTO_RESENDS attempts, the order is *escalated*
 * instead of re-mailed: a `Px upload chase escalated` contextual flag is
 * added so staff see "call the patient" surface in the queue, and an
 * `[AUDIT] px_upload_auto_chase_escalated` line is emitted.
 *
 * Idempotency: once escalated, the order is skipped on subsequent sweeps
 * (the timestamp is set and the flag is on). A staff-driven resend will
 * mint a fresh token but does NOT reset `auto_resends`, so the cap holds
 * across sweeps. If a patient finally uploads, normal pipelines clear
 * the "Px upload pending" flag and this job naturally stops considering
 * the order.
 *
 * Designed to run server-side (RSC / cron-compatible).
 */

import type { ClinicId, Order } from '../types';
import { NOW } from '../constants';
import { MOCK_ORDERS } from '../fixtures/orders';
// Namespace import so unit tests can vi.spyOn the auto-resend helper
// (vi.spyOn rebinds the property on the namespace object, which won't
// reach a direct named import).
import * as ordersFixture from '../fixtures/orders';

// Cap on how many times the cron will silently re-issue a link before
// asking staff to take over. Three attempts mirrors the manual "first +
// final reminder + one resend" cadence staff typically use today.
export const MAX_AUTO_RESENDS = 3;

const ESCALATED_FLAG = 'Px upload chase escalated';

export type AutoChaseAction = 'resent' | 'failed' | 'escalated';

export type AutoChaseOutcome = {
  order_id:    Order['id'];
  patient_id:  Order['patient_id'];
  action:      AutoChaseAction;
  attempt:     number;          // 1-based; for `escalated` this is the cap value
  status:      'Delivered' | 'Bounced' | 'Failed' | null;
  message_id:  string | null;
};

export type AutoChaseResult = {
  considered: number;
  resent:     AutoChaseOutcome[];
  failed:     AutoChaseOutcome[];
  escalated:  AutoChaseOutcome[];
};

function uploadAlreadyArrived(order: Order): boolean {
  return Boolean(order.px_upload) || Boolean(order.px_upload_link?.consumed_at);
}

export async function autoChaseExpiringPxUploadLinks(
  clinicId: ClinicId,
): Promise<AutoChaseResult> {
  const nowMs  = new Date(NOW).getTime();
  const result: AutoChaseResult = { considered: 0, resent: [], failed: [], escalated: [] };

  const candidates = MOCK_ORDERS.filter((o) => {
    if (o.clinic_id !== clinicId)                                return false;
    if (!o.contextual_flags?.includes('Px upload pending'))      return false;
    if (uploadAlreadyArrived(o))                                 return false;
    const link = o.px_upload_link;
    if (!link)                                                   return false;
    if (link.auto_chase_escalated_at)                            return false;
    const expiresMs = new Date(link.expires_at).getTime();
    // Auto-chase only when the link is *already expired*. Pre-expiry
    // nudges are owned by sendPxUploadReminders (which reuses the same
    // still-valid token); rotating mid-window would invalidate the link
    // in the reminder email the patient just received.
    if (expiresMs > nowMs)                                       return false;
    return true;
  });

  for (const order of candidates) {
    result.considered += 1;
    const link = order.px_upload_link!;
    const attemptIndex = (link.auto_resends?.length ?? 0) + 1;

    // Cap hit → escalate instead of mailing. We also stamp here even if
    // the cap was hit on a previous sweep but escalation somehow wasn't
    // recorded (defensive — keeps the state machine self-healing).
    if ((link.auto_resends?.length ?? 0) >= MAX_AUTO_RESENDS) {
      link.auto_chase_escalated_at = NOW;
      const flags = new Set(order.contextual_flags ?? []);
      flags.add(ESCALATED_FLAG);
      order.contextual_flags = Array.from(flags);
      order.updated_at = NOW;

      const outcome: AutoChaseOutcome = {
        order_id:   order.id,
        patient_id: order.patient_id,
        action:     'escalated',
        attempt:    MAX_AUTO_RESENDS,
        status:     null,
        message_id: null,
      };
      result.escalated.push(outcome);

      console.log('[AUDIT]', {
        event_type:      'px_upload_auto_chase_escalated',
        clinic_id:       clinicId,
        order_id:        order.id,
        patient_id:      order.patient_id,
        actor_id:        'system',
        auto_resends:    link.auto_resends?.length ?? 0,
        last_expires_at: link.expires_at,
        timestamp:       NOW,
      });
      continue;
    }

    try {
      const send = await ordersFixture.autoResendPxUploadLink(order);
      const outcome: AutoChaseOutcome = {
        order_id:   order.id,
        patient_id: order.patient_id,
        action:     send.status === 'Delivered' ? 'resent' : 'failed',
        attempt:    attemptIndex,
        status:     send.status,
        message_id: send.message_id,
      };
      if (send.status === 'Delivered') result.resent.push(outcome);
      else                              result.failed.push(outcome);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed.push({
        order_id:   order.id,
        patient_id: order.patient_id,
        action:     'failed',
        attempt:    attemptIndex,
        status:     'Failed',
        message_id: null,
      });
      console.error('[AUDIT]', {
        event_type:    'px_upload_auto_chase_error',
        clinic_id:     clinicId,
        order_id:      order.id,
        actor_id:      'system',
        error_message: message,
        timestamp:     NOW,
      });
    }
  }

  return result;
}
