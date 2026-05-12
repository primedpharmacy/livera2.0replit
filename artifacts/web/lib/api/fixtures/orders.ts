/**
 * Livera order fixtures — extracted from mock.ts (Mini-wave 6a cleanup).
 * Wave 4: BLD-4.6.1 (intervention SLA), BLD-4.6.3 (expiry), BLD-5.3 (amendOrder).
 *
 * Contains: MOCK_ORDERS, listOrders, getOrder, decideOrder, getClinicalCheckQueue,
 *           createAmendment (BLD-5.3), expireOrder (BLD-4.6.3).
 */

import type { ClinicId, Order, OrderStatus } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER, NOW } from '../constants';
import { MOCK_PATIENTS } from './patients';
import { MOCK_CLINICAL_NOTES } from './clinicalNotes';
import { getClinicSync } from './clinics';
import { createPharmacyCommThread } from './pharmacyComms';

// ---------------------------------------------------------------------------
// Seeds
// All seeds carry intervention_raised_at and expired_at (BLD-4.6.1, BLD-4.6.3).
// ---------------------------------------------------------------------------

const SARAH_ORDER_FEELTRU: Order = {
  id: 'ORD-00441',
  clinic_id: 'feeltru',
  patient_id: 'PT-00198',
  type: 'reorder',
  status: 'clinical_check',
  product: { medication: 'Mounjaro', dose: '7.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 84.2, side_effects: 'mild nausea', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_abc',
  amount_charged: null,
  amount_authorised: 220,
  clinical_decision: null,
  sla_warn_at: '2026-05-11T14:00:00Z',
  sla_breach_at: '2026-05-12T08:00:00Z',
  g6_flags: ['B4'],
  intervention_raised_at: null,
  expired_at: null,
  created_at: '2026-05-11T06:00:00Z',
  updated_at: NOW,
};

const SARAH_ORDER_VSC: Order = { ...SARAH_ORDER_FEELTRU, clinic_id: 'vsc', patient_id: 'PT-00012' };

const JAMES_ORDER_VSC: Order = {
  id: 'ORD-00438',
  clinic_id: 'vsc',
  patient_id: 'PT-00234',
  type: 'reorder',
  status: 'approved',
  product: { medication: 'Mounjaro', dose: '5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 101.4, side_effects: 'none', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  primed_clinical_check_completed: true,
  ryft_authorisation_id: 'ryft_auth_jh1',
  amount_charged: 179.00,
  amount_authorised: 179.00,
  clinical_decision: {
    prescriber_user_id: 'user_qadir',
    decision: 'approved',
    decided_at: '2026-05-03T14:00:00Z',
    rationale: 'Patient progressing well. Weight loss on target. No contraindications.',
  },
  sla_warn_at: '2026-05-03T15:00:00Z',
  sla_breach_at: '2026-05-04T09:00:00Z',
  g6_flags: [],
  intervention_raised_at: null,
  expired_at: null,
  created_at: '2026-05-03T09:30:00Z',
  updated_at: '2026-05-03T14:00:00Z',
};

const MIRIAM_ORDER_VSC: Order = {
  id: 'ORD-00422',
  clinic_id: 'vsc',
  patient_id: 'PT-00156',
  type: 'reorder',
  status: 'clinical_check',
  product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 95.1, side_effects: 'none', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_mo1',
  amount_charged: null,
  amount_authorised: 159.00,
  clinical_decision: null,
  sla_warn_at: '2026-05-11T06:00:00Z',
  sla_breach_at: '2026-05-11T12:00:00Z',
  g6_flags: [],
  intervention_raised_at: null,
  expired_at: null,
  created_at: '2026-05-10T12:00:00Z',
  updated_at: NOW,
};

const EMMA_ORDER_FEELTRU: Order = {
  id: 'ORD-00447',
  clinic_id: 'feeltru',
  patient_id: 'PT-00412',
  type: 'reorder',
  status: 'dispatched',
  product: { medication: 'Wegovy', dose: '1.0mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 87.3, side_effects: 'none', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: 'primed_ew_001',
  primed_clinical_check_completed: true,
  ryft_authorisation_id: 'ryft_auth_ew1',
  amount_charged: 195.00,
  amount_authorised: 195.00,
  clinical_decision: {
    prescriber_user_id: 'user_qadir',
    decision: 'approved',
    decided_at: '2026-05-06T11:00:00Z',
    rationale: 'Excellent progress. 7.7 kg loss over 4 months. Continue current dose.',
  },
  sla_warn_at: '2026-05-05T16:00:00Z',
  sla_breach_at: '2026-05-06T10:00:00Z',
  g6_flags: [],
  intervention_raised_at: null,
  expired_at: null,
  created_at: '2026-05-05T10:00:00Z',
  updated_at: '2026-05-07T08:00:00Z',
};

const ZARA_ORDER_FEELTRU: Order = {
  id: 'ORD-00449',
  clinic_id: 'feeltru',
  patient_id: 'PT-00378',
  type: 'new',
  status: 'clinical_check',
  product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 87.0, side_effects: 'none', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_za1',
  amount_charged: null,
  amount_authorised: 149.00,
  clinical_decision: null,
  sla_warn_at: '2026-05-11T11:00:00Z',
  sla_breach_at: '2026-05-12T05:00:00Z',
  g6_flags: [],
  intervention_raised_at: null,
  expired_at: null,
  created_at: '2026-05-11T05:00:00Z',
  updated_at: NOW,
};

// BLD-4.6.1 — Intervention seed: an order in on_hold status with intervention_raised_at set
const HELEN_ORDER_FEELTRU_INTERVENTION: Order = {
  id: 'ORD-00433',
  clinic_id: 'feeltru',
  patient_id: 'PT-00198',
  type: 'reorder',
  status: 'on_hold',
  product: { medication: 'Mounjaro', dose: '5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 85.6, side_effects: 'mild headache', medication_changes: 'started metformin' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_hf1',
  amount_charged: null,
  amount_authorised: 199.00,
  clinical_decision: {
    prescriber_user_id: 'user_qadir',
    decision: 'queried',
    decided_at: '2026-05-08T09:00:00Z',
    rationale: 'Concurrent metformin initiation. Please confirm dosing schedule and GP awareness.',
  },
  sla_warn_at: '2026-05-08T09:00:00Z',
  sla_breach_at: '2026-05-12T09:00:00Z',
  g6_flags: [],
  intervention_raised_at: '2026-05-08T09:00:00Z',
  expired_at: null,
  created_at: '2026-05-07T14:00:00Z',
  updated_at: '2026-05-08T09:00:00Z',
};

// BLD-4.6.3/4 — Expired seed: an order that hit the 6-calendar-day expiry
const NINA_ORDER_VSC_EXPIRED: Order = {
  id: 'ORD-00418',
  clinic_id: 'vsc',
  patient_id: 'PT-00156',
  type: 'new',
  status: 'expired',
  product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 96.0, side_effects: 'none', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_ni1',
  amount_charged: null,
  amount_authorised: 149.00,
  clinical_decision: null,
  sla_warn_at: '2026-05-02T10:00:00Z',
  sla_breach_at: '2026-05-03T10:00:00Z',
  g6_flags: [],
  intervention_raised_at: null,
  expired_at: '2026-05-07T10:00:00Z',
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-07T10:00:00Z',
};

export const MOCK_ORDERS: Order[] = [
  SARAH_ORDER_FEELTRU, SARAH_ORDER_VSC,
  JAMES_ORDER_VSC, MIRIAM_ORDER_VSC,
  EMMA_ORDER_FEELTRU, ZARA_ORDER_FEELTRU,
  HELEN_ORDER_FEELTRU_INTERVENTION,
  NINA_ORDER_VSC_EXPIRED,
];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listOrders(
  clinic_id: ClinicId,
  opts?: { status?: OrderStatus; patient_id?: string }
): Promise<Order[]> {
  await delay();
  let results = scopedToClinic(MOCK_ORDERS, clinic_id);
  if (opts?.status) results = results.filter((o) => o.status === opts.status);
  if (opts?.patient_id) results = results.filter((o) => o.patient_id === opts.patient_id);
  return results;
}

export async function getOrder(clinic_id: ClinicId, id: string): Promise<Order> {
  await delay();
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');
  return o;
}

export async function getClinicalCheckQueue(clinic_id: ClinicId): Promise<Order[]> {
  return listOrders(clinic_id, { status: 'clinical_check' });
}

// ---------------------------------------------------------------------------
// decideOrder — BLD-4.4 (Wave 3) + BLD-4.6.1 intervention_raised_at (Wave 4)
// ---------------------------------------------------------------------------

export async function decideOrder(
  clinic_id: ClinicId,
  id: string,
  decision: 'approved' | 'declined' | 'queried',
  rationale: string
): Promise<Order> {
  // Layer 3 — Audit: log every attempt before any validation
  console.log('[AUDIT]', {
    event_type: 'clinical_decision_attempt',
    clinic_id,
    order_id: id,
    user_id: CURRENT_USER.id,
    decision_attempted: decision,
    rationale,
    timestamp: NOW,
  });

  await delay(400);
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');

  // Layer 2 — Data guard: validate before applying any decision
  if (o.status !== 'clinical_check') {
    console.log('[AUDIT]', {
      event_type: 'clinical_decision_result',
      outcome: 'safety_violation',
      reason: 'not_in_clinical_check',
      order_id: id,
      user_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Cannot act on this order: it is not in clinical_check status');
  }

  if (decision === 'approved') {
    const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === o.patient_id);
    const hasHighUnacknowledgedFlag = patient?.flags.some(
      (f) => f.severity === 'high' && f.code !== 'B4_acknowledged'
    ) ?? false;

    if (hasHighUnacknowledgedFlag) {
      console.log('[AUDIT]', {
        event_type: 'clinical_decision_result',
        outcome: 'safety_violation',
        reason: 'high_severity_flag_unacknowledged',
        order_id: id,
        user_id: CURRENT_USER.id,
        timestamp: NOW,
      });
      throw new APIError('SAFETY_VIOLATION', 'Cannot approve: patient has an unacknowledged high-severity clinical flag');
    }

    const hasDoseEscalation = 'dose_escalation' in o.questionnaire_responses;
    const hasPriorDoseEvidence = Boolean(o.questionnaire_responses['prior_dose_evidence']);
    if (hasDoseEscalation && !hasPriorDoseEvidence) {
      console.log('[AUDIT]', {
        event_type: 'clinical_decision_result',
        outcome: 'safety_violation',
        reason: 'dose_escalation_no_prior_evidence',
        order_id: id,
        user_id: CURRENT_USER.id,
        timestamp: NOW,
      });
      throw new APIError('SAFETY_VIOLATION', 'Cannot approve: dose escalation requires prior dose evidence in questionnaire');
    }

    // Layer 2 — BLD-4.4 clinical note gate
    const clinic = getClinicSync(clinic_id);
    const approvalNoteExists = MOCK_CLINICAL_NOTES.some(
      (n) =>
        n.approval_gate_for_order_id === id &&
        n.clinic_id === clinic_id &&
        n.body.length >= clinic.config.clinical_note_min_chars,
    );
    if (!approvalNoteExists) {
      console.log('[AUDIT]', {
        event_type: 'clinical_decision_result',
        outcome:    'safety_violation',
        reason:     'clinical_note_required',
        actor_id:   CURRENT_USER.id,
        target_id:  id,
        timestamp:  NOW,
      });
      throw new APIError('SAFETY_VIOLATION', 'clinical_note_required');
    }
  }

  o.clinical_decision = {
    prescriber_user_id: CURRENT_USER.id,
    decision,
    decided_at: NOW,
    rationale,
  };

  // BLD-4.6.1 — set intervention_raised_at when decision='queried' (order enters on_hold)
  if (decision === 'queried') {
    o.intervention_raised_at = NOW;
    o.status = 'on_hold';
  } else {
    o.status = decision === 'approved' ? 'approved' : 'declined';
  }

  o.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'clinical_decision_result',
    outcome: decision,
    order_id: id,
    user_id: CURRENT_USER.id,
    new_status: o.status,
    intervention_raised_at: o.intervention_raised_at,
    timestamp: NOW,
  });

  return o;
}

// ---------------------------------------------------------------------------
// expireOrder — BLD-4.6.3 internal helper (called by detectOrderExpiry)
// Transitions a single order to 'expired'. Not exported directly —
// detectOrderExpiry owns the loop + effects.
// ---------------------------------------------------------------------------

export function expireOrderMutation(order: Order): void {
  order.status = 'expired';
  order.expired_at = NOW;
  order.updated_at = NOW;
  console.log('[AUDIT]', {
    event_type:  'order_expired',
    outcome:     'success',
    actor_id:    'system',
    order_id:    order.id,
    clinic_id:   order.clinic_id,
    expired_at:  NOW,
    reason:      '6-day-timeout',
    timestamp:   NOW,
  });
}

// ---------------------------------------------------------------------------
// createAmendment — BLD-5.3 (Wave 4)
// Amendment window enforcement + DEC-28 Pharmacy Comms fork.
// DEC-01: both clinics use pre_dispensed; 403 at dispatched or later.
// Allowed window: clinical_check | on_hold | approved | in_dispensing
// ---------------------------------------------------------------------------

export async function createAmendment(
  clinic_id: ClinicId,
  order_id: string,
  type: 'dose_change' | 'cancellation' | 'refund' | 'reschedule' | 'address_change' | 'dose_escalation',
  reason: string,
): Promise<import('../types').Amendment> {
  // Layer 3 — Audit: log every attempt
  console.log('[AUDIT]', {
    event_type:   'amendment_create_attempt',
    clinic_id,
    order_id,
    amendment_type: type,
    user_id:      CURRENT_USER.id,
    reason,
    timestamp:    NOW,
  });

  await delay(300);

  // Layer 2 — resolve order
  const order = MOCK_ORDERS.find((o) => o.clinic_id === clinic_id && o.id === order_id);
  if (!order) throw new APIError('NOT_FOUND', `Order '${order_id}' not found`);

  // Layer 1+2 — amendment window gate (DEC-01: pre_dispensed for both clinics)
  // Allowed: clinical_check, on_hold (intervention), approved, in_dispensing
  // Closed:  dispatched, delivered, expired, cancelled, declined
  const AMENDMENT_ALLOWED_STATUSES: Order['status'][] = [
    'clinical_check', 'on_hold', 'approved', 'in_dispensing',
  ];
  if (!AMENDMENT_ALLOWED_STATUSES.includes(order.status)) {
    console.log('[AUDIT]', {
      event_type:  'amendment_create_result',
      outcome:     'safety_violation',
      reason:      'amendment_window_expired',
      order_id,
      order_status: order.status,
      user_id:     CURRENT_USER.id,
      timestamp:   NOW,
    });
    throw new APIError(
      'WINDOW_CLOSED',
      `Amendment window closed — order is ${order.status}. Amendments can only be raised before dispatch.`,
    );
  }

  // Build the amendment record
  const { MOCK_AMENDMENTS } = await import('./amendments');
  const amendment: import('../types').Amendment = {
    id: `AMEND-${String(MOCK_AMENDMENTS.length + 1).padStart(3, '0')}`,
    clinic_id,
    order_id,
    type,
    status: 'requested',
    requested_by: { actor_type: 'admin', actor_id: CURRENT_USER.id },
    requested_at: NOW,
    details: { reason },
    decided_by: null,
    decided_at: null,
    decision_rationale: null,
  };
  MOCK_AMENDMENTS.push(amendment);

  // DEC-28 — Pharmacy Comms fork:
  // If Primed clinical check is NOT yet completed → amendment applied directly (no comms needed)
  // If Primed clinical check IS completed → create pharmacy_comm thread; amendment held until Primed approves
  if (order.primed_clinical_check_completed) {
    await createPharmacyCommThread(clinic_id, {
      anchor_type: 'order',
      anchor_id: order_id,
      topic: `amendment_${type}`,
      priority: type === 'cancellation' ? 'urgent' : 'routine',
      body: `Amendment request: ${type}. Reason: ${reason}. Order is post-Primed clinical check — amendment held pending Primed approval (DEC-28).`,
      amendment_id: amendment.id,
    });
    // Mark amendment as reviewing — pending Primed response
    amendment.status = 'reviewing';
    console.log('[AUDIT]', {
      event_type:      'amendment_pharmacy_comms_raised',
      outcome:         'reviewing',
      order_id,
      amendment_id:    amendment.id,
      primed_checked:  true,
      timestamp:       NOW,
    });
  } else {
    // Pre-Primed-check: amendment takes effect immediately
    amendment.status = 'approved';
    amendment.decided_by = 'system';
    amendment.decided_at = NOW;
    amendment.decision_rationale = 'Auto-approved: order is pre-Primed clinical check (DEC-28)';
    console.log('[AUDIT]', {
      event_type:      'amendment_auto_approved',
      outcome:         'approved',
      order_id,
      amendment_id:    amendment.id,
      primed_checked:  false,
      timestamp:       NOW,
    });
  }

  return amendment;
}
