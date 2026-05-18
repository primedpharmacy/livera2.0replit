/**
 * Livera amendment fixtures — extracted from mock.ts (Mini-wave 6a cleanup).
 * DEC-38: refunds flow through amendments, not tasks.
 * Contains: MOCK_AMENDMENTS, listAmendments, getAmendment, decideAmendment.
 */

import type { ClinicId, Amendment } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER, NOW } from '../constants';
import { MOCK_ORDERS } from './orders';
import { MOCK_PATIENTS } from './patients';
import { refundPayment } from '@/lib/integrations/ryft';
import { notifyPatient } from '@/lib/integrations/patientNotify';

export const MOCK_AMENDMENTS: Amendment[] = [
  {
    id: 'AMEND-001',
    clinic_id: 'feeltru',
    order_id: 'ORD-00441',
    type: 'dose_escalation',
    status: 'requested',
    requested_by: { actor_type: 'patient', actor_id: 'PT-00198' },
    requested_at: '2026-05-11T07:30:00Z',
    details: {
      current_dose: '7.5mg',
      requested_dose: '10mg',
      reason: 'Patient reports plateau in weight loss over last 4 weeks and tolerating current dose well.',
    },
    decided_by: null,
    decided_at: null,
    decision_rationale: null,
  },
  {
    id: 'AMEND-002',
    clinic_id: 'feeltru',
    order_id: 'ORD-00447',
    type: 'refund',
    status: 'reviewing',
    requested_by: { actor_type: 'admin', actor_id: 'user_qadir' },
    requested_at: '2026-05-10T15:00:00Z',
    details: {
      amount_gbp: 195.00,
      reason: 'Duplicate charge raised during payment processing on 10 May 2026. Ryft duplicate auth confirmed.',
      ryft_refund_ref: 'ryft_ref_ew_dup',
    },
    decided_by: null,
    decided_at: null,
    decision_rationale: null,
  },
  // Task-38 — Linked refund amendment for cancelled order ORD-00450 (PRIYA).
  // Created automatically when the captured-payment order was cancelled;
  // sits in 'requested' status pending review by a clinician with can_refund.
  {
    id: 'AMEND-003',
    clinic_id: 'feeltru',
    order_id: 'ORD-00450',
    type: 'refund',
    status: 'requested',
    requested_by: { actor_type: 'admin', actor_id: 'user_qadir' },
    requested_at: '2026-05-10T14:30:00Z',
    details: {
      amount_gbp: 179.00,
      refund_type: 'full',
      reason: 'Order cancelled by patient — relocating overseas, no longer requires UK supply.',
      card_last4: '4242',
      origin: 'order_cancellation',
    },
    decided_by: null,
    decided_at: null,
    decision_rationale: null,
  },
];

export async function listAmendments(
  clinic_id: ClinicId,
  opts?: { status?: Amendment['status']; type?: Amendment['type'] }
): Promise<Amendment[]> {
  await delay();
  let results = scopedToClinic(MOCK_AMENDMENTS, clinic_id);
  if (opts?.status) results = results.filter((a) => a.status === opts.status);
  if (opts?.type) results = results.filter((a) => a.type === opts.type);
  return results;
}

export async function getAmendment(clinic_id: ClinicId, id: string): Promise<Amendment> {
  await delay();
  const a = MOCK_AMENDMENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!a) throw new APIError('NOT_FOUND', 'Amendment not found');
  return a;
}

export async function decideAmendment(
  clinic_id: ClinicId,
  id: string,
  decision: 'approved' | 'rejected',
  rationale: string
): Promise<Amendment> {
  // Layer 3 — Audit: log every attempt before any validation
  // TODO: Replace with audit_event API call when backend is ready
  console.log('[AUDIT]', {
    event_type: 'amendment_decision_attempt',
    clinic_id,
    amendment_id: id,
    user_id: CURRENT_USER.id,
    decision_attempted: decision,
    rationale,
    timestamp: new Date().toISOString(),
  });

  await delay(400);
  const a = MOCK_AMENDMENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!a) throw new APIError('NOT_FOUND', 'Amendment not found');

  // Layer 2 — Data guard: validate before applying any decision
  if (a.status !== 'requested' && a.status !== 'reviewing') {
    throw new APIError('INVALID_STATE', 'Amendment cannot be decided in its current state');
  }

  // Layer 1 — Safety re-validation for dose escalation approvals
  if (decision === 'approved' && a.type === 'dose_escalation') {
    const order = MOCK_ORDERS.find((o) => o.clinic_id === clinic_id && o.id === a.order_id);
    const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === order?.patient_id);
    const hasHighUnacknowledgedFlag = patient?.flags.some(
      (f) => f.severity === 'high' && f.code !== 'B4_acknowledged'
    ) ?? false;

    if (hasHighUnacknowledgedFlag) {
      // TODO: Replace with audit_event API call when backend is ready
      console.log('[AUDIT]', {
        event_type: 'amendment_decision_result',
        outcome: 'safety_violation',
        reason: 'high_severity_flag_unacknowledged',
        amendment_id: id,
        user_id: CURRENT_USER.id,
        timestamp: new Date().toISOString(),
      });
      throw new APIError('SAFETY_VIOLATION', 'Cannot approve: patient has an unacknowledged high-severity clinical flag');
    }
  }

  a.status = decision === 'approved' ? 'approved' : 'rejected';
  a.decided_by = CURRENT_USER.id;
  a.decided_at = new Date().toISOString();
  a.decision_rationale = rationale;

  // TODO: Replace with audit_event API call when backend is ready
  console.log('[AUDIT]', {
    event_type: 'amendment_decision_result',
    outcome: decision,
    amendment_id: id,
    user_id: CURRENT_USER.id,
    timestamp: new Date().toISOString(),
  });

  return a;
}

// ---------------------------------------------------------------------------
// processRefundAmendment — Task-38
//
// Refund-amendment specific action used by AmendmentDetailClient's refund
// panel. Separate from decideAmendment because:
//   1. Approval calls refundPayment() (stubbed via LIVERA_RYFT_LIVE) and writes
//      ryft_refund_ref + refunded_amount_gbp into amendment.details.
//   2. Status transitions to 'applied' (not 'approved').
//   3. Refund authority (can_refund) is enforced here as a Layer-2 safety gate,
//      complementing the UI lock on AmendmentDetailClient.
//
// 3-layer safety chain:
//   Layer 1 (UI): refund panel is locked + button disabled when can_refund=false
//   Layer 2 (here): re-validate can_refund + amount bounds; throw on violation
//   Layer 3 (audit): every attempt + outcome logged under [AUDIT]
// ---------------------------------------------------------------------------

export type RefundDecisionInput =
  | {
      decision: 'approve';
      refund_type: 'full' | 'partial';
      amount_gbp: number;
      reason: string;            // selector code: 'dispensing_fee' | 'compounding' | 'partial_use' | 'other'
      rationale?: string | null;
    }
  | {
      decision: 'reject';
      rationale: string;         // mandatory policy reason
    };

export async function processRefundAmendment(
  clinic_id: ClinicId,
  amendment_id: string,
  input: RefundDecisionInput,
): Promise<Amendment> {
  console.log('[AUDIT]', {
    event_type: 'refund_amendment_decision_attempt',
    clinic_id,
    amendment_id,
    user_id: CURRENT_USER.id,
    decision_attempted: input.decision,
    timestamp: NOW,
  });

  await delay(400);

  const a = MOCK_AMENDMENTS.find((x) => x.clinic_id === clinic_id && x.id === amendment_id);
  if (!a) throw new APIError('NOT_FOUND', 'Amendment not found');
  if (a.type !== 'refund') throw new APIError('INVALID_STATE', 'Amendment is not a refund');
  if (a.status !== 'requested' && a.status !== 'reviewing') {
    throw new APIError('INVALID_STATE', 'Refund amendment cannot be actioned in its current state');
  }

  // Layer 2 — refund-authority gate
  if (!CURRENT_USER.can_refund) {
    console.log('[AUDIT]', {
      event_type: 'refund_amendment_decision_result',
      outcome: 'safety_violation',
      reason: 'no_refund_authority',
      amendment_id,
      user_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError('FORBIDDEN', 'You do not have refund authority on this clinic.');
  }

  const order = MOCK_ORDERS.find((o) => o.clinic_id === clinic_id && o.id === a.order_id);
  if (!order) throw new APIError('NOT_FOUND', 'Linked order not found');

  if (input.decision === 'reject') {
    if (!input.rationale.trim()) {
      throw new APIError('VALIDATION', 'A rationale is required when rejecting a refund.');
    }
    a.status = 'rejected';
    a.decided_by = CURRENT_USER.id;
    a.decided_at = NOW;
    a.decision_rationale = input.rationale.trim();
    console.log('[AUDIT]', {
      event_type: 'refund_amendment_decision_result',
      outcome: 'rejected',
      amendment_id,
      user_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    return a;
  }

  // Approve path — call refundPayment stub
  const authorised = order.amount_charged ?? order.amount_authorised ?? 0;
  if (input.amount_gbp <= 0 || input.amount_gbp > authorised) {
    throw new APIError(
      'VALIDATION',
      `Refund amount must be between £0.01 and £${authorised.toFixed(2)}.`,
    );
  }
  if (input.refund_type === 'partial' && input.amount_gbp < 1) {
    throw new APIError('VALIDATION', 'Partial refunds must be at least £1.00.');
  }

  const amountPence = Math.round(input.amount_gbp * 100);
  const result = await refundPayment(
    order.ryft_authorisation_id ?? `auth_unknown_${order.id}`,
    amountPence,
    order.id,
  );

  a.status = 'applied';
  a.decided_by = CURRENT_USER.id;
  a.decided_at = NOW;
  a.decision_rationale =
    input.rationale?.trim() ||
    `${input.refund_type === 'full' ? 'Full' : 'Partial'} refund issued via Ryft (${input.reason}).`;
  a.details = {
    ...a.details,
    refund_type: input.refund_type,
    refund_reason_code: input.reason,
    refunded_amount_gbp: input.amount_gbp,
    ryft_refund_ref: result.ryft_refund_ref,
  };

  console.log('[AUDIT]', {
    event_type: 'refund_amendment_decision_result',
    outcome: 'applied',
    amendment_id,
    user_id: CURRENT_USER.id,
    refunded_amount_gbp: input.amount_gbp,
    ryft_refund_ref: result.ryft_refund_ref,
    timestamp: NOW,
  });

  // Task-49 / Task-65 — notify the patient that a refund has been processed.
  // Honours patient.contact.preferred_channel: SMS-preferring patients get an
  // SMS first (with email fallback), everyone else gets email. Each attempted
  // send is written to MOCK_PATIENT_NOTIFICATIONS with the correct channel.
  // Failure MUST NOT throw — the refund itself has already been applied above.
  try {
    const patient = MOCK_PATIENTS.find(
      (p) => p.clinic_id === clinic_id && p.id === order.patient_id,
    );
    const toEmail = patient?.contact.email ?? null;
    const toPhone = patient?.contact.phone ?? null;
    const preferred = patient?.contact.preferred_channel ?? 'email';
    const cardLast4 =
      (a.details as { card_last4?: string } | undefined)?.card_last4 ?? '••••';

    if (!toEmail && !(preferred === 'sms' && toPhone)) {
      console.log('[AUDIT]', {
        event_type: 'patient_refund_notification_skipped',
        reason: 'no_destination_on_record',
        amendment_id,
        order_id: order.id,
        patient_id: order.patient_id,
        preferred_channel: preferred,
        timestamp: NOW,
      });
    } else {
      const firstName = patient?.demographic.full_name?.split(' ')[0] ?? 'there';
      const subject = `Refund processed for order ${order.id}`;
      const emailBody =
        `Hi ${firstName},\n\n` +
        `We've processed a refund of £${input.amount_gbp.toFixed(2)} for order ` +
        `${order.id}. The funds will return to the card ending ${cardLast4} within ` +
        `3–5 working days.\n\n` +
        `If you have any questions, just reply to this email.\n\n` +
        `Thanks,\nThe Livera team`;
      const smsBody =
        `Livera: we've refunded £${input.amount_gbp.toFixed(2)} for order ` +
        `${order.id} to the card ending ${cardLast4}. Allow 3–5 working days.`;

      const { notifications } = await notifyPatient({
        clinic_id,
        patient_id: order.patient_id,
        order_id:   order.id,
        type:       'order_cancelled_refund_processed',
        template:   'order_cancelled_refund',
        preferred_channel: preferred,
        to_email:   toEmail,
        to_phone:   toPhone,
        email: { subject, body: emailBody },
        sms:   { body: smsBody },
        payload: {
          order_id:        order.id,
          amendment_id,
          refunded_amount: input.amount_gbp,
          card_last4:      cardLast4,
          ryft_refund_ref: result.ryft_refund_ref,
        },
      });

      for (const notif of notifications) {
        console.log('[AUDIT]', {
          event_type:      'patient_refund_notification_sent',
          outcome:         notif.status,
          channel:         notif.channel,
          amendment_id,
          order_id:        order.id,
          patient_id:      order.patient_id,
          notification_id: notif.id,
          timestamp:       NOW,
        });
      }
    }
  } catch (err) {
    console.log('[AUDIT]', {
      event_type: 'patient_refund_notification_failed',
      amendment_id,
      order_id: order.id,
      error: err instanceof Error ? err.message : String(err),
      timestamp: NOW,
    });
  }

  return a;
}
